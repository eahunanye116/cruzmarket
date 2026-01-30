'use server';

import { getFirestoreInstance } from '@/firebase/server';
import { doc, updateDoc, serverTimestamp, collection, query, where, getDocs, limit } from 'firebase/firestore';
import { revalidatePath } from 'next/cache';
import { UserProfile } from '@/lib/types';
import crypto from 'crypto';

export async function generateTelegramLinkingCode(userId: string) {
    const firestore = getFirestoreInstance();
    // Generate a secure 16-character hex string (8 bytes)
    const code = crypto.randomBytes(8).toString('hex'); 
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    try {
        const userRef = doc(firestore, 'users', userId);
        await updateDoc(userRef, {
            telegramLinkingCode: {
                code,
                expiresAt: expiresAt,
            }
        });
        revalidatePath('/settings');
        return { success: true, code };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function unlinkTelegramAction(userId: string) {
    const firestore = getFirestoreInstance();
    try {
        const userRef = doc(firestore, 'users', userId);
        await updateDoc(userRef, {
            telegramChatId: null,
            telegramLinkingCode: null,
        });
        revalidatePath('/settings');
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function getTelegramBotUsername() {
    // This assumes you set your bot's username in an env var.
    // If not, replace with your actual bot username.
    return process.env.TELEGRAM_BOT_USERNAME || 'CruzMarketBot';
}
