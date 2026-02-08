'use server';

import { processDeposit } from '@/lib/wallet';
import { getFirestoreInstance } from '@/firebase/server';
import { collection, addDoc, serverTimestamp, doc, runTransaction, getDoc, query, where, getDocs, updateDoc } from 'firebase/firestore';
import { revalidatePath } from 'next/cache';
import type { UserProfile, WithdrawalRequest } from '@/lib/types';

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

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
            throw new Error('Only NGN transactions are supported.');
        }
        
        const amountInNaira = amount / 100;

        await processDeposit(transactionReference, userId, amountInNaira);
        
        return { success: true, message: `Deposit of ₦${amountInNaira.toLocaleString()} was successful.` };

    } catch (error: any) {
        console.error('Paystack verification error:', error);
        return { success: false, error: error.message || 'An unknown error occurred during verification.' };
    }
}

/**
 * Creates a NowPayments direct payment for crypto deposits.
 */
export async function createNowPaymentsPaymentAction(amount: number, payCurrency: string, userId: string) {
    const API_KEY = process.env.NOWPAYMENTS_API_KEY || '299PEWX-X9C4349-NF28N7G-A2FFNYH';
    const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://cruzmarket.fun';

    console.log(`NOWPAYMENTS: Initiating payment for user ${userId}, amount ${amount} NGN in ${payCurrency}`);

    try {
        const response = await fetch('https://api.nowpayments.io/v1/payment', {
            method: 'POST',
            headers: {
                'x-api-key': API_KEY,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                price_amount: amount,
                price_currency: 'ngn',
                pay_currency: payCurrency.toLowerCase(),
                order_id: `DEP_${Date.now()}_${userId}`,
                order_description: `CruzMarket Crypto Deposit`,
                ipn_callback_url: `${APP_URL}/api/webhooks/nowpayments`,
            }),
        });

        const result = await response.json();

        if (result.payment_id) {
            console.log(`NOWPAYMENTS_SUCCESS: Payment created: ${result.payment_id}`);
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
            console.error('NOWPAYMENTS_INVALID_RESPONSE:', result);
            return { success: false, error: result.message || 'Failed to initiate payment. Ensure the selected currency is supported.' };
        }
    } catch (error: any) {
        console.error('NOWPAYMENTS_FETCH_EXCEPTION:', error);
        return { success: false, error: `Network error: ${error.message}` };
    }
}

type WithdrawalRequestPayload = {
    userId: string;
    amount: number;
    bankName: string;
    accountNumber: string;
    accountName: string;
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

        if (userProfile.balance < payload.amount) {
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

        if (totalPending + payload.amount > userProfile.balance) {
            const availableAfterPending = userProfile.balance - totalPending;
            throw new Error(`Insufficient available balance. You already have ₦${totalPending.toLocaleString()} in pending withdrawals. Maximum additional withdrawal allowed is ₦${Math.max(0, availableAfterPending).toLocaleString()}.`);
        }

        await addDoc(requestsRef, {
            ...payload,
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
                throw new Error('Withdrawal request is not valid or has already been processed.');
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
                throw new Error('User has insufficient balance for this withdrawal.');
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
        return { success: true, message: 'Withdrawal approved and funds deducted from user wallet.' };
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
        const requestSnap = await getDoc(requestRef);
        
        if (!requestSnap.exists()) throw new Error("Request not found.");

        await updateDoc(requestRef, {
            status: 'rejected',
            rejectionReason: reason,
            processedAt: serverTimestamp(),
        });

        revalidatePath('/admin');
        revalidatePath('/transactions');
        return { success: true, message: 'Withdrawal request has been rejected.' };
    } catch (error: any) {
        console.error('Error rejecting withdrawal:', error);
        return { success: false, error: error.message };
    }
}
