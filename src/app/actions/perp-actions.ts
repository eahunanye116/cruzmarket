'use server';

import { getFirestoreInstance } from '@/firebase/server';
import { doc, collection, runTransaction, serverTimestamp, increment, DocumentReference, getDoc, getDocs, query, where, collectionGroup } from 'firebase/firestore';
import type { UserProfile, PerpPosition, PerpMarket } from '@/lib/types';
import { calculateLiquidationPrice, calculatePerpFees, getSpreadAdjustedPrice, getLiveCryptoPrice } from '@/lib/perp-utils';
import { revalidatePath } from 'next/cache';
import { getLatestUsdNgnRate } from './wallet-actions';

export async function openPerpPositionAction(
    userId: string,
    pairId: string,
    collateral: number,
    leverage: number,
    direction: 'LONG' | 'SHORT'
) {
    const firestore = getFirestoreInstance();
    
    // Strict Leverage Cap
    const effectiveLeverage = Math.min(leverage, 20);
    
    try {
        // 1. Fetch Market Details
        const marketRef = doc(firestore, 'perpMarkets', pairId);
        const marketSnap = await getDoc(marketRef);
        
        if (!marketSnap.exists()) {
            throw new Error("Market no longer available.");
        }
        
        const market = marketSnap.data() as PerpMarket;

        // 2. Fetch Real-time Prices (Server-side Oracle)
        const [usdPrice, ngnRate] = await Promise.all([
            getLiveCryptoPrice(pairId),
            getLatestUsdNgnRate()
        ]);
        
        const currentPriceNgn = usdPrice * ngnRate;

        const result = await runTransaction(firestore, async (transaction) => {
            const userRef = doc(firestore, 'users', userId);
            const userDoc = await transaction.get(userRef as DocumentReference<UserProfile>);
            
            if (!userDoc.exists()) throw new Error('User not found.');
            
            // 3. House Edge: Apply Spread
            const entryPrice = getSpreadAdjustedPrice(currentPriceNgn, direction, false);
            
            // 4. Platform Fees
            const fee = calculatePerpFees(collateral, effectiveLeverage);
            const totalRequired = collateral + fee;
            
            if (userDoc.data().balance < totalRequired) {
                throw new Error(`Insufficient balance. Required: ₦${totalRequired.toLocaleString()}`);
            }

            // 5. High-Precision Liquidation Price
            const liqPrice = calculateLiquidationPrice(direction, entryPrice, effectiveLeverage);
            
            // Check for immediate liquidation (Spread vs Initial Margin vs MM)
            let initialStatus: PerpPosition['status'] = 'open';
            let realizedPnL: number | null = null;
            let exitPrice: number | null = null;
            let closedAt: any = null;

            const isImmediatelyLiquidated = direction === 'LONG' 
                ? currentPriceNgn <= liqPrice 
                : currentPriceNgn >= liqPrice;

            if (isImmediatelyLiquidated) {
                initialStatus = 'liquidated';
                realizedPnL = -collateral;
                exitPrice = currentPriceNgn;
                closedAt = serverTimestamp();
            }

            const positionRef = doc(collection(firestore, `users/${userId}/perpPositions`));
            const positionData: Omit<PerpPosition, 'id'> = {
                userId,
                tickerId: pairId, 
                tickerName: market.symbol,
                tickerIcon: market.icon,
                direction,
                leverage: effectiveLeverage,
                collateral,
                entryPrice,
                entryValue: collateral * effectiveLeverage,
                liquidationPrice: liqPrice,
                status: initialStatus,
                realizedPnL,
                exitPrice,
                closedAt,
                createdAt: serverTimestamp() as any,
            };

            transaction.set(positionRef, positionData);
            transaction.update(userRef, { balance: increment(-totalRequired) });

            return { positionId: positionRef.id, tickerName: market.symbol, isLiquidated: isImmediatelyLiquidated };
        });

        revalidatePath('/perps');
        return { success: true, ...result };
    } catch (error: any) {
        console.error('Failed to open perp:', error);
        return { success: false, error: error.message || 'Trade failed due to invalid data' };
    }
}

export async function closePerpPositionAction(userId: string, positionId: string) {
    const firestore = getFirestoreInstance();
    
    try {
        const result = await runTransaction(firestore, async (transaction) => {
            const positionRef = doc(firestore, `users/${userId}/perpPositions`, positionId);
            const posDoc = await transaction.get(positionRef);
            
            if (!posDoc.exists()) throw new Error('Position not found.');
            const posData = posDoc.data() as PerpPosition;
            if (posData.status !== 'open') throw new Error('Position already closed.');

            return posData;
        });

        const [usdPrice, ngnRate] = await Promise.all([
            getLiveCryptoPrice(result.tickerId),
            getLatestUsdNgnRate()
        ]);
        const currentPriceNgn = usdPrice * ngnRate;

        const finalResult = await runTransaction(firestore, async (transaction) => {
            const positionRef = doc(firestore, `users/${userId}/perpPositions`, positionId);
            const posDoc = await transaction.get(positionRef);
            const posData = posDoc.data() as PerpPosition;

            const exitPrice = getSpreadAdjustedPrice(currentPriceNgn, posData.direction, true);
            
            const priceDiff = posData.direction === 'LONG' 
                ? exitPrice - posData.entryPrice 
                : posData.entryPrice - exitPrice;
            
            const pnlPercent = priceDiff / posData.entryPrice;
            const realizedPnl = (posData.collateral * posData.leverage) * pnlPercent;
            const exitFee = calculatePerpFees(posData.collateral, posData.leverage);
            
            const totalToReturn = Math.max(0, posData.collateral + realizedPnl - exitFee);

            const userRef = doc(firestore, 'users', userId);
            transaction.update(userRef, { 
                balance: increment(totalToReturn),
                totalRealizedPnl: increment(realizedPnl - exitFee)
            });

            transaction.update(positionRef, {
                status: 'closed',
                closedAt: serverTimestamp(),
                exitPrice: exitPrice,
                realizedPnL: realizedPnl - exitFee
            });

            return { realizedPnl: realizedPnl - exitFee, amountReturned: totalToReturn };
        });

        revalidatePath('/perps');
        return { success: true, ...finalResult };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

/**
 * ROBUST LIQUIDATION SENTINEL ACTION
 * Checks a specific position against the Binance Oracle server-side.
 */
export async function checkAndLiquidatePosition(userId: string, positionId: string) {
    const firestore = getFirestoreInstance();
    
    try {
        const positionRef = doc(firestore, `users/${userId}/perpPositions`, positionId);
        const posSnap = await getDoc(positionRef);
        if (!posSnap.exists()) return { success: false, error: 'Position not found' };
        const posData = posSnap.data() as PerpPosition;

        if (posData.status !== 'open') return { success: false, error: 'Position not active' };

        // Server-side Oracle Fetch
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
                    realizedPnL: -posData.collateral // Entire collateral is lost
                });
            });
            revalidatePath('/perps');
            return { success: true, liquidated: true };
        }

        return { success: true, liquidated: false };
    } catch (e: any) {
        console.error("LIQUIDATION_ACTION_ERROR:", e.message);
        return { success: false, error: e.message };
    }
}

/**
 * GLOBAL SWEEP UTILITY
 * Scans all open positions and processes liquidations.
 */
export async function sweepAllLiquidationsAction() {
    const firestore = getFirestoreInstance();
    try {
        const q = query(collectionGroup(firestore, 'perpPositions'), where('status', '==', 'open'));
        const snap = await getDocs(q);
        
        let count = 0;
        for (const docSnap of snap.docs) {
            const data = docSnap.data() as PerpPosition;
            const res = await checkAndLiquidatePosition(data.userId, docSnap.id);
            if (res.success && res.liquidated) count++;
        }
        
        return { success: true, message: `Audit complete. ${count} positions liquidated.` };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}
