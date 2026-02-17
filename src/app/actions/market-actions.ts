
'use server';

import { getFirestoreInstance } from '@/firebase/server';
import { collection, addDoc, serverTimestamp, doc, updateDoc, runTransaction, increment, getDoc, setDoc } from 'firebase/firestore';
import { revalidatePath } from 'next/cache';
import type { PredictionMarket, MarketPosition, UserProfile, MarketSettings } from '@/lib/types';

// Default "Thickness" if not found in DB
const DEFAULT_LIQUIDITY_FACTOR = 40000000; 

export async function updateMarketSettingsAction(liquidityFactor: number) {
    const firestore = getFirestoreInstance();
    try {
        await setDoc(doc(firestore, 'settings', 'markets'), { liquidityFactor }, { merge: true });
        revalidatePath('/admin');
        revalidatePath('/betting');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

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
            const settingsRef = doc(firestore, 'settings', 'markets');

            const [marketSnap, userSnap, posSnap, settingsSnap] = await Promise.all([
                transaction.get(marketRef),
                transaction.get(userRef),
                transaction.get(posRef),
                transaction.get(settingsRef)
            ]);

            if (!marketSnap.exists()) throw new Error("Market not found.");
            const market = marketSnap.data() as PredictionMarket;
            if (market.status !== 'open') throw new Error("Market is closed.");

            const liquidityFactor = settingsSnap.exists() ? (settingsSnap.data().liquidityFactor || DEFAULT_LIQUIDITY_FACTOR) : DEFAULT_LIQUIDITY_FACTOR;

            const userData = userSnap.data() as UserProfile;
            const totalAvailable = (userData.balance || 0) + (userData.bonusBalance || 0);
            if (totalAvailable < ngnAmount) throw new Error("Insufficient balance.");

            const currentPrice = market.outcomes[outcome].price;
            
            const priceImpact = (ngnAmount / liquidityFactor) * 100;
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
    positionId?: string 
) {
    const firestore = getFirestoreInstance();
    try {
        const result = await runTransaction(firestore, async (transaction) => {
            const marketRef = doc(firestore, 'markets', marketId);
            const userRef = doc(firestore, 'users', userId);
            const settingsRef = doc(firestore, 'settings', 'markets');
            
            const posId = positionId || `${marketId}_${outcome}`;
            const posRef = doc(firestore, `users/${userId}/marketPositions`, posId);

            const [marketSnap, userSnap, posSnap, settingsSnap] = await Promise.all([
                transaction.get(marketRef),
                transaction.get(userRef),
                transaction.get(posRef),
                transaction.get(settingsRef)
            ]);

            if (!marketSnap.exists()) throw new Error("Market not found.");
            const market = marketSnap.data() as PredictionMarket;
            if (market.status !== 'open') throw new Error("Market is closed.");

            if (!posSnap.exists()) throw new Error("You don't have any shares to sell.");
            const pos = posSnap.data() as MarketPosition;
            if (pos.shares < sharesToSell - 0.000001) throw new Error("Insufficient shares.");

            const liquidityFactor = settingsSnap.exists() ? (settingsSnap.data().liquidityFactor || DEFAULT_LIQUIDITY_FACTOR) : DEFAULT_LIQUIDITY_FACTOR;

            const currentPrice = market.outcomes[outcome].price;
            
            const ngnReturn = (sharesToSell * currentPrice) / (1 + (50 * sharesToSell / liquidityFactor));
            const priceImpact = (ngnReturn / liquidityFactor) * 100;
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
