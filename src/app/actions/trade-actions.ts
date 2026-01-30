'use server';

import { getFirestoreInstance } from '@/firebase/server';
import { doc, collection, runTransaction, serverTimestamp, arrayUnion, DocumentReference } from 'firebase/firestore';
import type { Ticker, UserProfile, PortfolioHolding, PlatformStats } from '@/lib/types';
import { sub } from 'date-fns';
import { broadcastNewTickerNotification } from './telegram-actions';

const TRANSACTION_FEE_PERCENTAGE = 0.002;
const ADMIN_UID = 'xhYlmnOqQtUNYLgCK6XXm8unKJy1';

const marketCapOptions = {
  '100000': { fee: 1000 },
  '1000000': { fee: 4000 },
  '5000000': { fee: 7000 },
  '10000000': { fee: 9990 },
};

const calculateTrendingScore = (priceChange24h: number, volume24h: number) => {
    const volumeWeight = 0.7;
    const priceChangeWeight = 0.3;
    const volumeScore = Math.log1p(volume24h) * volumeWeight; 
    const priceChangeScore = (priceChange24h > 0 ? priceChange24h : priceChange24h / 2) * priceChangeWeight;
    return volumeScore + priceChangeScore;
};

export async function executeBuyAction(userId: string, tickerId: string, ngnAmount: number) {
    const firestore = getFirestoreInstance();
    
    let resolvedId = tickerId.trim();
    if (resolvedId.toLowerCase().endsWith('cruz') && resolvedId.length > 5) {
        resolvedId = resolvedId.slice(0, -4);
    }
    
    try {
        const result = await runTransaction(firestore, async (transaction) => {
            const userRef = doc(firestore, 'users', userId);
            const tickerRef = doc(firestore, 'tickers', resolvedId);
            const statsRef = doc(firestore, 'stats', 'platform');
            const holdingId = `holding_${resolvedId}`;
            const holdingRef = doc(firestore, `users/${userId}/portfolio`, holdingId);
            
            const userDoc = await transaction.get(userRef as DocumentReference<UserProfile>);
            const tickerDoc = await transaction.get(tickerRef as DocumentReference<Ticker>);
            const statsDoc = await transaction.get(statsRef);
            const holdingDoc = await transaction.get(holdingRef);
            
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

            transaction.update(userRef, { balance: userDoc.data().balance - ngnAmount });

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

export type CreateTickerInput = {
    userId: string;
    name: string;
    icon: string;
    coverImage: string;
    description: string;
    videoUrl?: string;
    supply: number;
    initialMarketCap: number;
    initialBuyNgn: number;
}

export async function executeCreateTickerAction(input: CreateTickerInput) {
    const firestore = getFirestoreInstance();
    const { userId, initialMarketCap, initialBuyNgn } = input;

    const mCapKey = initialMarketCap.toString();
    const creationFee = marketCapOptions[mCapKey as keyof typeof marketCapOptions]?.fee || 0;
    const initialBuyFee = initialBuyNgn * TRANSACTION_FEE_PERCENTAGE;
    const totalCost = creationFee + initialBuyNgn;

    try {
        const result = await runTransaction(firestore, async (transaction) => {
            const userRef = doc(firestore, 'users', userId);
            const statsRef = doc(firestore, 'stats', 'platform');
            const tickersCollectionRef = collection(firestore, 'tickers');
            const activitiesCollection = collection(firestore, 'activities');

            const userDoc = await transaction.get(userRef as DocumentReference<UserProfile>);
            const statsDoc = await transaction.get(statsRef);

            if (!userDoc.exists()) throw new Error('User profile not found.');
            if (userDoc.data().balance < totalCost) {
                throw new Error(`Insufficient balance. You need ₦${totalCost.toLocaleString()}.`);
            }

            const currentTotalFees = statsDoc.data()?.totalFeesGenerated || 0;
            const currentUserFees = statsDoc.data()?.totalUserFees || 0;
            const currentAdminFees = statsDoc.data()?.totalAdminFees || 0;
            const totalFeeForTx = creationFee + initialBuyFee;

            let newUserFees = currentUserFees;
            let newAdminFees = currentAdminFees;
            if (userId === ADMIN_UID) {
                newAdminFees += totalFeeForTx;
            } else {
                newUserFees += totalFeeForTx;
            }

            transaction.set(statsRef, { 
                totalFeesGenerated: currentTotalFees + totalFeeForTx,
                totalUserFees: newUserFees,
                totalAdminFees: newAdminFees
            }, { merge: true });

            transaction.update(userRef, { balance: userDoc.data().balance - totalCost });

            const k = initialMarketCap * input.supply;
            const ngnForCurve = initialBuyNgn - initialBuyFee;
            const finalMarketCap = initialMarketCap + ngnForCurve;
            const finalSupply = k / finalMarketCap;
            const tokensOut = input.supply - finalSupply;
            const finalPrice = finalMarketCap / finalSupply;
            const initialPrice = initialMarketCap / input.supply;
            const avgBuyPrice = initialBuyNgn / tokensOut;

            const newTickerRef = doc(tickersCollectionRef);
            const tickerAddress = `${newTickerRef.id}cruz`;
            const now = new Date();
            
            const tickerData = {
                id: newTickerRef.id,
                name: input.name,
                slug: input.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
                description: input.description,
                icon: input.icon,
                coverImage: input.coverImage,
                videoUrl: input.videoUrl || undefined,
                supply: finalSupply,
                marketCap: finalMarketCap,
                price: finalPrice,
                tickerAddress,
                creatorId: userId,
                createdAt: serverTimestamp(),
                trendingScore: 0,
                priceChange24h: 0,
                volume24h: ngnForCurve,
                isVerified: false,
                chartData: [
                    { time: now.toISOString(), price: initialPrice, volume: 0, marketCap: initialMarketCap },
                    { time: new Date(now.getTime() + 1).toISOString(), price: finalPrice, volume: ngnForCurve, marketCap: finalMarketCap }
                ]
            };

            transaction.set(newTickerRef, tickerData);

            const holdingRef = doc(firestore, `users/${userId}/portfolio`, `holding_${newTickerRef.id}`);
            transaction.set(holdingRef, {
                tickerId: newTickerRef.id,
                amount: tokensOut,
                avgBuyPrice: avgBuyPrice,
                userId: userId,
            });

            transaction.set(doc(activitiesCollection), {
                type: 'CREATE',
                tickerId: newTickerRef.id,
                tickerName: input.name,
                tickerIcon: input.icon,
                value: 0,
                userId: userId,
                createdAt: serverTimestamp(),
            });

            transaction.set(doc(activitiesCollection), {
                type: 'BUY',
                tickerId: newTickerRef.id,
                tickerName: input.name,
                tickerIcon: input.icon,
                value: initialBuyNgn,
                tokenAmount: tokensOut,
                pricePerToken: avgBuyPrice,
                userId: userId,
                createdAt: serverTimestamp(),
            });

            return { tickerId: newTickerRef.id, tickerName: input.name, tickerAddress };
        });

        broadcastNewTickerNotification(result.tickerName, result.tickerAddress, result.tickerId);
        return { success: true, tickerId: result.tickerId };
    } catch (error: any) {
        console.error('Ticker creation failed:', error);
        return { success: false, error: error.message };
    }
}