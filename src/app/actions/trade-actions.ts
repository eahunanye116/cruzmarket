'use server';

import { getFirestoreInstance } from '@/firebase/server';
import { doc, collection, runTransaction, serverTimestamp, arrayUnion, DocumentReference, increment, getDocs, query, where, getDoc } from 'firebase/firestore';
import type { Ticker, UserProfile, PortfolioHolding, PlatformStats } from '@/lib/types';
import { sub } from 'date-fns';
import { broadcastNewTickerNotification } from './telegram-actions';
import { revalidatePath } from 'next/cache';

const TRANSACTION_FEE_PERCENTAGE = 0.002;
const ADMIN_UID = 'xhYlmnOqQtUNYLgCK6XXm8unKJy1';

const marketCapOptions = {
  '100': { fee: 1 },
  '1000': { fee: 4 },
  '5000': { fee: 7 },
  '10000': { fee: 10 },
};

const calculateTrendingScore = (priceChange24h: number, volume24h: number) => {
    const volumeWeight = 0.7;
    const priceChangeWeight = 0.3;
    const volumeScore = Math.log1p(volume24h) * volumeWeight; 
    const priceChangeScore = (priceChange24h > 0 ? priceChange24h : priceChange24h / 2) * priceChangeWeight;
    return volumeScore + priceChangeScore;
};

/**
 * Resolves a Ticker ID from a potential address or raw ID.
 */
async function resolveTickerId(firestore: any, inputId: string): Promise<string> {
    const cleanId = inputId.trim();
    
    // Optimization: If it looks like a standard 20-char Firestore ID, try it first
    if (cleanId.length === 20 && !cleanId.includes(' ')) {
        const directRef = doc(firestore, 'tickers', cleanId);
        const directSnap = await getDoc(directRef);
        if (directSnap.exists()) return cleanId;
    }

    // Try stripping 'cruz' suffix if it's an address
    if (cleanId.toLowerCase().endsWith('cruz') && cleanId.length > 5) {
        const strippedId = cleanId.slice(0, -4);
        const strippedRef = doc(firestore, 'tickers', strippedId);
        const strippedSnap = await getDoc(strippedRef);
        if (strippedSnap.exists()) return strippedId;
    }

    return cleanId;
}

export async function executeBuyAction(userId: string, tickerId: string, ngnAmount: number) {
    const firestore = getFirestoreInstance();
    const resolvedId = await resolveTickerId(firestore, tickerId);
    
    try {
        const portfolioRef = collection(firestore, `users/${userId}/portfolio`);
        const holdingQuery = query(portfolioRef, where('tickerId', '==', resolvedId));
        const holdingSnapshot = await getDocs(holdingQuery);
        
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

            transaction.update(userRef, { balance: userDoc.data().balance - ngnAmount });

            // Manage Portfolio Holding
            if (!holdingSnapshot.empty) {
                const primaryHoldingRef = holdingSnapshot.docs[0].ref;
                const primaryHoldingData = holdingSnapshot.docs[0].data() as PortfolioHolding;
                
                let totalAmount = primaryHoldingData.amount + tokensOut;
                let totalCost = (primaryHoldingData.avgBuyPrice * primaryHoldingData.amount) + ngnAmount;

                for (let i = 1; i < holdingSnapshot.docs.length; i++) {
                    transaction.delete(holdingSnapshot.docs[i].ref);
                }

                const newAvgBuyPrice = totalAmount > 0 ? totalCost / totalAmount : 0;
                transaction.update(primaryHoldingRef, { amount: totalAmount, avgBuyPrice: newAvgBuyPrice });
            } else {
                const newHoldingRef = doc(portfolioRef, `holding_${resolvedId}`);
                transaction.set(newHoldingRef, {
                    tickerId: resolvedId,
                    amount: tokensOut,
                    avgBuyPrice: avgBuyPrice,
                    userId: userId
                });
            }

            const now = new Date();
            const twentyFourHoursAgo = sub(now, { hours: 24 });
            const chartData = tickerData.chartData || [];
            const price24hAgoDataPoint = [...chartData].reverse().find(d => new Date(d.time) <= twentyFourHoursAgo) || chartData[0];
            const price24hAgo = price24hAgoDataPoint?.price || tickerData.price;
            const priceChange24h = price24hAgo > 0 ? ((finalPrice - price24hAgo) / price24hAgo) * 100 : 0;
            const volume24h = (tickerData.volume24h || 0) + ngnAmount;
            const trendingScore = calculateTrendingScore(priceChange24h, volume24h);

            // Optimization: Keep chart data array manageable (e.g., last 200 points)
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
                type: 'BUY',
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

        return result;
    } catch (error: any) {
        console.error('Trade execution failed:', error);
        return { success: false, error: error.message };
    }
}

export async function executeSellAction(userId: string, tickerId: string, tokenAmountToSell: number) {
    const firestore = getFirestoreInstance();
    const resolvedId = await resolveTickerId(firestore, tickerId);

    try {
        const portfolioRef = collection(firestore, `users/${userId}/portfolio`);
        const holdingQuery = query(portfolioRef, where('tickerId', '==', resolvedId));
        const holdingSnapshot = await getDocs(holdingQuery);

        if (holdingSnapshot.empty) {
            return { success: false, error: 'You do not own this ticker.' };
        }

        const result = await runTransaction(firestore, async (transaction) => {
            const userRef = doc(firestore, 'users', userId);
            const tickerRef = doc(firestore, 'tickers', resolvedId);
            const statsRef = doc(firestore, 'stats', 'platform');

            const userDoc = await transaction.get(userRef as DocumentReference<UserProfile>);
            const tickerDoc = await transaction.get(tickerRef as DocumentReference<Ticker>);
            const statsDoc = await transaction.get(statsRef);

            if (!userDoc.exists()) throw new Error('User not found.');
            if (!tickerDoc.exists()) throw new Error('Ticker not found.');

            let totalHeldAmount = 0;
            let totalWeightedCost = 0;
            holdingSnapshot.docs.forEach(doc => {
                const data = doc.data() as PortfolioHolding;
                totalHeldAmount += data.amount;
                totalWeightedCost += (data.avgBuyPrice * data.amount);
            });

            const globalAvgBuyPrice = totalHeldAmount > 0 ? totalWeightedCost / totalHeldAmount : 0;

            if (tokenAmountToSell <= 0) throw new Error("Invalid sell amount.");
            if (tokenAmountToSell > totalHeldAmount + 0.000001) throw new Error("Insufficient tokens in portfolio.");

            const tickerData = tickerDoc.data();
            const k = tickerData.marketCap * tickerData.supply;
            const newSupply = tickerData.supply + tokenAmountToSell;
            const newMarketCap = k / newSupply;
            
            const ngnToGetBeforeFee = tickerData.marketCap - newMarketCap;
            const fee = ngnToGetBeforeFee * TRANSACTION_FEE_PERCENTAGE;
            const ngnToUser = ngnToGetBeforeFee - fee;

            if (ngnToUser < 0) throw new Error("Sale value too small.");

            const costBasis = tokenAmountToSell * globalAvgBuyPrice;
            const realizedPnl = ngnToUser - costBasis;
            const finalPrice = newMarketCap / newSupply;
            const pricePerToken = ngnToGetBeforeFee / tokenAmountToSell;

            const currentTotalFees = statsDoc.data()?.totalFeesGenerated || 0;
            const currentUserFees = statsDoc.data()?.totalUserFees || 0;
            const currentAdminFees = statsDoc.data()?.totalAdminFees || 0;
            let newUserFees = currentUserFees;
            let newAdminFees = currentAdminFees;
            if (userId === ADMIN_UID) { newAdminFees += fee; } else { newUserFees += fee; }
            
            transaction.set(statsRef, { 
                totalFeesGenerated: currentTotalFees + fee,
                totalUserFees: newUserFees,
                totalAdminFees: newAdminFees
            }, { merge: true });

            transaction.update(userRef, { balance: userDoc.data().balance + ngnToUser });

            let remainingToSell = tokenAmountToSell;
            for (const hDoc of holdingSnapshot.docs) {
                const hData = hDoc.data() as PortfolioHolding;
                if (remainingToSell <= 0) break;

                const amountInThisDoc = hData.amount;
                const sellFromThisDoc = Math.min(amountInThisDoc, remainingToSell);
                const newAmount = amountInThisDoc - sellFromThisDoc;

                if (newAmount > 0.000001) {
                    transaction.update(hDoc.ref, { amount: newAmount });
                } else {
                    transaction.delete(hDoc.ref);
                }
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

            // Optimization: Keep chart data array manageable
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
                type: 'SELL',
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

            if (input.videoUrl) {
                tickerData.videoUrl = input.videoUrl;
            }

            transaction.set(newTickerRef, tickerData);

            const newHoldingRef = doc(firestore, `users/${userId}/portfolio`, `holding_${newTickerRef.id}`);
            transaction.set(newHoldingRef, {
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
                value: creationFee,
                fee: creationFee, 
                userId: userId,
                createdAt: serverTimestamp(),
            });

            transaction.set(doc(activitiesCollection), {
                type: 'BUY',
                tickerId: newTickerRef.id,
                tickerName: input.name,
                tickerIcon: input.icon,
                value: initialBuyNgn,
                fee: initialBuyFee, 
                tokenAmount: tokensOut,
                pricePerToken: avgBuyPrice,
                userId: userId,
                createdAt: serverTimestamp(),
            });

            return { tickerId: newTickerRef.id, tickerName: input.name, tickerAddress, fee: totalFeeForTx };
        });

        broadcastNewTickerNotification(result.tickerName, result.tickerAddress, result.tickerId);
        return { success: true, tickerId: result.tickerId, fee: result.fee };
    } catch (error: any) {
        console.error('Ticker creation failed:', error);
        return { success: false, error: error.message };
    }
}
