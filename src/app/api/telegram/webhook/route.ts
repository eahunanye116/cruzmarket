
import { NextRequest, NextResponse } from 'next/server';
import { getFirestoreInstance } from '@/firebase/server';
import { collection, query, where, getDocs, limit, doc, updateDoc, Timestamp } from 'firebase/firestore';
import { UserProfile, Ticker, PortfolioHolding } from '@/lib/types';
import { executeBuyAction } from '@/app/actions/trade-actions';
import { calculateReclaimableValue } from '@/lib/utils';

const TRANSACTION_FEE_PERCENTAGE = 0.002;

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
                parse_mode: 'HTML',
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
            potentialCode = parts[1].trim();
        } else if (text.length === 16 && !text.includes(' ')) {
            potentialCode = text.trim();
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
                        telegramLinkingCode: null 
                    });
                    
                    const successMsg = `✅ <b>Success! Account Connected.</b>\n\nWelcome, <b>${userData.displayName || 'Trader'}</b>! Your wallet is now linked to this Telegram chat.\n\n<b>Available Commands:</b>\n/buy &lt;address&gt; &lt;amount&gt;\n/portfolio - View your holdings\n/balance - Check your NGN wallet\n/help - Show all commands`;
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
                await sendTelegramMessage(chatId, "Usage: <code>/buy &lt;token_address&gt; &lt;amount_ngn&gt;</code>\n\nExample: <code>/buy iqOc...ruz 5000</code>");
                return NextResponse.json({ ok: true });
            }

            const tickerIdInput = args[0].trim();
            const amount = parseFloat(args[1].replace(/,/g, ''));

            if (isNaN(amount) || amount < 100) {
                await sendTelegramMessage(chatId, "❌ <b>Minimum buy is ₦100.</b>");
                return NextResponse.json({ ok: true });
            }

            await sendTelegramMessage(chatId, `⏳ <b>Processing buy order...</b>`);
            
            const result = await executeBuyAction(userId, tickerIdInput, amount);

            if (result.success) {
                await sendTelegramMessage(chatId, `🚀 <b>Purchase Successful!</b>\n\nYou bought approximately <b>${result.tokensOut?.toLocaleString()} $${result.tickerName?.split(' ')[0]}</b>.\n\n<b>New Balance:</b> ₦${(userData.balance - amount).toLocaleString()}`);
            } else {
                await sendTelegramMessage(chatId, `❌ <b>Order Failed:</b>\n${result.error}`);
            }
        } else if (command.toLowerCase() === '/portfolio') {
            await sendTelegramMessage(chatId, "📊 <b>Fetching your portfolio...</b>");
            
            const portfolioRef = collection(firestore, `users/${userId}/portfolio`);
            const holdingsSnapshot = await getDocs(portfolioRef);
            
            if (holdingsSnapshot.empty) {
                await sendTelegramMessage(chatId, "Your portfolio is currently empty. Start trading to see your holdings here!");
                return NextResponse.json({ ok: true });
            }

            const tickersSnapshot = await getDocs(collection(firestore, 'tickers'));
            const tickers = tickersSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Ticker));
            
            let totalPositionValue = 0;
            let messageText = "<b>📊 My Portfolio</b>\n\n";

            // Merge duplicates for Telegram display
            const mergedHoldings: Record<string, PortfolioHolding> = {};
            holdingsSnapshot.forEach(hDoc => {
                const h = hDoc.data() as PortfolioHolding;
                if (!mergedHoldings[h.tickerId]) {
                    mergedHoldings[h.tickerId] = { ...h };
                } else {
                    const existing = mergedHoldings[h.tickerId];
                    const totalCost = (existing.avgBuyPrice * existing.amount) + (h.avgBuyPrice * h.amount);
                    existing.amount += h.amount;
                    existing.avgBuyPrice = existing.amount > 0 ? totalCost / existing.amount : 0;
                }
            });

            Object.values(mergedHoldings).forEach(holding => {
                const ticker = tickers.find(t => t.id === holding.tickerId);
                if (ticker) {
                    const reclaimableValue = calculateReclaimableValue(holding.amount, ticker);
                    const fee = reclaimableValue * TRANSACTION_FEE_PERCENTAGE;
                    const currentValue = reclaimableValue - fee;
                    totalPositionValue += currentValue;

                    messageText += `<b>$${ticker.name.split(' ')[0]}</b>\n`;
                    messageText += `Held: ${holding.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}\n`;
                    messageText += `Value: ₦${currentValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n\n`;
                }
            });

            messageText += `------------------\n`;
            messageText += `<b>Positions Value:</b> ₦${totalPositionValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n`;
            messageText += `<b>Wallet Balance:</b> ₦${userData.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n`;
            messageText += `<b>Total Equity:</b> ₦${(totalPositionValue + userData.balance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n`;

            await sendTelegramMessage(chatId, messageText);

        } else if (command.toLowerCase() === '/balance') {
            await sendTelegramMessage(chatId, `💰 <b>Your Wallet Balance:</b>\n₦${userData.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
        } else if (command.toLowerCase() === '/help') {
            await sendTelegramMessage(chatId, "🤖 <b>CruzMarket Bot Commands</b>\n\n<code>/buy &lt;address&gt; &lt;ngn&gt;</code> - Buy a ticker instantly\n<code>/portfolio</code> - View your current holdings and value\n<code>/balance</code> - Check your NGN wallet balance\n<code>/help</code> - Show this message\n\n<i>Tip: You can copy Token Addresses directly from any ticker page in the web app.</i>");
        } else {
            // Check if user just pasted an ID
            const potentialId = text.trim();
            if (potentialId.length > 15 && !potentialId.includes(' ')) {
                await sendTelegramMessage(chatId, `🔍 <b>Detected Token Address:</b>\n<code>${potentialId}</code>\n\nReply with <code>/buy ${potentialId} 1000</code> to purchase ₦1,000 worth.`);
            } else {
                await sendTelegramMessage(chatId, "❓ Unknown command. Type /help for available options.");
            }
        }
    } catch (error: any) {
        console.error("TELEGRAM_WEBHOOK_CRASH:", error);
    }

    return NextResponse.json({ ok: true });
}
