'use server';

import { getFirestoreInstance } from '@/firebase/server';
import { doc, runTransaction, collection, serverTimestamp } from 'firebase/firestore';
import { revalidatePath } from 'next/cache';

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

        const { amount, metadata: { userId }, currency } = result.data;

        if (!userId) {
            throw new Error('User ID not found in transaction metadata.');
        }

        if (currency !== 'NGN') {
            throw new Error('Only NGN transactions are supported.');
        }
        
        const amountInNaira = amount / 100;

        const firestore = getFirestoreInstance();

        // Use a transaction to ensure atomicity
        await runTransaction(firestore, async (transaction) => {
            const depositRef = doc(firestore, 'deposits', reference);
            const depositDoc = await transaction.get(depositRef);
            if (depositDoc.exists) {
                throw new Error('This deposit has already been processed.');
            }

            const userDocRef = doc(firestore, 'users', userId);
            const userDoc = await transaction.get(userDocRef);
            if (!userDoc.exists()) {
                throw new Error('User profile does not exist.');
            }

            const currentBalance = userDoc.data().balance || 0;
            const newBalance = currentBalance + amountInNaira;

            // Update user's balance
            transaction.update(userDocRef, { balance: newBalance });

            // Log the deposit activity
            const activityDocRef = doc(collection(firestore, 'activities'));
            transaction.set(activityDocRef, {
                type: 'DEPOSIT',
                value: amountInNaira,
                userId,
                createdAt: serverTimestamp(),
            });

            // Mark this deposit as processed
            transaction.set(depositRef, {
                userId,
                amount: amountInNaira,
                processedAt: serverTimestamp(),
            });
        });

        revalidatePath('/transactions'); // Revalidate the wallet page
        revalidatePath('/portfolio'); 
        
        return { success: true, message: `Deposit of ₦${amountInNaira.toLocaleString()} was successful.` };

    } catch (error: any) {
        console.error('Paystack verification error:', error);
        return { success: false, error: error.message || 'An unknown error occurred during verification.' };
    }
}
