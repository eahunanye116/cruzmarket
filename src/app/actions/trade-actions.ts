
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

/**
 * Resolves a Ticker ID from a potential address or raw ID.
 */
async function resolveTickerId(firestore: any, inputId: string): Promise<string> {
    const cleanId = inputId.trim();
    
    // 1. Try as a direct ID first
    const directRef = doc(firestore, 'tickers', cleanId);
    const directSnap = await getDoc(directRef);
    if (directSnap.exists()) return cleanId;

    // 2. Try stripping 'cruz' suffix if it's an address
    if (cleanId.toLowerCase().endsWith('cruz') && cleanId.length > 5) {
        const strippedId = cleanId.slice(0, -4);
        const strippedRef = doc(firestore, 'tickers', strippedId);
        const strippedSnap = await getDoc(strippedRef);
        if (strippedSnap.exists()) return strippedId;
    }

    // 3. Fallback to original clean ID (will throw error later in transaction)
    return cleanId;
}

export async function executeBuyAction(userId: string, tickerId: string, ngnAmount: number) {
    const firestore = getFirestoreInstance();
    const resolvedId = await resolveTickerId(firestore, tickerId);
    
    try {
        // Find existing holdings for this user and ticker outside transaction
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

            // Manage Portfolio Holding - Robustly handling multiple docs if they exist
            if (!holdingSnapshot.empty) {
                // Use the first document found as the primary
                const primaryHoldingRef = holdingSnapshot.docs[0].ref;
                const primaryHoldingData = holdingSnapshot.docs[0].data() as PortfolioHolding;
                
                let totalAmount = primaryHoldingData.amount + tokensOut;
                let totalCost = (primaryHoldingData.avgBuyPrice * primaryHoldingData.amount) + ngnAmount;

                // Consolidate any other documents found for this ticker
                for (let i = 1; i < holdingSnapshot.docs.length; i++) {
                    const extraData = holdingSnapshot.docs[i].data() as PortfolioHolding;
                    totalAmount += extraData.amount;
                    totalCost += (extraData.avgBuyPrice * extraData.amount);
                    transaction.delete(holdingSnapshot.docs[i].ref);
                }

                const newAvgBuyPrice = totalAmount > 0 ? totalCost / totalAmount : 0;
                transaction.update(primaryHoldingRef, { amount: totalAmount, avgBuyPrice: newAvgBuyPrice });
            } else {
                // Create brand new holding with standardized ID
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
                    volume: ngnAmount,
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
        // Find actual holding documents for this user and ticker
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

            // Calculate total held across potentially multiple documents
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

            // Update Stats
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

            // Update/Delete holding docs logic
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
                    volume: ngnToGetBeforeFee,
                    marketCap: newMarketCap,
                })
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

export async function executeBurnHoldingsAction(userId: string, tickerIds: string[]) {
    if (!userId || !tickerIds.length) return { success: false, error: 'User or Tickers missing.' };
    const firestore = getFirestoreInstance();
    try {
        const portfolioRef = collection(firestore, `users/${userId}/portfolio`);
        const allMatchingDocs = [];
        
        for (const tid of tickerIds) {
            const q = query(portfolioRef, where('tickerId', '==', tid));
            const snap = await getDocs(q);
            allMatchingDocs.push(...snap.docs);
        }

        if (allMatchingDocs.length === 0) {
            return { success: true, message: 'No holdings found to burn.' };
        }

        await runTransaction(firestore, async (transaction) => {
            const statsRef = doc(firestore, 'stats', 'platform');
            const statsDoc = await transaction.get(statsRef);
            
            const tickerInfoMap: Record<string, { name: string, icon: string }> = {};
            for (const hDoc of allMatchingDocs) {
                const tid = hDoc.data().tickerId;
                if (!tickerInfoMap[tid]) {
                    const tRef = doc(firestore, 'tickers', tid);
                    const tSnap = await transaction.get(tRef);
                    tickerInfoMap[tid] = tSnap.exists() 
                        ? { name: tSnap.data().name, icon: tSnap.data().icon }
                        : { name: 'Unknown Token', icon: '' };
                }
            }

            for (const hDoc of allMatchingDocs) {
                const data = hDoc.data();
                const info = tickerInfoMap[data.tickerId];
                
                transaction.delete(hDoc.ref);
                
                const activityRef = doc(collection(firestore, 'activities'));
                transaction.set(activityRef, {
                    type: 'BURN',
                    tickerId: data.tickerId,
                    tickerName: info.name,
                    tickerIcon: info.icon,
                    tokenAmount: data.amount,
                    value: 0,
                    userId: userId,
                    createdAt: serverTimestamp(),
                });
            }
            
            const currentTotalBurned = statsDoc.data()?.totalTokensBurned || 0;
            transaction.set(statsRef, { 
                totalTokensBurned: currentTotalBurned + allMatchingDocs.length 
            }, { merge: true });
        });
        
        revalidatePath('/portfolio');
        revalidatePath('/admin');
        return { success: true, message: `${allMatchingDocs.length} holding documents burned successfully.` };
    } catch (error: any) {
        console.error('Burn failed:', error);
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
