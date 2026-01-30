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
    return process.env.TELEGRAM_BOT_USERNAME || 'CruzMarketBot';
}

export async function setTelegramWebhookAction(baseUrl: string) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
        return { success: false, error: "Bot token is not configured in .env" };
    }

    const webhookUrl = `${baseUrl}/api/telegram/webhook`;
    
    try {
        const response = await fetch(`https://api.telegram.org/bot${token}/setWebhook?url=${webhookUrl}`);
        const result = await response.json();
        
        if (result.ok) {
            return { success: true, message: `Webhook set to ${webhookUrl}` };
        } else {
            return { success: false, error: result.description || 'Failed to set webhook.' };
        }
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function deleteTelegramWebhookAction() {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) return { success: false, error: "Bot token not configured." };

    try {
        const response = await fetch(`https://api.telegram.org/bot${token}/deleteWebhook`);
        const result = await response.json();
        if (result.ok) {
            return { success: true, message: "Webhook removed." };
        } else {
            return { success: false, error: result.description };
        }
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}
