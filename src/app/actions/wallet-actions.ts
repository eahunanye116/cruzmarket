
'use server';

import { processDeposit } from '@/lib/wallet';
import { getFirestoreInstance } from '@/firebase/server';
import { collection, addDoc, serverTimestamp, doc, runTransaction, getDoc, query, where, getDocs } from 'firebase/firestore';
import { revalidatePath } from 'next/cache';
import type { UserProfile, WithdrawalRequest } from '@/lib/types';

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

type PaystackVerificationResponse = {
    status: boolean;
    message: string;
    data: {
        status: 'success' | 'failed';
        amount: number; // The amount is in the smallest currency unit (kobo for NGN)
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

        // Use the new centralized function to process the deposit
        await processDeposit(transactionReference, userId, amountInNaira);
        
        return { success: true, message: `Deposit of ₦${amountInNaira.toLocaleString()} was successful.` };

    } catch (error: any) {
        console.error('Paystack verification error:', error);
        return { success: false, error: error.message || 'An unknown error occurred during verification.' };
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

        // --- NEW: Check for existing PENDING requests ---
        const requestsRef = collection(firestore, 'withdrawalRequests');
        const pendingQuery = query(
            requestsRef, 
            where('userId', '==', payload.userId), 
            where('status', '==', 'pending')
        );
        const pendingSnapshot = await getDocs(pendingQuery);
        
        let totalPending = 0;
        pendingSnapshot.forEach(doc => {
            const data = doc.data() as WithdrawalRequest;
            totalPending += data.amount;
        });

        // Ensure total pending + new request doesn't exceed balance
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

            const userBalance = userDoc.data().balance;
            if (userBalance < requestData.amount) {
                throw new Error('User has insufficient balance for this withdrawal.');
            }

            // Debit user balance
            transaction.update(userRef, { balance: userBalance - requestData.amount });

            // Update request status
            transaction.update(requestRef, { status: 'completed', processedAt: serverTimestamp() });

            // Create activity log
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
        return { success: true, message: 'Withdrawal approved and processed.' };
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
        console.error('Error rejecting withdrawal:', error);
        return { success: false, error: error.message };
    }
}
