'use server';

import { getFirestoreInstance } from '@/firebase/server';
import { doc, collection, runTransaction, serverTimestamp, getDoc, increment, DocumentReference } from 'firebase/firestore';
import type { Ticker, UserProfile, PerpPosition } from '@/lib/types';
import { calculateLiquidationPrice, calculatePerpFees, getSpreadAdjustedPrice } from '@/lib/perp-utils';
import { revalidatePath } from 'next/cache';

const MAX_HOUSE_EXPOSURE_PER_TICKER = 5000000; // ₦5M max exposure per ticker

export async function openPerpPositionAction(
    userId: string,
    tickerId: string,
    collateral: number,
    leverage: number,
    direction: 'LONG' | 'SHORT'
) {
    const firestore = getFirestoreInstance();
    
    try {
        const result = await runTransaction(firestore, async (transaction) => {
            const userRef = doc(firestore, 'users', userId);
            const tickerRef = doc(firestore, 'tickers', tickerId);
            
            const userDoc = await transaction.get(userRef as DocumentReference<UserProfile>);
            const tickerDoc = await transaction.get(tickerRef as DocumentReference<Ticker>);
            
            if (!userDoc.exists()) throw new Error('User not found.');
            if (!tickerDoc.exists()) throw new Error('Ticker not found.');
            
            const tickerData = tickerDoc.data();
            const currentPrice = tickerData.price;
            
            // 1. House Edge: Apply Spread
            const entryPrice = getSpreadAdjustedPrice(currentPrice, direction, false);
            
            // 2. Platform Fees: 0.1% of position size
            const fee = calculatePerpFees(collateral, leverage);
            const totalRequired = collateral + fee;
            
            if (userDoc.data().balance < totalRequired) {
                throw new Error(`Insufficient balance. Required: ₦${totalRequired.toLocaleString()}`);
            }

            // 3. Risk Check: Global Open Interest
            // We use a simplified check here, in production we'd track global open interest docs
            
            const liqPrice = calculateLiquidationPrice(direction, entryPrice, leverage);
            
            const positionRef = doc(collection(firestore, `users/${userId}/perpPositions`));
            const positionData: Omit<PerpPosition, 'id'> = {
                userId,
                tickerId,
                tickerName: tickerData.name,
                tickerIcon: tickerData.icon,
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
            
            // Deduct from balance
            transaction.update(userRef, { 
                balance: increment(-totalRequired)
            });

            // Log activity
            const activityRef = doc(collection(firestore, 'activities'));
            transaction.set(activityRef, {
                type: 'PERP_OPEN',
                tickerId,
                tickerName: tickerData.name,
                tickerIcon: tickerData.icon,
                value: collateral,
                fee: fee,
                leverage,
                direction,
                userId,
                createdAt: serverTimestamp(),
            });

            return { positionId: positionRef.id, tickerName: tickerData.name };
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

            const tickerRef = doc(firestore, 'tickers', posData.tickerId);
            const tickerDoc = await transaction.get(tickerRef as DocumentReference<Ticker>);
            if (!tickerDoc.exists()) throw new Error('Market unavailable.');
            
            const tickerData = tickerDoc.data();
            const currentPrice = tickerData.price;
            
            // 1. House Edge: Apply Exit Spread
            const exitPrice = getSpreadAdjustedPrice(currentPrice, posData.direction, true);
            
            // 2. Calculate PnL
            const priceDiff = posData.direction === 'LONG' 
                ? exitPrice - posData.entryPrice 
                : posData.entryPrice - exitPrice;
            
            const pnlPercent = priceDiff / posData.entryPrice;
            const realizedPnl = (posData.collateral * posData.leverage) * pnlPercent;
            
            // 3. Exit Fee
            const exitFee = calculatePerpFees(posData.collateral, posData.leverage);
            
            const totalToReturn = Math.max(0, posData.collateral + realizedPnl - exitFee);

            // Update user balance
            const userRef = doc(firestore, 'users', userId);
            transaction.update(userRef, { 
                balance: increment(totalToReturn),
                totalRealizedPnl: increment(realizedPnl - exitFee)
            });

            // Update position
            transaction.update(positionRef, {
                status: 'closed',
                closedAt: serverTimestamp(),
                exitPrice: exitPrice,
                realizedPnL: realizedPnl - exitFee
            });

            // Log activity
            const activityRef = doc(collection(firestore, 'activities'));
            transaction.set(activityRef, {
                type: 'PERP_CLOSE',
                tickerId: posData.tickerId,
                tickerName: posData.tickerName,
                tickerIcon: posData.tickerIcon,
                value: totalToReturn,
                realizedPnl: realizedPnl - exitFee,
                fee: exitFee,
                userId,
                createdAt: serverTimestamp(),
            });

            return { realizedPnl: realizedPnl - exitFee, amountReturned: totalToReturn };
        });

        revalidatePath('/perps');
        revalidatePath('/transactions');
        return { success: true, ...result };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function checkAndLiquidatePosition(userId: string, positionId: string) {
    // This action would ideally be called by an automated bot or the admin panel
    const firestore = getFirestoreInstance();
    
    try {
        await runTransaction(firestore, async (transaction) => {
            const positionRef = doc(firestore, `users/${userId}/perpPositions`, positionId);
            const posDoc = await transaction.get(positionRef);
            if (!posDoc.exists()) return;
            const posData = posDoc.data() as PerpPosition;
            if (posData.status !== 'open') return;

            const tickerDoc = await transaction.get(doc(firestore, 'tickers', posData.tickerId));
            if (!tickerDoc.exists()) return;
            const currentPrice = tickerDoc.data().price;

            let isLiquidatable = false;
            if (posData.direction === 'LONG' && currentPrice <= posData.liquidationPrice) isLiquidatable = true;
            if (posData.direction === 'SHORT' && currentPrice >= posData.liquidationPrice) isLiquidatable = true;

            if (isLiquidatable) {
                transaction.update(positionRef, { status: 'liquidated', closedAt: serverTimestamp() });
                
                const activityRef = doc(collection(firestore, 'activities'));
                transaction.set(activityRef, {
                    type: 'PERP_LIQUIDATE',
                    tickerId: posData.tickerId,
                    tickerName: posData.tickerName,
                    userId,
                    value: posData.collateral,
                    createdAt: serverTimestamp(),
                });
            }
        });
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}