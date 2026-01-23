'use server';

import { getFirestoreInstance } from '@/firebase/server';
import { doc, runTransaction, collection, serverTimestamp } from 'firebase/firestore';
import { revalidatePath } from 'next/cache';

/**
 * Processes a successful deposit by updating the user's balance and logging the transaction.
 * This function is designed to be called from a trusted server environment (Server Action or API Route).
 * It ensures that a deposit is only processed once.
 * @param reference - The unique Paystack transaction reference.
 * @param userId - The UID of the user to credit.
 * @param amountInNaira - The amount deposited in Naira.
 */
export async function processDeposit(reference: string, userId: string, amountInNaira: number) {
    if (!reference || !userId || !amountInNaira || amountInNaira <= 0) {
        throw new Error('Invalid deposit parameters.');
    }

    const firestore = getFirestoreInstance();

    // Use a transaction to ensure atomicity
    await runTransaction(firestore, async (transaction) => {
        const depositRef = doc(firestore, 'deposits', reference);
        const depositDoc = await transaction.get(depositRef);
        if (depositDoc.exists()) {
            // This deposit has already been processed. Silently exit to prevent errors from duplicate webhook calls.
            console.log(`Deposit reference ${reference} has already been processed. Skipping.`);
            return;
        }

        const userDocRef = doc(firestore, 'users', userId);
        const userDoc = await transaction.get(userDocRef);
        if (!userDoc.exists()) {
            throw new Error(`User profile with ID ${userId} does not exist.`);
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

    // Revalidate paths to show updated balance
    revalidatePath('/transactions'); // This is the Wallet page
    revalidatePath('/portfolio'); 
    console.log(`Successfully processed deposit for user ${userId}, reference ${reference}, amount ₦${amountInNaira}`);
}
