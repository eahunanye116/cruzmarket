'use server';

import { getFirestoreInstance } from '@/firebase/server';
import { doc, collection, runTransaction, serverTimestamp, increment, DocumentReference, getDoc, getDocs, query, where, collectionGroup } from 'firebase/firestore';
import type { UserProfile, PerpPosition, PerpMarket } from '@/lib/types';
import { calculateLiquidationPrice, getLiveCryptoPrice, CONTRACT_MULTIPLIER, PIP_SPREAD } from '@/lib/perp-utils';
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
        
        // APPLY SPREAD (USD points)
        // 110 Pips means you enter $110 away from the mark price
        const entryPriceUsd = direction === 'LONG' ? usdPrice + PIP_SPREAD : usdPrice - PIP_SPREAD;
        
        // Math is done in USD then converted to NGN for balance
        const positionValueUsd = entryPriceUsd * lots * CONTRACT_MULTIPLIER;
        const requiredMarginNgn = (positionValueUsd * ngnRate) / effectiveLeverage;
        
        // Fee is 0.1% of contract value
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
            
            // Liquidation check based on Mark Price (current oracle)
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
                collateral: requiredMarginNgn, // Locked NGN
                entryPrice: entryPriceUsd,    // Stored in USD
                entryValue: positionValueUsd * ngnRate, 
                liquidationPrice: liqPriceUsd, // Stored in USD
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

        // When closing, we give the user the Mark Price (no extra closing spread for now to keep it simple)
        // PnL = (Exit - Entry) * Lots * Multiplier
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

        const usdPrice = await getLiveCryptoPrice(posData.tickerId);

        let isLiquidatable = false;
        if (posData.direction === 'LONG' && usdPrice <= posData.liquidationPrice) isLiquidatable = true;
        if (posData.direction === 'SHORT' && usdPrice >= posData.liquidationPrice) isLiquidatable = true;

        if (isLiquidatable) {
            await runTransaction(firestore, async (transaction) => {
                const pRef = doc(firestore, `users/${userId}/perpPositions`, positionId);
                const pDoc = await transaction.get(pRef);
                if (!pDoc.exists() || pDoc.data().status !== 'open') return;

                transaction.update(pRef, { 
                    status: 'liquidated', 
                    closedAt: serverTimestamp(),
                    exitPrice: usdPrice,
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
        const prices: Record<string, number> = {};

        for (const pair of uniquePairs) {
            try {
                prices[pair] = await getLiveCryptoPrice(pair);
            } catch (e) {
                console.error(`Failed to get price for ${pair}`);
            }
        }

        let liquidatedCount = 0;
        for (const posDoc of snapshot.docs) {
            const pos = posDoc.data() as PerpPosition;
            const currentPriceUsd = prices[pos.tickerId];
            if (!currentPriceUsd) continue;

            let isBreached = false;
            if (pos.direction === 'LONG' && currentPriceUsd <= pos.liquidationPrice) isBreached = true;
            if (pos.direction === 'SHORT' && currentPriceUsd >= pos.liquidationPrice) isBreached = true;

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
