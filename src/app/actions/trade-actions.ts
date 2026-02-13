
'use server';

import { getFirestoreInstance } from '@/firebase/server';
import { doc, collection, runTransaction, serverTimestamp, arrayUnion, DocumentReference, increment, getDocs, query, where, getDoc, limit, collectionGroup, addDoc } from 'firebase/firestore';
import type { Ticker, UserProfile, PortfolioHolding, PlatformStats, CopyTarget } from '@/lib/types';
import { sub } from 'date-fns';
import { broadcastNewTickerNotification } from './telegram-actions';
import { createSystemNotification } from './notification-actions';
import { revalidatePath } from 'next/cache';

const TRANSACTION_FEE_PERCENTAGE = 0.002;
const ADMIN_UID = 'xhYlmnOqQtUNYLgCK6XXm8unKJy1';

const calculateTrendingScore = (priceChange24h: number, volume24h: number) => {
    const volumeWeight = 0.7;
    const priceChangeWeight = 0.3;
    const volumeScore = Math.log1p(volume24h) * volumeWeight; 
    const priceChangeScore = (priceChange24h > 0 ? priceChange24h : priceChange24h / 2) * priceChangeWeight;
    return volumeScore + priceChangeWeight;
};

async function resolveTickerId(firestore: any, inputId: string): Promise<string> {
    const cleanId = inputId.trim();
    if (cleanId.length === 20 && !cleanId.includes(' ')) {
        const directRef = doc(firestore, 'tickers', cleanId);
        const directSnap = await getDoc(directRef);
        if (directSnap.exists()) return cleanId;
    }
    if (cleanId.toLowerCase().endsWith('cruz') && cleanId.length > 5) {
        const strippedId = cleanId.slice(0, -4);
        const strippedRef = doc(firestore, 'tickers', strippedId);
        const strippedSnap = await getDoc(strippedRef);
        if (strippedSnap.exists()) return strippedId;
    }
    return cleanId;
}

/**
 * Trigger trades for all users copying the source user.
 * This is the high-reliability fan-out engine.
 */
async function triggerCopyTrades(sourceUid: string, tickerId: string, type: 'BUY' | 'SELL', sourceUserTotalHeldBefore?: number, sourceAmountSold?: number) {
    const firestore = getFirestoreInstance();
    
    try {
        console.log(`[CopyTrading] Initiating fan-out for source ${sourceUid} on ${tickerId}...`);
        
        const q = query(
            collectionGroup(firestore, 'copyTargets'),
            where('targetUid', '==', sourceUid),
            where('isActive', '==', true),
            limit(100) 
        );
        
        const snapshot = await getDocs(q);
        
        if (snapshot.empty) {
            console.log(`[CopyTrading] No active followers found for source ${sourceUid}.`);
            return;
        }

        console.log(`[CopyTrading] Found ${snapshot.size} active followers. Executing trade replication...`);

        const tradePromises = snapshot.docs.map(async (targetDoc) => {
            const settings = targetDoc.data() as CopyTarget;
            const followerId = targetDoc.ref.parent.parent?.id;
            
            if (!followerId || followerId === sourceUid) return { followerId, status: 'skipped', reason: 'self-copy' };

            try {
                if (type === 'BUY') {
                    const buyRes = await executeBuyAction(followerId, tickerId, settings.amountPerBuyNgn, true);
                    if (buyRes.success) {
                        return { followerId, status: 'success', type: 'BUY' };
                    } else {
                        return { followerId, status: 'failed', reason: buyRes.error };
                    }
                } else if (type === 'SELL' && sourceUserTotalHeldBefore && sourceAmountSold) {
                    const sellPercentage = sourceAmountSold / sourceUserTotalHeldBefore;
                    
                    const followerPortfolioRef = collection(firestore, `users/${followerId}/portfolio`);
                    const holdingQ = query(followerPortfolioRef, where('tickerId', '==', tickerId));
                    const holdingSnap = await getDocs(holdingQ);
                    
                    if (!holdingSnap.empty) {
                        const followerHolding = holdingSnap.docs[0].data() as PortfolioHolding;
                        const amountToSell = followerHolding.amount * sellPercentage;
                        
                        if (amountToSell > 0.000001) {
                            const sellRes = await executeSellAction(followerId, tickerId, amountToSell, true);
                            if (sellRes.success) {
                                return { followerId, status: 'success', type: 'SELL' };
                            } else {
                                return { followerId, status: 'failed', reason: sellRes.error };
                            }
                        } else {
                            return { followerId, status: 'skipped', reason: 'dust-amount' };
                        }
                    } else {
                        return { followerId, status: 'skipped', reason: 'no-holding' };
                    }
                }
                return { followerId, status: 'unknown' };
            } catch (err: any) {
                console.error(`[CopyTrading] Critical error for follower ${followerId}:`, err);
                return { followerId, status: 'error', message: err.message };
            }
        });

        const results = await Promise.allSettled(tradePromises);
        
        await addDoc(collection(firestore, 'copyTradeAudit'), {
            sourceUid,
            tickerId,
            type,
            timestamp: serverTimestamp(),
            followerCount: snapshot.size,
            results: results.map((r: any) => r.status === 'fulfilled' ? r.value : { status: 'rejected', error: r.reason })
        });

        console.log(`[CopyTrading] Fan-out complete for ${sourceUid}. Audit log recorded.`);
    } catch (error: any) {
        console.error("[CopyTrading] GLOBAL FAN-OUT FAILURE:", error);
        await addDoc(collection(firestore, 'copyTradeAudit'), {
            sourceUid,
            tickerId,
            type,
            timestamp: serverTimestamp(),
            status: 'critical_failure',
            error: error.message
        }).catch(() => {});
    }
}

export async function executeBuyAction(userId: string, tickerId: string, ngnAmount: number, isCopyTrade: boolean = false) {
    const firestore = getFirestoreInstance();
    const resolvedId = await resolveTickerId(firestore, tickerId);
    
    try {
        const portfolioRef = collection(firestore, `users/${userId}/portfolio`);
        const holdingQuery = query(portfolioRef, where('tickerId', '==', resolvedId));
        const holdingSnapshot = await getDocs(holdingQuery);
        
        const result = await runTransaction(firestore, async (transaction) => {
            const userRef = doc(firestore, 'users', userId);
            const tickerRef = doc(firestore, 'tickers', resolvedId);
            
            const userDoc = await transaction.get(userRef as DocumentReference<UserProfile>);
            const tickerDoc = await transaction.get(tickerRef as DocumentReference<Ticker>);
            
            if (!userDoc.exists()) throw new Error('User not found.');
            
            const userData = userDoc.data();
            const bonusBalance = userData.bonusBalance || 0;
            const mainBalance = userData.balance || 0;
            const totalAvailable = mainBalance + bonusBalance;

            if (totalAvailable < ngnAmount) throw new Error('Insufficient balance.');
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

            // SPEND LOGIC: Bonus first, then main
            const spendFromBonus = Math.min(bonusBalance, ngnAmount);
            const spendFromMain = ngnAmount - spendFromBonus;

            transaction.update(userRef, { 
                balance: mainBalance - spendFromMain,
                bonusBalance: bonusBalance - spendFromBonus,
                totalTradingVolume: increment(ngnAmount)
            });

            if (!holdingSnapshot.empty) {
                const primaryHoldingRef = holdingSnapshot.docs[0].ref;
                const primaryHoldingData = holdingSnapshot.docs[0].data() as PortfolioHolding;
                let totalAmount = primaryHoldingData.amount + tokensOut;
                let totalCost = (primaryHoldingData.avgBuyPrice * primaryHoldingData.amount) + ngnAmount;
                const newAvgBuyPrice = totalAmount > 0 ? totalCost / totalAmount : 0;
                transaction.update(primaryHoldingRef, { amount: totalAmount, avgBuyPrice: newAvgBuyPrice });
            } else {
                const newHoldingRef = doc(portfolioRef, `holding_${resolvedId}`);
                transaction.set(newHoldingRef, { tickerId: resolvedId, amount: tokensOut, avgBuyPrice: avgBuyPrice, userId: userId });
            }

            const now = new Date();
            const twentyFourHoursAgo = sub(now, { hours: 24 });
            const chartData = tickerData.chartData || [];
            const price24hAgoDataPoint = [...chartData].reverse().find(d => new Date(d.time) <= twentyFourHoursAgo) || chartData[0];
            const price24hAgo = price24hAgoDataPoint?.price || tickerData.price;
            const priceChange24h = price24hAgo > 0 ? ((finalPrice - price24hAgo) / price24hAgo) * 100 : 0;
            const volume24h = (tickerData.volume24h || 0) + ngnAmount;
            const trendingScore = calculateTrendingScore(priceChange24h, volume24h);

            const updatedChartData = [...chartData, {
                time: now.toISOString(),
                price: finalPrice,
                volume: ngnAmount,
                marketCap: newMarketCap,
            }].slice(-200);

            transaction.update(tickerRef, { 
                price: finalPrice,
                marketCap: newMarketCap,
                supply: newSupply,
                volume24h,
                priceChange24h,
                trendingScore,
                chartData: updatedChartData
            });

            const activityRef = doc(collection(firestore, 'activities'));
            transaction.set(activityRef, {
                type: isCopyTrade ? 'COPY_BUY' : 'BUY',
                tickerId: resolvedId,
                tickerName: tickerData.name,
                tickerIcon: tickerData.icon,
                value: ngnAmount,
                fee: fee, 
                tokenAmount: tokensOut,
                pricePerToken: avgBuyPrice,
                userId: userId,
                createdAt: serverTimestamp(),
            });

            return { success: true, tokensOut, tickerName: tickerData.name, fee };
        });

        if (!isCopyTrade) {
            await triggerCopyTrades(userId, resolvedId, 'BUY');
        }

        return result;
    } catch (error: any) {
        console.error('Trade execution failed:', error);
        return { success: false, error: error.message };
    }
}

export async function executeSellAction(userId: string, tickerId: string, tokenAmountToSell: number, isCopyTrade: boolean = false) {
    const firestore = getFirestoreInstance();
    const resolvedId = await resolveTickerId(firestore, tickerId);

    try {
        const portfolioRef = collection(firestore, `users/${userId}/portfolio`);
        const holdingQuery = query(portfolioRef, where('tickerId', '==', resolvedId));
        const holdingSnapshot = await getDocs(holdingQuery);

        if (holdingSnapshot.empty) {
            return { success: false, error: 'You do not own this ticker.' };
        }

        let totalHeldAmountBefore = 0;
        holdingSnapshot.docs.forEach(doc => {
            totalHeldAmountBefore += (doc.data() as PortfolioHolding).amount;
        });

        const result = await runTransaction(firestore, async (transaction) => {
            const userRef = doc(firestore, 'users', userId);
            const tickerRef = doc(firestore, 'tickers', resolvedId);
            
            const userDoc = await transaction.get(userRef as DocumentReference<UserProfile>);
            const tickerDoc = await transaction.get(tickerRef as DocumentReference<Ticker>);

            if (!userDoc.exists()) throw new Error('User not found.');
            if (!tickerDoc.exists()) throw new Error('Ticker not found.');

            let totalWeightedCost = 0;
            holdingSnapshot.docs.forEach(doc => {
                const data = doc.data() as PortfolioHolding;
                totalWeightedCost += (data.avgBuyPrice * data.amount);
            });

            const globalAvgBuyPrice = totalHeldAmountBefore > 0 ? totalWeightedCost / totalHeldAmountBefore : 0;

            if (tokenAmountToSell <= 0) throw new Error("Invalid sell amount.");
            if (tokenAmountToSell > totalHeldAmountBefore + 0.000001) throw new Error("Insufficient tokens in portfolio.");

            const tickerData = tickerDoc.data();
            const k = tickerData.marketCap * tickerData.supply;
            const newSupply = tickerData.supply + tokenAmountToSell;
            const newMarketCap = k / newSupply;
            
            const ngnToGetBeforeFee = tickerData.marketCap - newMarketCap;
            const fee = ngnToGetBeforeFee * TRANSACTION_FEE_PERCENTAGE;
            const ngnToUser = ngnToGetBeforeFee - fee;

            const costBasis = tokenAmountToSell * globalAvgBuyPrice;
            const realizedPnl = ngnToUser - costBasis;
            const finalPrice = newMarketCap / newSupply;
            const pricePerToken = ngnToGetBeforeFee / tokenAmountToSell;

            // SALES ALWAYS GO TO MAIN BALANCE
            transaction.update(userRef, { 
                balance: userDoc.data().balance + ngnToUser,
                totalRealizedPnl: increment(realizedPnl),
                totalTradingVolume: increment(ngnToGetBeforeFee)
            });

            let remainingToSell = tokenAmountToSell;
            for (const hDoc of holdingSnapshot.docs) {
                const hData = hDoc.data() as PortfolioHolding;
                if (remainingToSell <= 0) break;
                const sellFromThisDoc = Math.min(hData.amount, remainingToSell);
                const newAmount = hData.amount - sellFromThisDoc;
                if (newAmount > 0.000001) { transaction.update(hDoc.ref, { amount: newAmount }); } 
                else { transaction.delete(hDoc.ref); }
                remainingToSell -= sellFromThisDoc;
            }

            const now = new Date();
            const twentyFourHoursAgo = sub(now, { hours: 24 });
            const chartData = tickerData.chartData || [];
            const price24hAgoDataPoint = [...chartData].reverse().find(d => new Date(d.time) <= twentyFourHoursAgo) || chartData[0];
            const price24hAgo = price24hAgoDataPoint?.price || tickerData.price;
            const priceChange24h = price24hAgo > 0 ? ((finalPrice - price24hAgo) / price24hAgo) * 100 : 0;
            const volume24h = (tickerData.volume24h || 0) + ngnToGetBeforeFee;
            const trendingScore = calculateTrendingScore(priceChange24h, volume24h);

            const updatedChartData = [...chartData, {
                time: now.toISOString(),
                price: finalPrice,
                volume: ngnToGetBeforeFee,
                marketCap: newMarketCap,
            }].slice(-200);

            transaction.update(tickerRef, { 
                price: finalPrice,
                marketCap: newMarketCap,
                supply: newSupply,
                volume24h,
                priceChange24h,
                trendingScore,
                chartData: updatedChartData
            });

            const activityRef = doc(collection(firestore, 'activities'));
            transaction.set(activityRef, {
                type: isCopyTrade ? 'COPY_SELL' : 'SELL',
                tickerId: resolvedId,
                tickerName: tickerData.name,
                tickerIcon: tickerData.icon,
                value: ngnToGetBeforeFee,
                fee: fee, 
                tokenAmount: tokenAmountToSell,
                pricePerToken: pricePerToken,
                realizedPnl: realizedPnl,
                userId: userId,
                createdAt: serverTimestamp(),
            });

            return { success: true, tickerName: tickerData.name, ngnToUser, fee };
        });

        if (!isCopyTrade) {
            await triggerCopyTrades(userId, resolvedId, 'SELL', totalHeldAmountBefore, tokenAmountToSell);
        }

        return result;
    } catch (error: any) {
        console.error('Sell execution failed:', error);
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

    const marketCapOptions = {
      '100000': { fee: 1000 },
      '1000000': { fee: 4000 },
      '5000000': { fee: 7000 },
      '10000000': { fee: 10000 },
    };

    const mCapKey = initialMarketCap.toString();
    const creationFee = marketCapOptions[mCapKey as keyof typeof marketCapOptions]?.fee || 0;
    const initialBuyFee = initialBuyNgn * TRANSACTION_FEE_PERCENTAGE;
    const totalCost = creationFee + initialBuyNgn;

    try {
        const result = await runTransaction(firestore, async (transaction) => {
            const userRef = doc(firestore, 'users', userId);
            const userDoc = await transaction.get(userRef as DocumentReference<UserProfile>);

            if (!userDoc.exists()) throw new Error('User profile not found.');
            const userData = userDoc.data();
            const totalAvailable = (userData.balance || 0) + (userData.bonusBalance || 0);

            if (totalAvailable < totalCost) {
                throw new Error(`Insufficient balance. You need ₦${totalCost.toLocaleString()}.`);
            }

            const spendFromBonus = Math.min(userData.bonusBalance || 0, totalCost);
            const spendFromMain = totalCost - spendFromBonus;

            transaction.update(userRef, { 
                balance: (userData.balance || 0) - spendFromMain,
                bonusBalance: (userData.bonusBalance || 0) - spendFromBonus,
                totalTradingVolume: increment(initialBuyNgn)
            });

            const k = initialMarketCap * input.supply;
            const ngnForCurve = initialBuyNgn - initialBuyFee;
            const finalMarketCap = initialMarketCap + ngnForCurve;
            const finalSupply = k / finalMarketCap;
            const tokensOut = input.supply - finalSupply;
            const finalPrice = finalMarketCap / finalSupply;
            const initialPrice = initialMarketCap / input.supply;
            const avgBuyPrice = initialBuyNgn / tokensOut;

            const newTickerRef = doc(collection(firestore, 'tickers'));
            const tickerAddress = `${newTickerRef.id}cruz`;
            const now = new Date();
            
            const tickerData: any = {
                id: newTickerRef.id,
                name: input.name,
                slug: input.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
                description: input.description,
                icon: input.icon,
                coverImage: input.coverImage,
                supply: finalSupply,
                marketCap: finalMarketCap,
                price: finalPrice,
                tickerAddress,
                creatorId: userId,
                createdAt: serverTimestamp(),
                trendingScore: 0,
                priceChange24h: 0,
                volume24h: initialBuyNgn,
                isVerified: false,
                chartData: [
                    { time: now.toISOString(), price: initialPrice, volume: 0, marketCap: initialMarketCap },
                    { time: new Date(now.getTime() + 1).toISOString(), price: finalPrice, volume: initialBuyNgn, marketCap: finalMarketCap }
                ]
            };

            if (input.videoUrl) { tickerData.videoUrl = input.videoUrl; }
            transaction.set(newTickerRef, tickerData);

            const newHoldingRef = doc(firestore, `users/${userId}/portfolio`, `holding_${newTickerRef.id}`);
            transaction.set(newHoldingRef, { tickerId: newTickerRef.id, amount: tokensOut, avgBuyPrice: avgBuyPrice, userId: userId });

            transaction.set(doc(collection(firestore, 'activities')), {
                type: 'CREATE', tickerId: newTickerRef.id, tickerName: input.name, tickerIcon: input.icon, value: creationFee, fee: creationFee, userId: userId, createdAt: serverTimestamp(),
            });

            transaction.set(doc(collection(firestore, 'activities')), {
                type: 'BUY', tickerId: newTickerRef.id, tickerName: input.name, tickerIcon: input.icon, value: initialBuyNgn, fee: initialBuyFee, tokenAmount: tokensOut, pricePerToken: avgBuyPrice, userId: userId, createdAt: serverTimestamp(),
            });

            return { tickerId: newTickerRef.id, tickerName: input.name, tickerAddress, fee: totalCost };
        });

        broadcastNewTickerNotification(result.tickerName, result.tickerAddress, result.tickerId);
        createSystemNotification('🚀 New Token Launched!', `$${result.tickerName} has just been deployed to the arena. Trade it before the crowd!`, false);

        return { success: true, tickerId: result.tickerId, fee: result.fee };
    } catch (error: any) {
        console.error('Ticker creation failed:', error);
        return { success: false, error: error.message };
    }
}
