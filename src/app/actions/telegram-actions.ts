'use server';

import { getFirestoreInstance } from '@/firebase/server';
import { doc, updateDoc, serverTimestamp, collection, query, where, getDocs, limit } from 'firebase/firestore';
import { revalidatePath } from 'next/cache';
import { UserProfile } from '@/lib/types';
import crypto from 'crypto';

// Hardcoded to ensure accuracy as requested by the user
const DEFAULT_BOT_USERNAME = 'cruzmarketfunbot';
const PRODUCTION_URL = 'https://cruzmarket.fun';

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
        revalidatePath('/transactions');
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
        revalidatePath('/transactions');
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function getTelegramBotUsername() {
    return DEFAULT_BOT_USERNAME;
}

export async function getTelegramWebhookInfoAction() {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
        return { success: false, error: "Bot token is not configured in environment variables." };
    }

    try {
        const res = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
        const result = await res.json();
        if (result.ok) {
            return { success: true, info: result.result };
        } else {
            return { success: false, error: result.description || "Failed to fetch info" };
        }
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function setTelegramWebhookAction(baseUrl: string) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
        return { success: false, error: "Bot token is not configured in environment variables." };
    }

    // Force production URL if provided base is just a slash or empty, or use the provided one
    const finalBaseUrl = baseUrl && baseUrl !== '/' ? baseUrl : PRODUCTION_URL;
    const webhookUrl = `${finalBaseUrl}/api/telegram/webhook`;
    
    try {
        console.log(`Setting Telegram Webhook to: ${webhookUrl}`);
        const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook?url=${webhookUrl}`);
        const result = await res.json();
        
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
            return { success: false, error: result.description || 'Failed to remove webhook.' };
        }
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

/**
 * Sends a message to a specific Telegram Chat ID
 */
export async function sendTelegramMessage(chatId: string, text: string, replyMarkup?: any) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
        console.warn("TELEGRAM_SEND_SKIPPED: TELEGRAM_BOT_TOKEN not configured.");
        return { success: false, error: "Token not configured" };
    }
    
    if (!chatId) {
        console.warn("TELEGRAM_SEND_SKIPPED: No chatId provided.");
        return { success: false, error: "No chatId" };
    }

    try {
        console.log(`TELEGRAM_SENDing to ${chatId}: ${text.substring(0, 50)}...`);
        const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                chat_id: chatId, 
                text, 
                parse_mode: 'HTML',
                disable_web_page_preview: true,
                reply_markup: replyMarkup 
            }),
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            console.error("TELEGRAM_API_ERROR:", result);
            return { success: false, error: result.description || "API Error" };
        }
        
        console.log(`TELEGRAM_SEND_SUCCESS to ${chatId}`);
        return { success: true };
    } catch (error: any) {
        console.error("TELEGRAM_FETCH_ERROR:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Broadcasts a notification about a new ticker to the dedicated Telegram channel.
 */
export async function broadcastNewTickerNotification(tickerName: string, tickerAddress: string, tickerId: string) {
    const channelId = '@Cruzmarketfun_Tickers';
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || PRODUCTION_URL;
    const botUsername = DEFAULT_BOT_USERNAME;

    const message = `🚀 <b>New Token Launched!</b>\n\n<b>$${tickerName}</b>\n\nToken Address:\n<code>${tickerAddress}</code>\n\n<a href="${baseUrl}/ticker/${tickerId}">Trade now on CruzMarket</a>`;

    const replyMarkup = {
        inline_keyboard: [
            [
                { text: "💰 Buy ₦1,000", url: `https://t.me/${botUsername}?start=buy_1000_${tickerId}` },
                { text: "💰 Buy ₦5,000", url: `https://t.me/${botUsername}?start=buy_5000_${tickerId}` }
            ],
            [
                { text: "🔗 Open Platform", url: `${baseUrl}/ticker/${tickerId}` }
            ]
        ]
    };

    await sendTelegramMessage(channelId, message, replyMarkup);
}
