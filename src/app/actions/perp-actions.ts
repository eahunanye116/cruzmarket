'use server';

import { getFirestoreInstance } from '@/firebase/server';
import { doc, collection, runTransaction, serverTimestamp, increment, DocumentReference, getDoc } from 'firebase/firestore';
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
    
    try {
        // 1. Fetch Market Details from Firestore
        const marketRef = doc(firestore, 'perpMarkets', pairId);
        const marketSnap = await getDoc(marketRef);
        
        if (!marketSnap.exists()) {
            throw new Error("Market no longer available.");
        }
        
        const market = marketSnap.data() as PerpMarket;

        // 2. Fetch Real-time Prices
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
            
            // 4. Platform Fees: 0.1% of position size
            const fee = calculatePerpFees(collateral, leverage);
            const totalRequired = collateral + fee;
            
            if (userDoc.data().balance < totalRequired) {
                throw new Error(`Insufficient balance. Required: ₦${totalRequired.toLocaleString()}`);
            }

            const liqPrice = calculateLiquidationPrice(direction, entryPrice, leverage);
            
            const positionRef = doc(collection(firestore, `users/${userId}/perpPositions`));
            const positionData: Omit<PerpPosition, 'id'> = {
                userId,
                tickerId: pairId, 
                tickerName: market.symbol,
                tickerIcon: market.icon,
                direction,
                leverage,
                collateral,
                entryPrice,
                entryValue: collateral * leverage,
                liquidationPrice: liqPrice,
                status: 'open',
                createdAt: serverTimestamp() as any,
            };

            transaction.set(positionRef, positionData);
            transaction.update(userRef, { balance: increment(-totalRequired) });

            return { positionId: positionRef.id, tickerName: market.symbol };
        });

        revalidatePath('/perps');
        revalidatePath('/transactions');
        return { success: true, ...result };
    } catch (error: any) {
        console.error('Failed to open perp:', error);
        return { success: false, error: error.message };
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
        revalidatePath('/transactions');
        return { success: true, ...finalResult };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function checkAndLiquidatePosition(userId: string, positionId: string) {
    const firestore = getFirestoreInstance();
    
    try {
        const positionRef = doc(firestore, `users/${userId}/perpPositions`, positionId);
        const posSnap = await getDoc(positionRef);
        if (!posSnap.exists()) return { success: false, error: 'Not found' };
        const posData = posSnap.data() as PerpPosition;

        const [usdPrice, ngnRate] = await Promise.all([
            getLiveCryptoPrice(posData.tickerId),
            getLatestUsdNgnRate()
        ]);
        const currentPriceNgn = usdPrice * ngnRate;

        await runTransaction(firestore, async (transaction) => {
            const pRef = doc(firestore, `users/${userId}/perpPositions`, positionId);
            const pDoc = await transaction.get(pRef);
            if (!pDoc.exists() || pDoc.data().status !== 'open') return;

            let isLiquidatable = false;
            if (posData.direction === 'LONG' && currentPriceNgn <= posData.liquidationPrice) isLiquidatable = true;
            if (posData.direction === 'SHORT' && currentPriceNgn >= posData.liquidationPrice) isLiquidatable = true;

            if (isLiquidatable) {
                transaction.update(pRef, { status: 'liquidated', closedAt: serverTimestamp() });
            }
        });
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}
