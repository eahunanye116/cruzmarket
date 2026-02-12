
'use server';

import { getFirestoreInstance } from '@/firebase/server';
import { doc, collection, runTransaction, serverTimestamp, increment, DocumentReference, getDoc, getDocs, query, where, collectionGroup, setDoc } from 'firebase/firestore';
import type { UserProfile, PerpPosition, PerpMarket } from '@/lib/types';
import { calculateLiquidationPrice, getLiveCryptoPrice, CONTRACT_MULTIPLIER, PIP_SPREAD } from '@/lib/perp-utils';
import { revalidatePath } from 'next/cache';
import { getLatestUsdNgnRate } from './wallet-actions';

/**
 * CORE LOGIC: Check and liquidate a single position.
 * This function is decoupled from Next.js revalidation so it can be called by standalone workers.
 */
export async function checkAndLiquidatePositionInternal(userId: string, positionId: string, currentPriceUsd?: number) {
    const firestore = getFirestoreInstance();
    try {
        const positionRef = doc(firestore, `users/${userId}/perpPositions`, positionId);
        const posSnap = await getDoc(positionRef);
        if (!posSnap.exists()) return { success: false, error: 'Position not found' };
        const posData = posSnap.data() as PerpPosition;
        if (posData.status !== 'open') return { success: false, error: 'Position not active' };

        const priceToUse = currentPriceUsd ?? await getLiveCryptoPrice(posData.tickerId);

        let isLiquidatable = false;
        if (posData.direction === 'LONG' && priceToUse <= posData.liquidationPrice) isLiquidatable = true;
        if (posData.direction === 'SHORT' && priceToUse >= posData.liquidationPrice) isLiquidatable = true;

        if (isLiquidatable) {
            await runTransaction(firestore, async (transaction) => {
                const pRef = doc(firestore, `users/${userId}/perpPositions`, positionId);
                const pDoc = await transaction.get(pRef);
                if (!pDoc.exists() || pDoc.data().status !== 'open') return;

                transaction.update(pRef, { 
                    status: 'liquidated', 
                    closedAt: serverTimestamp(),
                    exitPrice: priceToUse,
                    realizedPnL: -posData.collateral 
                });
            });
            return { success: true, liquidated: true };
        }
        return { success: true, liquidated: false };
    } catch (e: any) {
        console.error(`[Liquidation] Internal Failure for pos ${positionId}:`, e.message);
        return { success: false, error: e.message };
    }
}

/**
 * NEXT.js ACTION: Wrapper for UI calls
 */
export async function checkAndLiquidatePosition(userId: string, positionId: string, currentPriceUsd?: number) {
    const res = await checkAndLiquidatePositionInternal(userId, positionId, currentPriceUsd);
    if (res.success && res.liquidated) {
        try { revalidatePath('/perps'); } catch (e) {}
    }
    return res;
}

export async function openPerpPositionAction(
    userId: string,
    pairId: string,
    lots: number,
    leverage: number,
    direction: 'LONG' | 'SHORT'
) {
    if (lots < 1) throw new Error("Minimum trade size is 1 Lot.");
    
    const firestore = getFirestoreInstance();
    const effectiveLeverage = Math.min(leverage, 400);
    
    try {
        const marketRef = doc(firestore, 'perpMarkets', pairId);
        const marketSnap = await getDoc(marketRef);
        if (!marketSnap.exists()) throw new Error("Market no longer available.");
        const market = marketSnap.data() as PerpMarket;

        const [usdPrice, ngnRate] = await Promise.all([
            getLiveCryptoPrice(pairId),
            getLatestUsdNgnRate()
        ]);
        
        const entryPriceUsd = direction === 'LONG' ? usdPrice + PIP_SPREAD : usdPrice - PIP_SPREAD;
        const positionValueUsd = entryPriceUsd * lots * CONTRACT_MULTIPLIER;
        const requiredMarginNgn = (positionValueUsd * ngnRate) / effectiveLeverage;
        const feeNgn = (positionValueUsd * ngnRate) * 0.001;
        const totalRequiredNgn = requiredMarginNgn + feeNgn;

        if (!Number.isFinite(totalRequiredNgn) || isNaN(totalRequiredNgn) || !Number.isFinite(entryPriceUsd)) {
            throw new Error("Market pricing error. Please wait for oracle sync.");
        }

        const result = await runTransaction(firestore, async (transaction) => {
            const userRef = doc(firestore, 'users', userId);
            const userDoc = await transaction.get(userRef as DocumentReference<UserProfile>);
            
            if (!userDoc.exists()) throw new Error('User not found.');
            const userData = userDoc.data();
            const balance = Number(userData.balance) || 0;

            if (balance < totalRequiredNgn) {
                throw new Error(`Insufficient balance. Required: ₦${totalRequiredNgn.toLocaleString(undefined, { maximumFractionDigits: 0 })}`);
            }

            const liqPriceUsd = calculateLiquidationPrice(direction, entryPriceUsd, effectiveLeverage, lots);
            
            let initialStatus: PerpPosition['status'] = 'open';
            const isImmediatelyLiquidated = direction === 'LONG' 
                ? usdPrice <= liqPriceUsd 
                : usdPrice >= liqPriceUsd;

            if (isImmediatelyLiquidated) {
                initialStatus = 'liquidated';
            }

            const positionRef = doc(collection(firestore, `users/${userId}/perpPositions`));
            const positionData: Omit<PerpPosition, 'id'> = {
                userId,
                tickerId: pairId, 
                tickerName: market.symbol,
                tickerIcon: market.icon || '',
                direction,
                leverage: effectiveLeverage,
                lots,
                collateral: requiredMarginNgn,
                entryPrice: entryPriceUsd,    
                entryValue: positionValueUsd * ngnRate, 
                liquidationPrice: liqPriceUsd, 
                status: initialStatus,
                createdAt: serverTimestamp() as any,
                exitPrice: isImmediatelyLiquidated ? usdPrice : null,
                realizedPnL: isImmediatelyLiquidated ? -requiredMarginNgn : null,
                closedAt: isImmediatelyLiquidated ? serverTimestamp() as any : null
            };

            transaction.set(positionRef, positionData);
            transaction.update(userRef, { balance: increment(-totalRequiredNgn) });

            return { positionId: positionRef.id, isLiquidated: isImmediatelyLiquidated };
        });

        try { revalidatePath('/perps'); } catch (e) {}
        return { success: true, ...result };
    } catch (error: any) {
        console.error('Failed to open perp:', error);
        return { success: false, error: error.message || 'Trade failed due to invalid pricing data' };
    }
}

export async function closePerpPositionAction(userId: string, positionId: string) {
    const firestore = getFirestoreInstance();
    
    try {
        const positionRef = doc(firestore, `users/${userId}/perpPositions`, positionId);
        const posSnap = await getDoc(positionRef);
        if (!posSnap.exists()) throw new Error('Position not found.');
        const posData = posSnap.data() as PerpPosition;
        if (posData.status !== 'open') throw new Error('Position already closed.');

        const [usdPrice, ngnRate] = await Promise.all([
            getLiveCryptoPrice(posData.tickerId),
            getLatestUsdNgnRate()
        ]);

        const priceDiffUsd = posData.direction === 'LONG' 
            ? usdPrice - posData.entryPrice 
            : posData.entryPrice - usdPrice;
        
        const realizedPnlNgn = (priceDiffUsd * posData.lots * CONTRACT_MULTIPLIER) * ngnRate;
        const totalToReturn = Math.max(0, posData.collateral + realizedPnlNgn);

        if (!Number.isFinite(totalToReturn) || isNaN(totalToReturn)) throw new Error("Closure price invalid.");

        const result = await runTransaction(firestore, async (transaction) => {
            const pRef = doc(firestore, `users/${userId}/perpPositions`, positionId);
            const pDoc = await transaction.get(pRef);
            if (!pDoc.exists() || pDoc.data().status !== 'open') throw new Error('Position invalid.');

            const userRef = doc(firestore, 'users', userId);
            transaction.update(userRef, { 
                balance: increment(totalToReturn),
                totalRealizedPnl: increment(realizedPnlNgn || 0)
            });

            transaction.update(pRef, {
                status: 'closed',
                closedAt: serverTimestamp(),
                exitPrice: usdPrice,
                realizedPnL: realizedPnlNgn
            });

            return { realizedPnl: realizedPnlNgn, amountReturned: totalToReturn };
        });

        try { revalidatePath('/perps'); } catch (e) {}
        return { success: true, ...result };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

/**
 * PLATFORM SWEEP: Can be called by Action, API, or Script.
 */
export async function sweepAllLiquidationsAction() {
    const firestore = getFirestoreInstance();
    try {
        // Record heartbeat Pulse
        const statsRef = doc(firestore, 'stats', 'platform');
        await setDoc(statsRef, { lastPerpSweepAt: serverTimestamp() }, { merge: true }).catch(err => {
            console.error("[Sweep Heartbeat] Failed to record pulse:", err);
        });

        const positionsQuery = query(
            collectionGroup(firestore, 'perpPositions'),
            where('status', '==', 'open')
        );
        const snapshot = await getDocs(positionsQuery);
        
        if (snapshot.empty) return { success: true, message: 'No open positions.' };

        const uniquePairs = Array.from(new Set(snapshot.docs.map(d => d.data().tickerId)));
        const prices: Record<string, number> = {};

        await Promise.all(uniquePairs.map(async (pair) => {
            try {
                prices[pair] = await getLiveCryptoPrice(pair);
            } catch (e) {}
        }));

        let liquidatedCount = 0;
        
        const liquidationTasks = snapshot.docs.map(async (posDoc) => {
            const pos = posDoc.data() as PerpPosition;
            const currentPriceUsd = prices[pos.tickerId];
            if (!currentPriceUsd) return;

            let isBreached = false;
            if (pos.direction === 'LONG' && currentPriceUsd <= pos.liquidationPrice) isBreached = true;
            if (pos.direction === 'SHORT' && currentPriceUsd >= pos.liquidationPrice) isBreached = true;

            if (isBreached) {
                const res = await checkAndLiquidatePositionInternal(pos.userId, posDoc.id, currentPriceUsd);
                if (res.success && res.liquidated) {
                    liquidatedCount++;
                }
            }
        });

        await Promise.all(liquidationTasks);

        try {
            revalidatePath('/admin');
            revalidatePath('/perps');
        } catch (e) {}

        return { success: true, message: `Audit complete. ${liquidatedCount} positions liquidated.` };
    } catch (error: any) {
        console.error('[Sweep] Critical Failure:', error);
        return { success: false, error: error.message };
    }
}
