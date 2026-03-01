'use server';

import { getFirestoreInstance } from '@/firebase/server';
import { collection, addDoc, serverTimestamp, doc, updateDoc, runTransaction, increment, getDoc, setDoc } from 'firebase/firestore';
import { revalidatePath } from 'next/cache';
import type { PredictionMarket, MarketPosition, UserProfile, MarketSettings } from '@/lib/types';

// Default "Thickness" if not found in DB
const DEFAULT_LIQUIDITY_FACTOR = 40000000; 
const MARKET_FEE_PERCENTAGE = 0.01; // 1% Fee

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
    initialPrice?: number;
}) {
    const firestore = getFirestoreInstance();
    const yesPrice = payload.initialPrice || 50;
    const noPrice = 100 - yesPrice;

    try {
        await addDoc(collection(firestore, 'markets'), {
            ...payload,
            status: 'open',
            createdAt: serverTimestamp(),
            volume: 0,
            outcomes: {
                yes: { id: 'yes', label: 'Yes', price: yesPrice, totalShares: 0 },
                no: { id: 'no', label: 'No', price: noPrice, totalShares: 0 }
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
            const statsRef = doc(firestore, 'stats', 'platform');

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

            // Calculate Fee
            const fee = ngnAmount * MARKET_FEE_PERCENTAGE;
            const ngnForCurve = ngnAmount - fee;

            const currentPrice = market.outcomes[outcome].price;
            
            const priceImpact = (ngnForCurve / liquidityFactor) * 100;
            const newPrice = Math.min(99, Math.max(1, currentPrice + priceImpact));
            const executionPrice = (currentPrice + newPrice) / 2;
            const shares = ngnForCurve / executionPrice;

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
                volume: increment(ngnForCurve)
            });

            // Update Global Stats - Using set with merge to ensure it exists
            transaction.set(statsRef, {
                totalFeesGenerated: increment(fee),
                totalMarketFees: increment(fee),
                totalMarketVolume: increment(ngnForCurve)
            }, { merge: true });

            if (posSnap.exists()) {
                const existingPos = posSnap.data() as MarketPosition;
                const totalShares = existingPos.shares + shares;
                const totalCost = (existingPos.avgPrice * existingPos.shares) + ngnForCurve;
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
                fee: fee,
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
            const statsRef = doc(firestore, 'stats', 'platform');
            
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
            
            const ngnReturnBeforeFee = (sharesToSell * currentPrice) / (1 + (50 * sharesToSell / liquidityFactor));
            const fee = ngnReturnBeforeFee * MARKET_FEE_PERCENTAGE;
            const ngnToUser = ngnReturnBeforeFee - fee;

            const priceImpact = (ngnReturnBeforeFee / liquidityFactor) * 100;
            const newPrice = Math.max(1, currentPrice - priceImpact);
            const oppOutcome = outcome === 'yes' ? 'no' : 'yes';
            const oppPrice = 100 - newPrice;

            transaction.update(userRef, {
                balance: increment(ngnToUser)
            });

            transaction.update(marketRef, {
                [`outcomes.${outcome}.price`]: newPrice,
                [`outcomes.${outcome}.totalShares`]: increment(-sharesToSell),
                [`outcomes.${oppOutcome}.price`]: oppPrice,
                volume: increment(ngnReturnBeforeFee)
            });

            // Update Global Stats - Using set with merge
            transaction.set(statsRef, {
                totalFeesGenerated: increment(fee),
                totalMarketFees: increment(fee),
                totalMarketVolume: increment(ngnReturnBeforeFee)
            }, { merge: true });

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
                value: ngnReturnBeforeFee,
                fee: fee,
                userId,
                marketId,
                outcome,
                createdAt: serverTimestamp()
            });

            return { ngnReturn: ngnToUser };
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
