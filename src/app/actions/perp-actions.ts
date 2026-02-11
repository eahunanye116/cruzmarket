'use server';

import { getFirestoreInstance } from '@/firebase/server';
import { doc, collection, runTransaction, serverTimestamp, increment, DocumentReference, getDoc, getDocs, query, where, collectionGroup } from 'firebase/firestore';
import type { UserProfile, PerpPosition, PerpMarket } from '@/lib/types';
import { calculateLiquidationPrice, getSpreadAdjustedPrice, getLiveCryptoPrice, CONTRACT_MULTIPLIER } from '@/lib/perp-utils';
import { revalidatePath } from 'next/cache';
import { getLatestUsdNgnRate } from './wallet-actions';

export async function openPerpPositionAction(
    userId: string,
    pairId: string,
    lots: number,
    leverage: number,
    direction: 'LONG' | 'SHORT'
) {
    const firestore = getFirestoreInstance();
    // Maximum leverage supported by the engine - UPDATED to 400x
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
        
        const currentPriceNgn = usdPrice * ngnRate;
        
        // Convert USD Spread to NGN (110 Pips)
        const spreadNgn = 110 * ngnRate; 
        const entryPriceNgn = direction === 'LONG' ? currentPriceNgn + spreadNgn : currentPriceNgn - spreadNgn;
        
        const positionValueNgn = entryPriceNgn * lots * CONTRACT_MULTIPLIER;
        const requiredMarginNgn = positionValueNgn / effectiveLeverage;
        
        // Fee is 0.1% of contract value
        const feeNgn = positionValueNgn * 0.001;
        const totalRequiredNgn = requiredMarginNgn + feeNgn;

        // CRITICAL: NaN/Finite Guard to prevent Firestore corruption
        if (!Number.isFinite(totalRequiredNgn) || isNaN(totalRequiredNgn) || !Number.isFinite(entryPriceNgn)) {
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

            const liqPriceNgn = calculateLiquidationPrice(direction, entryPriceNgn, effectiveLeverage, lots);
            
            let initialStatus: PerpPosition['status'] = 'open';
            const isImmediatelyLiquidated = direction === 'LONG' 
                ? currentPriceNgn <= liqPriceNgn 
                : currentPriceNgn >= liqPriceNgn;

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
                entryPrice: entryPriceNgn,
                entryValue: positionValueNgn,
                liquidationPrice: liqPriceNgn,
                status: initialStatus,
                createdAt: serverTimestamp() as any,
                exitPrice: isImmediatelyLiquidated ? currentPriceNgn : null,
                realizedPnL: isImmediatelyLiquidated ? -requiredMarginNgn : null,
                closedAt: isImmediatelyLiquidated ? serverTimestamp() as any : null
            };

            transaction.set(positionRef, positionData);
            transaction.update(userRef, { balance: increment(-totalRequiredNgn) });

            return { positionId: positionRef.id, isLiquidated: isImmediatelyLiquidated };
        });

        revalidatePath('/perps');
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
        const currentPriceNgn = usdPrice * ngnRate;

        // Apply Closing Spread (Half of 110 Pips in NGN)
        const spreadNgn = 55 * ngnRate;
        const exitPriceNgn = posData.direction === 'LONG' ? currentPriceNgn - spreadNgn : currentPriceNgn + spreadNgn;

        const result = await runTransaction(firestore, async (transaction) => {
            const pRef = doc(firestore, `users/${userId}/perpPositions`, positionId);
            const pDoc = await transaction.get(pRef);
            if (!pDoc.exists() || pDoc.data().status !== 'open') throw new Error('Position invalid.');

            const priceDiffNgn = posData.direction === 'LONG' 
                ? exitPriceNgn - posData.entryPrice 
                : posData.entryPrice - exitPriceNgn;
            
            const realizedPnlNgn = priceDiffNgn * posData.lots * CONTRACT_MULTIPLIER;
            const totalToReturn = Math.max(0, posData.collateral + realizedPnlNgn);

            // NAN GUARD
            if (!Number.isFinite(totalToReturn) || isNaN(totalToReturn)) throw new Error("Closure price invalid.");

            const userRef = doc(firestore, 'users', userId);
            transaction.update(userRef, { 
                balance: increment(totalToReturn),
                totalRealizedPnl: increment(realizedPnlNgn || 0)
            });

            transaction.update(pRef, {
                status: 'closed',
                closedAt: serverTimestamp(),
                exitPrice: exitPriceNgn,
                realizedPnL: realizedPnlNgn
            });

            return { realizedPnl: realizedPnlNgn, amountReturned: totalToReturn };
        });

        revalidatePath('/perps');
        return { success: true, ...result };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function checkAndLiquidatePosition(userId: string, positionId: string) {
    const firestore = getFirestoreInstance();
    try {
        const positionRef = doc(firestore, `users/${userId}/perpPositions`, positionId);
        const posSnap = await getDoc(positionRef);
        if (!posSnap.exists()) return { success: false, error: 'Position not found' };
        const posData = posSnap.data() as PerpPosition;
        if (posData.status !== 'open') return { success: false, error: 'Position not active' };

        const [usdPrice, ngnRate] = await Promise.all([
            getLiveCryptoPrice(posData.tickerId),
            getLatestUsdNgnRate()
        ]);
        const currentPriceNgn = usdPrice * ngnRate;

        let isLiquidatable = false;
        if (posData.direction === 'LONG' && currentPriceNgn <= posData.liquidationPrice) isLiquidatable = true;
        if (posData.direction === 'SHORT' && currentPriceNgn >= posData.liquidationPrice) isLiquidatable = true;

        if (isLiquidatable) {
            await runTransaction(firestore, async (transaction) => {
                const pRef = doc(firestore, `users/${userId}/perpPositions`, positionId);
                const pDoc = await transaction.get(pRef);
                if (!pDoc.exists() || pDoc.data().status !== 'open') return;

                transaction.update(pRef, { 
                    status: 'liquidated', 
                    closedAt: serverTimestamp(),
                    exitPrice: currentPriceNgn,
                    realizedPnL: -posData.collateral 
                });
            });
            revalidatePath('/perps');
            return { success: true, liquidated: true };
        }
        return { success: true, liquidated: false };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function sweepAllLiquidationsAction() {
    const firestore = getFirestoreInstance();
    try {
        const positionsQuery = query(
            collectionGroup(firestore, 'perpPositions'),
            where('status', '==', 'open')
        );
        const snapshot = await getDocs(positionsQuery);
        
        if (snapshot.empty) return { success: true, message: 'No open positions.' };

        const uniquePairs = Array.from(new Set(snapshot.docs.map(d => d.data().tickerId)));
        const ngnRate = await getLatestUsdNgnRate();
        const prices: Record<string, number> = {};

        for (const pair of uniquePairs) {
            try {
                const usd = await getLiveCryptoPrice(pair);
                prices[pair] = usd * ngnRate;
            } catch (e) {
                console.error(`Failed to get price for ${pair}`);
            }
        }

        let liquidatedCount = 0;
        for (const posDoc of snapshot.docs) {
            const pos = posDoc.data() as PerpPosition;
            const currentPrice = prices[pos.tickerId];
            if (!currentPrice) continue;

            let isBreached = false;
            if (pos.direction === 'LONG' && currentPrice <= pos.liquidationPrice) isBreached = true;
            if (pos.direction === 'SHORT' && currentPrice >= pos.liquidationPrice) isBreached = true;

            if (isBreached) {
                await checkAndLiquidatePosition(pos.userId, posDoc.id);
                liquidatedCount++;
            }
        }

        revalidatePath('/admin');
        return { success: true, message: `Audit complete. ${liquidatedCount} positions liquidated.` };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}