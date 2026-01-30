import { NextRequest, NextResponse } from 'next/server';
import { getFirestoreInstance } from '@/firebase/server';
import { collection, query, where, getDocs, limit, doc, updateDoc, Timestamp } from 'firebase/firestore';
import { UserProfile, Ticker } from '@/lib/types';
import { executeBuyAction } from '@/app/actions/trade-actions';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

async function sendTelegramMessage(chatId: string, text: string) {
    if (!BOT_TOKEN) return;
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
    });
}

export async function POST(req: NextRequest) {
    if (!BOT_TOKEN) return new NextResponse('Unauthorized', { status: 401 });

    const body = await req.json();
    const message = body.message;

    if (!message || !message.text) {
        return NextResponse.json({ ok: true });
    }

    const chatId = message.chat.id.toString();
    const text = message.text.trim();
    const firestore = getFirestoreInstance();

    // 1. Handle Account Linking (/start <code>)
    if (text.startsWith('/start')) {
        const parts = text.split(' ');
        if (parts.length === 2) {
            const code = parts[1];
            const usersRef = collection(firestore, 'users');
            const q = query(usersRef, where('telegramLinkingCode.code', '==', code), limit(1));
            const snapshot = await getDocs(q);

            if (snapshot.empty) {
                await sendTelegramMessage(chatId, "❌ Invalid or expired linking code. Please generate a new one in the CruzMarket app settings.");
            } else {
                const userDoc = snapshot.docs[0];
                const userData = userDoc.data() as UserProfile;
                const expiry = userData.telegramLinkingCode?.expiresAt;

                if (expiry && expiry.toDate() < new Date()) {
                    await sendTelegramMessage(chatId, "❌ This linking code has expired. Please generate a new one.");
                } else {
                    await updateDoc(userDoc.ref, {
                        telegramChatId: chatId,
                        telegramLinkingCode: null // Clear code after use
                    });
                    await sendTelegramMessage(chatId, `✅ Success! Your account (${userData.displayName}) is now connected to CruzMarket.\n\nCommands:\n/buy <ticker_id> <amount>\n/balance\n/help`);
                }
            }
            return NextResponse.json({ ok: true });
        }
        await sendTelegramMessage(chatId, "Welcome to CruzMarket Bot! 🚀\n\nTo link your account, go to Settings in the web app and use the link button.");
        return NextResponse.json({ ok: true });
    }

    // Identify user by Chat ID
    const usersRef = collection(firestore, 'users');
    const userQuery = query(usersRef, where('telegramChatId', '==', chatId), limit(1));
    const userSnapshot = await getDocs(userQuery);

    if (userSnapshot.empty) {
        await sendTelegramMessage(chatId, "🔒 Your Telegram account is not linked. Please connect it in the CruzMarket app settings.");
        return NextResponse.json({ ok: true });
    }

    const userDoc = userSnapshot.docs[0];
    const userId = userDoc.id;
    const userData = userDoc.data() as UserProfile;

    // 2. Handle Commands
    const [command, ...args] = text.split(' ');

    if (command.toLowerCase() === '/buy') {
        if (args.length < 2) {
            await sendTelegramMessage(chatId, "Usage: `/buy <token_id> <amount_ngn>`\nExample: `/buy iqOc...ruz 5000`\n\nYou can find the token ID on the ticker page.");
            return NextResponse.json({ ok: true });
        }

        const tickerId = args[0];
        const amount = parseFloat(args[1]);

        if (isNaN(amount) || amount < 100) {
            await sendTelegramMessage(chatId, "❌ Minimum buy is ₦100.");
            return NextResponse.json({ ok: true });
        }

        await sendTelegramMessage(chatId, `⏳ Processing buy order for ${tickerId}...`);
        
        const result = await executeBuyAction(userId, tickerId, amount);

        if (result.success) {
            await sendTelegramMessage(chatId, `🚀 *Buy Successful!*\n\nYou bought ${result.tokensOut?.toLocaleString()} $${result.tickerName?.split(' ')[0]}.\n\nNew Balance: ₦${(userData.balance - amount).toLocaleString()}`);
        } else {
            await sendTelegramMessage(chatId, `❌ *Order Failed:*\n${result.error}`);
        }
    } else if (command.toLowerCase() === '/balance') {
        await sendTelegramMessage(chatId, `💰 *Your Balance:*\n₦${userData.balance.toLocaleString()}`);
    } else if (command.toLowerCase() === '/help') {
        await sendTelegramMessage(chatId, "🤖 *CruzMarket Bot Commands*\n\n`/buy <id> <ngn>` - Buy a ticker\n`/balance` - Check your wallet\n`/help` - Show this message\n\n_Token IDs can be copied from the web app ticker page._");
    } else {
        // Echo ID for easy copying if user sends just the ID (nice UX)
        if (text.length > 15 && !text.includes(' ')) {
             await sendTelegramMessage(chatId, `Detected Token ID: \`${text}\`\n\nType \`/buy ${text} 1000\` to purchase.`);
        }
    }

    return NextResponse.json({ ok: true });
}
