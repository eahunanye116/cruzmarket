import { NextRequest, NextResponse } from 'next/server';
import { getFirestoreInstance } from '@/firebase/server';
import { collection, query, where, getDocs, limit, doc, updateDoc, Timestamp } from 'firebase/firestore';
import { UserProfile, Ticker } from '@/lib/types';
import { executeBuyAction } from '@/app/actions/trade-actions';

async function sendTelegramMessage(chatId: string, text: string) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
        console.error("TELEGRAM_ERROR: Cannot send message because TELEGRAM_BOT_TOKEN is missing from environment variables.");
        return;
    }
    try {
        const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                chat_id: chatId, 
                text, 
                parse_mode: 'HTML', // Using HTML for better reliability with user-provided strings
                disable_web_page_preview: true 
            }),
        });
        const result = await response.json();
        if (!result.ok) {
            console.error("TELEGRAM_API_ERROR:", result.description, "for payload:", text);
        }
    } catch (error) {
        console.error("TELEGRAM_FETCH_FAILED:", error);
    }
}

export async function POST(req: NextRequest) {
    const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    if (!BOT_TOKEN) {
        console.error("Webhook received but TELEGRAM_BOT_TOKEN is not set.");
        return new NextResponse('Unauthorized', { status: 401 });
    }

    let body;
    try {
        body = await req.json();
    } catch (e) {
        return NextResponse.json({ ok: true });
    }

    const message = body.message;
    if (!message || !message.text) {
        return NextResponse.json({ ok: true });
    }

    const chatId = message.chat.id.toString();
    const text = message.text.trim();
    const firestore = getFirestoreInstance();

    console.log(`Telegram Bot: Received message "${text}" from Chat ID ${chatId}`);

    try {
        // --- 1. Handle Account Linking ---
        const parts = text.split(' ');
        let potentialCode = '';

        if (text.startsWith('/start') && parts.length === 2) {
            potentialCode = parts[1];
        } else if (text.length === 16 && !text.includes(' ')) {
            potentialCode = text;
        }

        if (potentialCode) {
            const usersRef = collection(firestore, 'users');
            const q = query(usersRef, where('telegramLinkingCode.code', '==', potentialCode), limit(1));
            const snapshot = await getDocs(q);

            if (snapshot.empty) {
                await sendTelegramMessage(chatId, "❌ <b>Invalid or expired linking code.</b>\n\nPlease generate a new one in the CruzMarket app settings.");
            } else {
                const userDoc = snapshot.docs[0];
                const userData = userDoc.data() as UserProfile;
                const expiry = userData.telegramLinkingCode?.expiresAt;

                if (expiry && expiry.toDate() < new Date()) {
                    await sendTelegramMessage(chatId, "❌ <b>This linking code has expired.</b>\n\nPlease generate a new one in the app.");
                } else {
                    // LINK SUCCESS
                    await updateDoc(userDoc.ref, {
                        telegramChatId: chatId,
                        telegramLinkingCode: null // Clear code after use
                    });
                    
                    const successMsg = `✅ <b>Success! Account Connected.</b>\n\nWelcome, <b>${userData.displayName || 'Trader'}</b>! Your wallet is now linked to this Telegram chat.\n\n<b>Available Commands:</b>\n/buy &lt;token_id&gt; &lt;amount&gt;\n/balance - Check your NGN wallet\n/help - Show all commands\n\n<i>Tip: You can copy Token IDs from the ticker page in the web app.</i>`;
                    await sendTelegramMessage(chatId, successMsg);
                }
            }
            return NextResponse.json({ ok: true });
        }

        // --- 2. Handle Generic Welcome ---
        if (text === '/start') {
            await sendTelegramMessage(chatId, "Welcome to <b>CruzMarket Bot</b>! 🚀\n\nTo link your account and start trading, go to the <b>Settings</b> page in the web app, generate a linking code, and send it here.");
            return NextResponse.json({ ok: true });
        }

        // --- 3. Identify Linked User ---
        const usersRef = collection(firestore, 'users');
        const userQuery = query(usersRef, where('telegramChatId', '==', chatId), limit(1));
        const userSnapshot = await getDocs(userQuery);

        if (userSnapshot.empty) {
            await sendTelegramMessage(chatId, "🔒 <b>Your account is not linked.</b>\n\nPlease go to Settings in the CruzMarket web app to connect your Telegram.");
            return NextResponse.json({ ok: true });
        }

        const userDoc = userSnapshot.docs[0];
        const userId = userDoc.id;
        const userData = userDoc.data() as UserProfile;

        // --- 4. Handle Commands for Linked Users ---
        const [command, ...args] = text.split(' ');

        if (command.toLowerCase() === '/buy') {
            if (args.length < 2) {
                await sendTelegramMessage(chatId, "Usage: <code>/buy &lt;token_id&gt; &lt;amount_ngn&gt;</code>\n\nExample: <code>/buy iqOc...ruz 5000</code>");
                return NextResponse.json({ ok: true });
            }

            const tickerId = args[0];
            const amount = parseFloat(args[1].replace(/,/g, ''));

            if (isNaN(amount) || amount < 100) {
                await sendTelegramMessage(chatId, "❌ <b>Minimum buy is ₦100.</b>");
                return NextResponse.json({ ok: true });
            }

            await sendTelegramMessage(chatId, `⏳ <b>Processing buy order...</b>`);
            
            const result = await executeBuyAction(userId, tickerId, amount);

            if (result.success) {
                await sendTelegramMessage(chatId, `🚀 <b>Purchase Successful!</b>\n\nYou bought approximately <b>${result.tokensOut?.toLocaleString()} $${result.tickerName?.split(' ')[0]}</b>.\n\n<b>New Balance:</b> ₦${(userData.balance - amount).toLocaleString()}`);
            } else {
                await sendTelegramMessage(chatId, `❌ <b>Order Failed:</b>\n${result.error}`);
            }
        } else if (command.toLowerCase() === '/balance') {
            await sendTelegramMessage(chatId, `💰 <b>Your Wallet Balance:</b>\n₦${userData.balance.toLocaleString()}`);
        } else if (command.toLowerCase() === '/help') {
            await sendTelegramMessage(chatId, "🤖 <b>CruzMarket Bot Commands</b>\n\n<code>/buy &lt;id&gt; &lt;ngn&gt;</code> - Buy a ticker instantly\n<code>/balance</code> - Check your NGN balance\n<code>/help</code> - Show this message");
        } else {
            if (text.length > 15 && !text.includes(' ')) {
                await sendTelegramMessage(chatId, `🔍 <b>Detected Token ID:</b>\n<code>${text}</code>\n\nReply with <code>/buy ${text} 1000</code> to purchase ₦1,000 worth.`);
            } else {
                await sendTelegramMessage(chatId, "❓ Unknown command. Type /help for available options.");
            }
        }
    } catch (error: any) {
        console.error("TELEGRAM_WEBHOOK_CRASH:", error);
    }

    return NextResponse.json({ ok: true });
}
