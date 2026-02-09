
'use server';

import { processDeposit } from '@/lib/wallet';
import { getFirestoreInstance } from '@/firebase/server';
import { collection, addDoc, serverTimestamp, doc, runTransaction, getDoc, query, where, getDocs, updateDoc } from 'firebase/firestore';
import { revalidatePath } from 'next/cache';
import type { UserProfile, WithdrawalRequest } from '@/lib/types';

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

// Reliable Exchange Rate Fetching
export async function getLatestUsdNgnRate(): Promise<number> {
    try {
        const response = await fetch('https://open.er-api.com/v6/latest/USD', { 
            next: { revalidate: 3600 } // Cache for 1 hour
        });
        const data = await response.json();
        return data.rates.NGN || 1600; // Fallback to 1600 if API fails
    } catch (error) {
        console.error("EXCHANGE_RATE_ERROR:", error);
        return 1600;
    }
}

type PaystackVerificationResponse = {
    status: boolean;
    message: string;
    data: {
        status: 'success' | 'failed';
        amount: number; 
        currency: 'NGN';
        customer: {
            email: string;
        };
        metadata: {
            userId: string;
        };
        reference: string;
    }
}

export async function verifyPaystackDepositAction(reference: string) {
    if (!PAYSTACK_SECRET_KEY) {
        throw new Error('Paystack secret key is not configured.');
    }
    if (!reference) {
        throw new Error('Transaction reference is missing.');
    }

    try {
        const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
            headers: {
                Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
            },
            cache: 'no-store'
        });

        const result: PaystackVerificationResponse = await response.json();
        
        if (!result.status || result.data.status !== 'success') {
            throw new Error(result.message || 'Transaction verification failed.');
        }

        const { amount, metadata: { userId }, currency, reference: transactionReference } = result.data;

        if (!userId) {
            throw new Error('User ID not found in transaction metadata.');
        }

        if (currency !== 'NGN') {
            throw new Error('Only NGN transactions are supported via Paystack.');
        }
        
        const amountInNgn = amount / 100;

        await processDeposit(transactionReference, userId, amountInNgn);
        
        return { success: true, message: `Deposit of ₦${amountInNgn.toLocaleString()} was successful.` };

    } catch (error: any) {
        console.error('Paystack verification error:', error);
        return { success: false, error: error.message || 'An unknown error occurred during verification.' };
    }
}

export async function getNowPaymentsMinAmountAction(payCurrency: string) {
    const API_KEY = process.env.NOWPAYMENTS_API_KEY || '299PEWX-X9C4349-NF28N7G-A2FFNYH';
    try {
        // Fetch minimum amount from NOWPayments
        const res = await fetch(`https://api.nowpayments.io/v1/min-amount?currency_from=${payCurrency.toLowerCase()}&fiat_equivalent=usd`, {
            headers: { 'x-api-key': API_KEY }
        });
        const data = await res.json();
        
        if (data.fiat_equivalent) {
            return { success: true, minAmountUsd: data.fiat_equivalent };
        }
        return { success: false, error: data.message || "Failed to fetch min amount" };
    } catch (error: any) {
        console.error("NOWPAYMENTS_MIN_ERROR:", error);
        return { success: false, error: "Network error fetching minimum amount" };
    }
}

export async function createNowPaymentsPaymentAction(amount: number, payCurrency: string, userId: string) {
    const API_KEY = process.env.NOWPAYMENTS_API_KEY || '299PEWX-X9C4349-NF28N7G-A2FFNYH';
    const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://cruzmarket.fun';

    try {
        // First check if amount is above minimum
        const minCheck = await getNowPaymentsMinAmountAction(payCurrency);
        if (minCheck.success && amount < minCheck.minAmountUsd) {
            throw new Error(`Amount is below the minimum required for this coin ($${minCheck.minAmountUsd.toFixed(2)}).`);
        }

        const response = await fetch('https://api.nowpayments.io/v1/payment', {
            method: 'POST',
            headers: {
                'x-api-key': API_KEY,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                price_amount: amount,
                price_currency: 'usd',
                pay_currency: payCurrency.toLowerCase(),
                order_id: `DEP_${Date.now()}_${userId}`,
                order_description: `CruzMarket Crypto Deposit`,
                ipn_callback_url: `${APP_URL}/api/webhooks/nowpayments`,
            }),
        });

        const result = await response.json();

        if (result.payment_id) {
            return { 
                success: true, 
                paymentDetails: {
                    payment_id: result.payment_id,
                    pay_address: result.pay_address,
                    pay_amount: result.pay_amount,
                    pay_currency: result.pay_currency,
                }
            };
        } else {
            return { success: false, error: result.message || 'Failed to initiate payment.' };
        }
    } catch (error: any) {
        return { success: false, error: `Error: ${error.message}` };
    }
}

type WithdrawalRequestPayload = {
    userId: string;
    amount: number;
    withdrawalType: 'ngn' | 'crypto';
    bankName?: string;
    accountNumber?: string;
    accountName?: string;
    cryptoCoin?: string;
    cryptoNetwork?: string;
    cryptoAddress?: string;
}

export async function requestWithdrawalAction(payload: WithdrawalRequestPayload) {
    const firestore = getFirestoreInstance();
    try {
        const userDocRef = doc(firestore, 'users', payload.userId);
        const userDoc = await getDoc(userDocRef);

        if (!userDoc.exists()) {
            throw new Error('User profile not found.');
        }
        const userProfile = userDoc.data() as UserProfile;

        // Fetch real-time rate for conversion
        const currentRate = await getLatestUsdNgnRate();
        const amountInNgn = payload.withdrawalType === 'crypto' ? payload.amount * currentRate : payload.amount;

        if (userProfile.balance < amountInNgn) {
            throw new Error('Insufficient balance.');
        }

        const requestsRef = collection(firestore, 'withdrawalRequests');
        const userRequestsQuery = query(
            requestsRef, 
            where('userId', '==', payload.userId)
        );
        const requestsSnapshot = await getDocs(userRequestsQuery);
        
        let totalPending = 0;
        requestsSnapshot.forEach(doc => {
            const data = doc.data() as WithdrawalRequest;
            if (data.status === 'pending') {
                totalPending += data.amount;
            }
        });

        if (totalPending + amountInNgn > userProfile.balance) {
            throw new Error(`Insufficient available balance. You already have ₦${totalPending.toLocaleString()} in pending withdrawals.`);
        }

        await addDoc(requestsRef, {
            ...payload,
            amount: amountInNgn, 
            usdAmount: payload.withdrawalType === 'crypto' ? payload.amount : (payload.amount / currentRate),
            exchangeRateAtRequest: currentRate,
            status: 'pending',
            createdAt: serverTimestamp(),
        });
        
        revalidatePath('/transactions');
        return { success: true, message: 'Your withdrawal request has been submitted.' };
    } catch (error: any) {
        console.error('Withdrawal request error:', error);
        return { success: false, error: error.message || 'Could not submit withdrawal request.' };
    }
}


export async function approveWithdrawalAction(requestId: string) {
    const firestore = getFirestoreInstance();
    try {
        await runTransaction(firestore, async (transaction) => {
            const requestRef = doc(firestore, 'withdrawalRequests', requestId);
            const requestDoc = await transaction.get(requestRef);
            if (!requestDoc.exists() || requestDoc.data().status !== 'pending') {
                throw new Error('Withdrawal request is not valid.');
            }
            const requestData = requestDoc.data();

            const userRef = doc(firestore, 'users', requestData.userId);
            const userDoc = await transaction.get(userRef);
            if (!userDoc.exists()) {
                throw new Error('User not found.');
            }

            const userData = userDoc.data() as UserProfile;
            const userBalance = userData.balance;
            if (userBalance < requestData.amount) {
                throw new Error('User has insufficient balance.');
            }

            transaction.update(userRef, { balance: userBalance - requestData.amount });
            transaction.update(requestRef, { 
                status: 'completed', 
                processedAt: serverTimestamp() 
            });

            const activityRef = doc(collection(firestore, 'activities'));
            transaction.set(activityRef, {
                type: 'WITHDRAWAL',
                value: requestData.amount,
                userId: requestData.userId,
                createdAt: serverTimestamp(),
            });
        });

        revalidatePath('/admin');
        revalidatePath('/transactions');
        return { success: true, message: 'Withdrawal approved.' };
    } catch (error: any) {
        console.error('Error approving withdrawal:', error);
        return { success: false, error: error.message };
    }
}


export async function rejectWithdrawalAction(requestId: string, reason: string) {
    if (!reason) {
        return { success: false, error: 'A reason for rejection is required.' };
    }
    const firestore = getFirestoreInstance();
    try {
        const requestRef = doc(firestore, 'withdrawalRequests', requestId);
        await updateDoc(requestRef, {
            status: 'rejected',
            rejectionReason: reason,
            processedAt: serverTimestamp(),
        });

        revalidatePath('/admin');
        revalidatePath('/transactions');
        return { success: true, message: 'Withdrawal request has been rejected.' };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function getUserProfileByUid(uid: string) {
    const firestore = getFirestoreInstance();
    try {
        const userDoc = await getDoc(doc(firestore, 'users', uid));
        if (userDoc.exists()) {
            const data = userDoc.data() as UserProfile;
            return { success: true, profile: { displayName: data.displayName, email: data.email } };
        }
        return { success: false, error: 'User not found.' };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function transferFundsAction(senderId: string, recipientId: string, amount: number) {
    if (senderId === recipientId) return { success: false, error: "You cannot transfer to yourself." };
    if (amount <= 0) return { success: false, error: "Invalid amount." };

    const firestore = getFirestoreInstance();
    try {
        await runTransaction(firestore, async (transaction) => {
            const senderRef = doc(firestore, 'users', senderId);
            const recipientRef = doc(firestore, 'users', recipientId);

            const [senderDoc, recipientDoc] = await Promise.all([
                transaction.get(senderRef),
                transaction.get(recipientRef)
            ]);

            if (!senderDoc.exists()) throw new Error("Sender account not found.");
            if (!recipientDoc.exists()) throw new Error("Recipient account not found.");

            const senderData = senderDoc.data() as UserProfile;
            const recipientData = recipientDoc.data() as UserProfile;

            if (senderData.balance < amount) throw new Error("Insufficient balance.");

            transaction.update(senderRef, { balance: senderData.balance - amount });
            transaction.update(recipientRef, { balance: recipientData.balance + amount });

            // Log activity for sender
            const senderActivityRef = doc(collection(firestore, 'activities'));
            transaction.set(senderActivityRef, {
                type: 'TRANSFER_SENT',
                value: amount,
                userId: senderId,
                recipientId: recipientId,
                recipientName: recipientData.displayName,
                createdAt: serverTimestamp(),
            });

            // Log activity for recipient
            const recipientActivityRef = doc(collection(firestore, 'activities'));
            transaction.set(recipientActivityRef, {
                type: 'TRANSFER_RECEIVED',
                value: amount,
                userId: recipientId,
                senderId: senderId,
                senderName: senderData.displayName,
                createdAt: serverTimestamp(),
            });
        });

        revalidatePath('/transactions');
        return { success: true, message: 'Transfer successful.' };
    } catch (error: any) {
        console.error('Transfer failed:', error);
        return { success: false, error: error.message };
    }
}
