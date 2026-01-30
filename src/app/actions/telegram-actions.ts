
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
        console.warn("Notification skipped: TELEGRAM_BOT_TOKEN not configured.");
        return;
    }
    try {
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                chat_id: chatId, 
                text, 
                parse_mode: 'HTML',
                disable_web_page_preview: false,
                reply_markup: replyMarkup 
            }),
        });
    } catch (error) {
        console.error("TELEGRAM_SEND_ERROR:", error);
    }
}

/**
 * Broadcasts a notification about a new ticker to the dedicated Telegram channel.
 */
export async function broadcastNewTickerNotification(tickerName: string, tickerAddress: string, tickerId: string) {
    // Prioritize username provided by user, then .env, then hard fallback
    const channelId = '@Cruzmarketfun_Tickers';
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://cruzmarket.fun';
    const botUsername = process.env.TELEGRAM_BOT_USERNAME || 'CruzMarketBot';

    const message = `🚀 <b>New Token Launched!</b>\n\n<b>$${tickerName}</b>\n\nToken Address:\n<code>${tickerAddress}</code>\n\n<a href="${baseUrl}/ticker/${tickerId}">Trade now on CruzMarket</a>`;

    // Deep-linking buttons for the bot
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

    try {
        await sendTelegramMessage(channelId, message, replyMarkup);
    } catch (error) {
        console.error("BROADCAST_ERROR:", error);
    }
}
