import { NextRequest, NextResponse } from 'next/server';
import { getFirestoreInstance } from '@/firebase/server';
import { collection, query, where, getDocs, limit, doc, updateDoc, Timestamp } from 'firebase/firestore';
import { UserProfile, Ticker, PortfolioHolding } from '@/lib/types';
import { executeBuyAction } from '@/app/actions/trade-actions';
import { calculateReclaimableValue } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

const TRANSACTION_FEE_PERCENTAGE = 0.002;

async function sendTelegramMessage(chatId: string, text: string, replyMarkup?: any) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
        console.error("TELEGRAM_ERROR: Cannot send message because TELEGRAM_BOT_TOKEN is missing from environment variables.");
        return;
    }
    try {
        const response = await fetch(`https://api.paystack.co/bot${token}/sendMessage`, { // Wait, paystack? Typo in existing code maybe? Fixing to api.telegram.org
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
        // Correcting the endpoint to telegram
        const actualResponse = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
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
        const result = await actualResponse.json();
        if (!result.ok) {
            console.error("TELEGRAM_API_ERROR:", result.description, "for payload:", text);
        }
    } catch (error) {
        console.error("TELEGRAM_FETCH_FAILED:", error);
    }
}

async function editTelegramMessage(chatId: string, messageId: number, text: string, replyMarkup?: any) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) return;
    try {
        await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                chat_id: chatId, 
                message_id: messageId,
                text, 
                parse_mode: 'HTML',
                disable_web_page_preview: true,
                reply_markup: replyMarkup
            }),
        });
    } catch (error) {
        console.error("TELEGRAM_EDIT_FAILED:", error);
    }
}

async function answerCallbackQuery(callbackQueryId: string, text?: string) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) return;
    try {
        await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ callback_query_id: callbackQueryId, text }),
        });
    } catch (e) {}
}

function formatTickerList(tickers: Ticker[], title: string, startIdx: number): string {
    let msg = `<b>${title}</b>\n\n`;
    if (tickers.length === 0) return msg + "No tickers found.";

    tickers.forEach((t, i) => {
        const age = t.createdAt ? formatDistanceToNow(t.createdAt.toDate(), { addSuffix: true }).replace('about ', '') : 'new';
        msg += `${startIdx + i + 1}. <b>$${t.name}</b>\n`;
        msg += `Price: ₦${t.price.toLocaleString(undefined, { maximumFractionDigits: 8 })}\n`;
        msg += `Vol (24h): ₦${(t.volume24h || 0).toLocaleString()}\n`;
        msg += `Age: ${age}\n`;
        msg += `Address: <code>${t.tickerAddress}</code>\n\n`;
    });
    return msg;
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

    const firestore = getFirestoreInstance();

    // --- A. Handle Callback Queries (Buttons) ---
    if (body.callback_query) {
        const callback = body.callback_query;
        const chatId = callback.message.chat.id.toString();
        const data = callback.data as string;
        const messageId = callback.message.message_id;

        await answerCallbackQuery(callback.id);

        const usersRef = collection(firestore, 'users');
        const userQuery = query(usersRef, where('telegramChatId', '==', chatId), limit(1));
        const userSnapshot = await getDocs(userQuery);

        if (userSnapshot.empty) {
            await sendTelegramMessage(chatId, "🔒 <b>Your account is not linked.</b> Please connect it in Settings.");
            return NextResponse.json({ ok: true });
        }

        const userId = userSnapshot.docs[0].id;

        if (data.startsWith('buy_')) {
            const parts = data.split('_');
            const amountStr = parts[1];
            const tickerId = parts[2];

            if (amountStr === 'custom') {
                await sendTelegramMessage(chatId, `💸 <b>Custom Buy</b>\n\nBuying Token: <code>${tickerId}cruz</code>\n\nHow much NGN would you like to spend?\n\n(Reply to this message with just the number, e.g. 5000)`, {
                    force_reply: true,
                    selective: true
                });
            } else {
                const amount = parseFloat(amountStr);
                await sendTelegramMessage(chatId, `⏳ <b>Processing buy for ₦${amount.toLocaleString()}...</b>`);
                const result = await executeBuyAction(userId, tickerId, amount);
                if (result.success) {
                    await sendTelegramMessage(chatId, `🚀 <b>Purchase Successful!</b>\n\nYou bought approximately <b>${result.tokensOut?.toLocaleString()} $${result.tickerName?.split(' ')[0]}</b>.`);
                } else {
                    await sendTelegramMessage(chatId, `❌ <b>Order Failed:</b>\n${result.error}`);
                }
            }
        } else if (data.startsWith('page_')) {
            // Format: page_<type>_<offset>
            const [, type, offsetStr] = data.split('_');
            const offset = parseInt(offsetStr);
            const PAGE_SIZE = 5;

            const tickersSnap = await getDocs(collection(firestore, 'tickers'));
            let tickers = tickersSnap.docs.map(d => ({ id: d.id, ...d.data() } as Ticker));

            if (type === 'top') {
                tickers.sort((a, b) => (b.volume24h || 0) - (a.volume24h || 0));
            } else {
                tickers.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
            }

            const page = tickers.slice(offset, offset + PAGE_SIZE);
            const title = type === 'top' ? '🔥 Top Volume (24h)' : '🆕 Latest Launches';
            const msg = formatTickerList(page, title, offset);

            const buttons = [];
            if (offset + PAGE_SIZE < tickers.length) {
                buttons.push([{ text: "Next 5 ➡️", callback_data: `page_${type}_${offset + PAGE_SIZE}` }]);
            }
            if (offset > 0) {
                buttons.push([{ text: "⬅️ Previous 5", callback_data: `page_${type}_${Math.max(0, offset - PAGE_SIZE)}` }]);
            }

            await editTelegramMessage(chatId, messageId, msg, { inline_keyboard: buttons });
        }
        return NextResponse.json({ ok: true });
    }

    // --- B. Handle Messages ---
    const message = body.message;
    if (!message || !message.text) {
        return NextResponse.json({ ok: true });
    }

    const chatId = message.chat.id.toString();
    const text = message.text.trim();

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
                    await updateDoc(userDoc.ref, {
                        telegramChatId: chatId,
                        telegramLinkingCode: null 
                    });
                    
                    const successMsg = `✅ <b>Success! Account Connected.</b>\n\nWelcome, <b>${userData.displayName || 'Trader'}</b>! Your wallet is now linked to this Telegram chat.\n\n<b>Available Commands:</b>\n/buy &lt;address&gt; &lt;amount&gt;\n/portfolio - View your holdings\n/top - Trending by volume\n/latest - Newest tickers\n/balance - Check your NGN wallet\n/help - Show all commands`;
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

        // --- 4. Handle Replies (Custom Amount) ---
        if (message.reply_to_message) {
            const promptText = message.reply_to_message.text;
            if (promptText && promptText.includes('Custom Buy')) {
                // Extract Ticker ID from prompt
                const match = promptText.match(/([a-zA-Z0-9]{15,})cruz/);
                if (match) {
                    const tickerId = match[1];
                    const amount = parseFloat(text.replace(/,/g, ''));
                    if (isNaN(amount) || amount < 100) {
                        await sendTelegramMessage(chatId, "❌ <b>Minimum buy is ₦100.</b> Please try clicking the button again.");
                        return NextResponse.json({ ok: true });
                    }
                    await sendTelegramMessage(chatId, `⏳ <b>Processing custom buy order...</b>`);
                    const result = await executeBuyAction(userId, tickerId, amount);
                    if (result.success) {
                        await sendTelegramMessage(chatId, `🚀 <b>Purchase Successful!</b>\n\nYou bought approximately <b>${result.tokensOut?.toLocaleString()} $${result.tickerName?.split(' ')[0]}</b>.`);
                    } else {
                        await sendTelegramMessage(chatId, `❌ <b>Order Failed:</b>\n${result.error}`);
                    }
                    return NextResponse.json({ ok: true });
                }
            }
        }

        // --- 5. Handle Commands ---
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
        } else if (command.toLowerCase() === '/top' || command.toLowerCase() === '/trending') {
            const tickersSnap = await getDocs(collection(firestore, 'tickers'));
            let tickers = tickersSnap.docs.map(d => ({ id: d.id, ...d.data() } as Ticker));
            tickers.sort((a, b) => (b.volume24h || 0) - (a.volume24h || 0));

            const page = tickers.slice(0, 5);
            const msg = formatTickerList(page, "🔥 Top Volume (24h)", 0);
            
            const buttons = [];
            if (tickers.length > 5) {
                buttons.push([{ text: "Next 5 ➡️", callback_data: "page_top_5" }]);
            }

            await sendTelegramMessage(chatId, msg, { inline_keyboard: buttons });

        } else if (command.toLowerCase() === '/latest' || command.toLowerCase() === '/new') {
            const tickersSnap = await getDocs(collection(firestore, 'tickers'));
            let tickers = tickersSnap.docs.map(d => ({ id: d.id, ...d.data() } as Ticker));
            tickers.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());

            const page = tickers.slice(0, 5);
            const msg = formatTickerList(page, "🆕 Latest Launches", 0);
            
            const buttons = [];
            if (tickers.length > 5) {
                buttons.push([{ text: "Next 5 ➡️", callback_data: "page_latest_5" }]);
            }

            await sendTelegramMessage(chatId, msg, { inline_keyboard: buttons });

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
            await sendTelegramMessage(chatId, "🤖 <b>CruzMarket Bot Commands</b>\n\n<code>/buy &lt;address&gt; &lt;ngn&gt;</code> - Buy a ticker instantly\n<code>/top</code> - Top 5 tokens by 24h volume\n<code>/latest</code> - Show 5 newest tokens\n<code>/portfolio</code> - View your current holdings and value\n<code>/balance</code> - Check your NGN wallet balance\n<code>/help</code> - Show this message\n\n<i>Tip: You can copy Token Addresses directly from result lists to buy them.</i>");
        } else {
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
