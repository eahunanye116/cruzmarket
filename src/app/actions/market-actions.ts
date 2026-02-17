
'use server';

import { getFirestoreInstance } from '@/firebase/server';
import { collection, addDoc, serverTimestamp, doc, updateDoc, runTransaction, increment, getDocs, query, where, writeBatch, setDoc } from 'firebase/firestore';
import { revalidatePath } from 'next/cache';
import type { PredictionMarket, MarketPosition, UserProfile } from '@/lib/types';

// The "Thickness" of the market. Higher = more money needed to move the price.
// Increased to 1,000,000 to handle 100k+ trades with reasonable slippage.
const MARKET_LIQUIDITY_FACTOR = 1000000; 

export async function createMarketAction(payload: {
    question: string;
    description: string;
    image: string;
    category: string;
    endsAt: Date;
}) {
    const firestore = getFirestoreInstance();
    try {
        await addDoc(collection(firestore, 'markets'), {
            ...payload,
            status: 'open',
            createdAt: serverTimestamp(),
            volume: 0,
            outcomes: {
                yes: { id: 'yes', label: 'Yes', price: 50, totalShares: 0 },
                no: { id: 'no', label: 'No', price: 50, totalShares: 0 }
            }
        });
        revalidatePath('/admin');
        revalidatePath('/betting');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function buyMarketSharesAction(
    userId: string,
    marketId: string,
    outcome: 'yes' | 'no',
    ngnAmount: number
) {
    const firestore = getFirestoreInstance();
    try {
        const result = await runTransaction(firestore, async (transaction) => {
            const marketRef = doc(firestore, 'markets', marketId);
            const userRef = doc(firestore, 'users', userId);
            const posRef = doc(firestore, `users/${userId}/marketPositions`, `${marketId}_${outcome}`);

            const [marketSnap, userSnap, posSnap] = await Promise.all([
                transaction.get(marketRef),
                transaction.get(userRef),
                transaction.get(posRef)
            ]);

            if (!marketSnap.exists()) throw new Error("Market not found.");
            const market = marketSnap.data() as PredictionMarket;
            if (market.status !== 'open') throw new Error("Market is closed.");

            const userData = userSnap.data() as UserProfile;
            const totalAvailable = (userData.balance || 0) + (userData.bonusBalance || 0);
            if (totalAvailable < ngnAmount) throw new Error("Insufficient balance.");

            const currentPrice = market.outcomes[outcome].price;
            
            /**
             * IMPROVED PRICING MATH (Linear Slippage):
             * 1. Calculate price impact proportional to amount.
             * 2. Execution price is the mid-point between start and end prices.
             */
            const priceImpact = (ngnAmount / MARKET_LIQUIDITY_FACTOR) * 100;
            const newPrice = Math.min(99, Math.max(1, currentPrice + priceImpact));
            const executionPrice = (currentPrice + newPrice) / 2;
            const shares = ngnAmount / executionPrice;

            const oppOutcome = outcome === 'yes' ? 'no' : 'yes';
            const oppPrice = 100 - newPrice;

            // Spend logic
            const spendFromBonus = Math.min(userData.bonusBalance || 0, ngnAmount);
            const spendFromMain = ngnAmount - spendFromBonus;

            transaction.update(userRef, {
                balance: increment(-spendFromMain),
                bonusBalance: increment(-spendFromBonus)
            });

            transaction.update(marketRef, {
                [`outcomes.${outcome}.price`]: newPrice,
                [`outcomes.${outcome}.totalShares`]: increment(shares),
                [`outcomes.${oppOutcome}.price`]: oppPrice,
                volume: increment(ngnAmount)
            });

            if (posSnap.exists()) {
                const existingPos = posSnap.data() as MarketPosition;
                const totalShares = existingPos.shares + shares;
                const totalCost = (existingPos.avgPrice * existingPos.shares) + ngnAmount;
                transaction.update(posRef, {
                    shares: totalShares,
                    avgPrice: totalCost / totalShares
                });
            } else {
                transaction.set(posRef, {
                    marketId,
                    userId,
                    outcome,
                    shares,
                    avgPrice: executionPrice,
                    status: 'active',
                    createdAt: serverTimestamp()
                });
            }

            transaction.set(doc(collection(firestore, 'activities')), {
                type: 'MARKET_BUY',
                value: ngnAmount,
                userId,
                marketId,
                outcome,
                createdAt: serverTimestamp()
            });

            return { shares };
        });

        revalidatePath('/betting');
        revalidatePath(`/betting/${marketId}`);
        return { success: true, ...result };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function sellMarketSharesAction(
    userId: string,
    marketId: string,
    outcome: 'yes' | 'no',
    sharesToSell: number,
    positionId?: string // Preferred lookup method
) {
    const firestore = getFirestoreInstance();
    try {
        const result = await runTransaction(firestore, async (transaction) => {
            const marketRef = doc(firestore, 'markets', marketId);
            const userRef = doc(firestore, 'users', userId);
            
            // Try to find the position by ID or composite key
            const posId = positionId || `${marketId}_${outcome}`;
            const posRef = doc(firestore, `users/${userId}/marketPositions`, posId);

            const [marketSnap, userSnap, posSnap] = await Promise.all([
                transaction.get(marketRef),
                transaction.get(userRef),
                transaction.get(posRef)
            ]);

            if (!marketSnap.exists()) throw new Error("Market not found.");
            const market = marketSnap.data() as PredictionMarket;
            if (market.status !== 'open') throw new Error("Market is closed.");

            if (!posSnap.exists()) throw new Error("You don't have any shares to sell.");
            const pos = posSnap.data() as MarketPosition;
            if (pos.shares < sharesToSell - 0.000001) throw new Error("Insufficient shares.");

            const currentPrice = market.outcomes[outcome].price;
            
            /**
             * SELL MATH:
             * Solve for Investment (I) where:
             * Shares = I / ( (P_start + (P_start + (I/Liq)*100)) / 2 )
             * Yields: I = (Shares * P_start) / (1 + (50 * Shares / Liquidity))
             * (Where I is negative since we are taking money OUT)
             */
            const ngnReturn = (sharesToSell * currentPrice) / (1 + (50 * sharesToSell / MARKET_LIQUIDITY_FACTOR));
            const priceImpact = (ngnReturn / MARKET_LIQUIDITY_FACTOR) * 100;
            const newPrice = Math.max(1, currentPrice - priceImpact);
            const oppOutcome = outcome === 'yes' ? 'no' : 'yes';
            const oppPrice = 100 - newPrice;

            transaction.update(userRef, {
                balance: increment(ngnReturn)
            });

            transaction.update(marketRef, {
                [`outcomes.${outcome}.price`]: newPrice,
                [`outcomes.${outcome}.totalShares`]: increment(-sharesToSell),
                [`outcomes.${oppOutcome}.price`]: oppPrice,
                volume: increment(ngnReturn)
            });

            const remainingShares = pos.shares - sharesToSell;
            if (remainingShares < 0.000001) {
                transaction.delete(posRef);
            } else {
                transaction.update(posRef, {
                    shares: remainingShares
                });
            }

            transaction.set(doc(collection(firestore, 'activities')), {
                type: 'MARKET_SELL',
                value: ngnReturn,
                userId,
                marketId,
                outcome,
                createdAt: serverTimestamp()
            });

            return { ngnReturn };
        });

        revalidatePath('/betting');
        revalidatePath(`/betting/${marketId}`);
        return { success: true, ...result };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function resolveMarketAction(marketId: string, winningOutcome: 'yes' | 'no') {
    const firestore = getFirestoreInstance();
    try {
        const marketRef = doc(firestore, 'markets', marketId);
        await updateDoc(marketRef, {
            status: 'resolved',
            winningOutcome,
            resolvedAt: serverTimestamp()
        });
        
        revalidatePath('/admin');
        revalidatePath('/betting');
        return { success: true, message: "Market resolved. Winners can now see their payouts." };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}
