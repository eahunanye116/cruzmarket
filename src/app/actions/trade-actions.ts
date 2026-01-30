'use server';

import { getFirestoreInstance } from '@/firebase/server';
import { doc, collection, runTransaction, serverTimestamp, arrayUnion, DocumentReference } from 'firebase/firestore';
import type { Ticker, UserProfile, PortfolioHolding } from '@/lib/types';
import { sub } from 'date-fns';

const TRANSACTION_FEE_PERCENTAGE = 0.002;
const ADMIN_UID = 'xhYlmnOqQtUNYLgCK6XXm8unKJy1';

const calculateTrendingScore = (priceChange24h: number, volume24h: number) => {
    const volumeWeight = 0.7;
    const priceChangeWeight = 0.3;
    const volumeScore = Math.log1p(volume24h) * volumeWeight; 
    const priceChangeScore = (priceChange24h > 0 ? priceChange24h : priceChange24h / 2) * priceChangeWeight;
    return volumeScore + priceChangeScore;
};

export async function executeBuyAction(userId: string, tickerId: string, ngnAmount: number) {
    const firestore = getFirestoreInstance();
    
    // Resolve actual ID from address if needed. 
    // Public addresses end in 'cruz' (e.g., 'IDcruz'). We strip 'cruz' to get the internal document ID.
    let resolvedId = tickerId.trim();
    if (resolvedId.toLowerCase().endsWith('cruz') && resolvedId.length > 5) {
        resolvedId = resolvedId.slice(0, -4);
    }
    
    try {
        const result = await runTransaction(firestore, async (transaction) => {
            const userRef = doc(firestore, 'users', userId);
            const tickerRef = doc(firestore, 'tickers', resolvedId);
            const statsRef = doc(firestore, 'stats', 'platform');
            
            const userDoc = await transaction.get(userRef as DocumentReference<UserProfile>);
            const tickerDoc = await transaction.get(tickerRef as DocumentReference<Ticker>);
            const statsDoc = await transaction.get(statsRef);
            
            if (!userDoc.exists()) throw new Error('User not found.');
            if (userDoc.data().balance < ngnAmount) throw new Error('Insufficient balance.');
            if (!tickerDoc.exists()) throw new Error('Ticker not found.');
            
            const tickerData = tickerDoc.data();
            const fee = ngnAmount * TRANSACTION_FEE_PERCENTAGE;
            const ngnForCurve = ngnAmount - fee;
            
            const k = tickerData.marketCap * tickerData.supply;
            const newMarketCap = tickerData.marketCap + ngnForCurve;
            const newSupply = k / newMarketCap;
            const tokensOut = tickerData.supply - newSupply;
            const finalPrice = newMarketCap / newSupply;
            const avgBuyPrice = ngnAmount / tokensOut;

            if (tokensOut <= 0) throw new Error("Trade resulted in 0 tokens.");

            // Update Stats
            const currentTotalFees = statsDoc.data()?.totalFeesGenerated || 0;
            const currentUserFees = statsDoc.data()?.totalUserFees || 0;
            const currentAdminFees = statsDoc.data()?.totalAdminFees || 0;
            let newUserFees = currentUserFees;
            let newAdminFees = currentAdminFees;
            if (userId === ADMIN_UID) {
                newAdminFees += fee;
            } else {
                newUserFees += fee;
            }
            transaction.set(statsRef, { 
                totalFeesGenerated: currentTotalFees + fee,
                totalUserFees: newUserFees,
                totalAdminFees: newAdminFees,
            }, { merge: true });

            // Update User Balance
            transaction.update(userRef, { balance: userDoc.data().balance - ngnAmount });

            // Update Portfolio with predictable ID
            const holdingId = `holding_${resolvedId}`;
            const holdingRef = doc(firestore, `users/${userId}/portfolio`, holdingId);
            const holdingDoc = await transaction.get(holdingRef);

            if (holdingDoc.exists()) {
                const currentHolding = holdingDoc.data() as PortfolioHolding;
                const newAmount = currentHolding.amount + tokensOut;
                const newTotalCost = (currentHolding.avgBuyPrice * currentHolding.amount) + ngnAmount;
                const newAvgBuyPrice = newTotalCost / newAmount;
                transaction.update(holdingRef, { amount: newAmount, avgBuyPrice: newAvgBuyPrice });
            } else {
                transaction.set(holdingRef, {
                    tickerId: resolvedId,
                    amount: tokensOut,
                    avgBuyPrice: avgBuyPrice,
                    userId: userId
                });
            }

            const now = new Date();
            const twentyFourHoursAgo = sub(now, { hours: 24 });
            const price24hAgoDataPoint = tickerData.chartData?.find(d => new Date(d.time) <= twentyFourHoursAgo) || tickerData.chartData?.[0];
            const price24hAgo = price24hAgoDataPoint?.price || tickerData.price;
            const priceChange24h = price24hAgo > 0 ? ((finalPrice - price24hAgo) / price24hAgo) * 100 : 0;
            const volume24h = (tickerData.volume24h || 0) + ngnForCurve;
            const trendingScore = calculateTrendingScore(priceChange24h, volume24h);

            transaction.update(tickerRef, { 
                price: finalPrice,
                marketCap: newMarketCap,
                supply: newSupply,
                volume24h,
                priceChange24h,
                trendingScore,
                chartData: arrayUnion({
                    time: now.toISOString(),
                    price: finalPrice,
                    volume: ngnForCurve,
                    marketCap: newMarketCap,
                })
            });

            const activityRef = doc(collection(firestore, 'activities'));
            transaction.set(activityRef, {
                type: 'BUY',
                tickerId: resolvedId,
                tickerName: tickerData.name,
                tickerIcon: tickerData.icon,
                value: ngnAmount,
                tokenAmount: tokensOut,
                pricePerToken: avgBuyPrice,
                userId: userId,
                createdAt: serverTimestamp(),
            });

            return { success: true, tokensOut, tickerName: tickerData.name };
        });

        return result;
    } catch (error: any) {
        console.error('Trade execution failed:', error);
        return { success: false, error: error.message };
    }
}
