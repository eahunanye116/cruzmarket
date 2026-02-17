
'use server';

import { getFirestoreInstance } from '@/firebase/server';
import { collection, addDoc, serverTimestamp, doc, updateDoc, runTransaction, increment, getDocs, query, where, writeBatch, setDoc } from 'firebase/firestore';
import { revalidatePath } from 'next/cache';
import type { PredictionMarket, MarketPosition, UserProfile } from '@/lib/types';

// The "Thickness" of the market. Higher = more money needed to move the price.
const MARKET_LIQUIDITY_FACTOR = 50000; 

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
             * IMPROVED PRICING MATH:
             * 1. Calculate price impact proportional to amount.
             * 2. Calculate execution price as the mid-point (Slippage).
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
    sharesToSell: number
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

            if (!posSnap.exists()) throw new Error("You don't have any shares to sell.");
            const pos = posSnap.data() as MarketPosition;
            if (pos.shares < sharesToSell) throw new Error("Insufficient shares.");

            const currentPrice = market.outcomes[outcome].price;
            
            /**
             * SELL MATH:
             * Calculate how much the price drops and pay the average.
             */
            const estimatedNgnValue = sharesToSell * (currentPrice / 100) * (MARKET_LIQUIDITY_FACTOR / 10); // Rough estimate for impact calc
            const priceImpact = (estimatedNgnValue / MARKET_LIQUIDITY_FACTOR) * 100;
            const newPrice = Math.max(1, currentPrice - priceImpact);
            const executionPrice = (currentPrice + newPrice) / 2;
            const ngnReturn = sharesToSell * executionPrice;

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

            if (pos.shares === sharesToSell) {
                transaction.delete(posRef);
            } else {
                transaction.update(posRef, {
                    shares: increment(-sharesToSell)
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
