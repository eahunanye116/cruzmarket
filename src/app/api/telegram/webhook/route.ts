import { NextRequest, NextResponse } from 'next/server';
import { getFirestoreInstance } from '@/firebase/server';
import { collection, query, where, getDocs, limit, doc, updateDoc, Timestamp } from 'firebase/firestore';
import { UserProfile, Ticker } from '@/lib/types';
import { executeBuyAction } from '@/app/actions/trade-actions';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

async function sendTelegramMessage(chatId: string, text: string) {
    if (!BOT_TOKEN) {
        console.error("TELEGRAM_ERROR: Cannot send message because TELEGRAM_BOT_TOKEN is missing from environment variables.");
        return;
    }
    try {
        const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                chat_id: chatId, 
                text, 
                parse_mode: 'Markdown',
                disable_web_page_preview: true 
            }),
        });
        const result = await response.json();
        if (!result.ok) {
            console.error("TELEGRAM_API_ERROR:", result.description);
        }
    } catch (error) {
        console.error("TELEGRAM_FETCH_FAILED:", error);
    }
}

export async function POST(req: NextRequest) {
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
        // We check for both "/start <code>" AND just the "<code>" itself for better UX
        const parts = text.split(' ');
        let potentialCode = '';

        if (text.startsWith('/start') && parts.length === 2) {
            potentialCode = parts[1];
        } else if (text.length === 16 && !text.includes(' ')) {
            // Likely a raw linking code sent without /start
            potentialCode = text;
        }

        if (potentialCode) {
            const usersRef = collection(firestore, 'users');
            const q = query(usersRef, where('telegramLinkingCode.code', '==', potentialCode), limit(1));
            const snapshot = await getDocs(q);

            if (snapshot.empty) {
                // If it was explicitly a /start command, warn them. 
                // If it was just random text that happened to be 16 chars, we could ignore, 
                // but usually users are trying to link.
                await sendTelegramMessage(chatId, "❌ *Invalid or expired linking code.*\n\nPlease generate a new one in the CruzMarket app settings.");
            } else {
                const userDoc = snapshot.docs[0];
                const userData = userDoc.data() as UserProfile;
                const expiry = userData.telegramLinkingCode?.expiresAt;

                if (expiry && expiry.toDate() < new Date()) {
                    await sendTelegramMessage(chatId, "❌ *This linking code has expired.*\n\nPlease generate a new one in the app.");
                } else {
                    // LINK SUCCESS
                    await updateDoc(userDoc.ref, {
                        telegramChatId: chatId,
                        telegramLinkingCode: null // Clear code after use
                    });
                    await sendTelegramMessage(chatId, `✅ *Success! Account Connected.*\n\nWelcome, *${userData.displayName}*! Your wallet is now linked to this Telegram chat.\n\n*Available Commands:*\n/buy <token_id> <amount>\n/balance - Check your NGN wallet\n/help - Show all commands\n\n_Tip: You can copy Token IDs from the ticker page in the web app._`);
                }
            }
            return NextResponse.json({ ok: true });
        }

        // --- 2. Handle Generic Welcome ---
        if (text === '/start') {
            await sendTelegramMessage(chatId, "Welcome to *CruzMarket Bot*! 🚀\n\nTo link your account and start trading, go to the *Settings* page in the web app, generate a linking code, and send it here.");
            return NextResponse.json({ ok: true });
        }

        // --- 3. Identify Linked User ---
        const usersRef = collection(firestore, 'users');
        const userQuery = query(usersRef, where('telegramChatId', '==', chatId), limit(1));
        const userSnapshot = await getDocs(userQuery);

        if (userSnapshot.empty) {
            await sendTelegramMessage(chatId, "🔒 *Your account is not linked.*\n\nPlease go to Settings in the CruzMarket web app to connect your Telegram.");
            return NextResponse.json({ ok: true });
        }

        const userDoc = userSnapshot.docs[0];
        const userId = userDoc.id;
        const userData = userDoc.data() as UserProfile;

        // --- 4. Handle Commands for Linked Users ---
        const [command, ...args] = text.split(' ');

        if (command.toLowerCase() === '/buy') {
            if (args.length < 2) {
                await sendTelegramMessage(chatId, "Usage: `/buy <token_id> <amount_ngn>`\n\nExample: `/buy iqOc...ruz 5000`\n\n_You can find the Token ID on any ticker's trade panel._");
                return NextResponse.json({ ok: true });
            }

            const tickerId = args[0];
            const amount = parseFloat(args[1].replace(/,/g, ''));

            if (isNaN(amount) || amount < 100) {
                await sendTelegramMessage(chatId, "❌ *Minimum buy is ₦100.*");
                return NextResponse.json({ ok: true });
            }

            await sendTelegramMessage(chatId, `⏳ *Processing buy order...*`);
            
            const result = await executeBuyAction(userId, tickerId, amount);

            if (result.success) {
                await sendTelegramMessage(chatId, `🚀 *Purchase Successful!*\n\nYou bought approximately *${result.tokensOut?.toLocaleString()} $${result.tickerName?.split(' ')[0]}*.\n\n*New Balance:* ₦${(userData.balance - amount).toLocaleString()}`);
            } else {
                await sendTelegramMessage(chatId, `❌ *Order Failed:*\n${result.error}`);
            }
        } else if (command.toLowerCase() === '/balance') {
            await sendTelegramMessage(chatId, `💰 *Your Wallet Balance:*\n₦${userData.balance.toLocaleString()}`);
        } else if (command.toLowerCase() === '/help') {
            await sendTelegramMessage(chatId, "🤖 *CruzMarket Bot Commands*\n\n`/buy <id> <ngn>` - Buy a ticker instantly\n`/balance` - Check your NGN balance\n`/help` - Show this message\n\n_Token IDs can be copied from the trade form on the ticker page in the web app._");
        } else {
            // Intelligent detection: If user sends just a Token ID (usually long, no spaces)
            if (text.length > 15 && !text.includes(' ')) {
                await sendTelegramMessage(chatId, `🔍 *Detected Token ID:*\n\`${text}\`\n\nReply with \`/buy ${text} 1000\` to purchase ₦1,000 worth.`);
            } else {
                await sendTelegramMessage(chatId, "❓ Unknown command. Type /help for available options.");
            }
        }
    } catch (error: any) {
        console.error("TELEGRAM_WEBHOOK_CRASH:", error);
    }

    return NextResponse.json({ ok: true });
}
