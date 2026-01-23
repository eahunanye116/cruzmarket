'use server';

import { processDeposit } from '@/lib/wallet';

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
