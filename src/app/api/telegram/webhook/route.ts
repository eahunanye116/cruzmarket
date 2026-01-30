import { NextRequest, NextResponse } from 'next/server';
import { getFirestoreInstance } from '@/firebase/server';
import { collection, query, where, getDocs, limit, updateDoc, doc } from 'firebase/firestore';
import { UserProfile, Ticker, PortfolioHolding } from '@/lib/types';
import { executeBuyAction, executeCreateTickerAction } from '@/app/actions/trade-actions';
import { calculateReclaimableValue } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

async function sendTelegramMessage(chatId: string, text: string, replyMarkup?: any) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) return;
    try {
        const response = await fetch(`https://api.paystack.co/https://api.telegram.org/bot${token}/sendMessage`, {
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
        if (!result.ok) {
            console.error("TELEGRAM_API_ERROR:", result.description);
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

function isValidUrl(url: string) {
    try {
        new URL(url);
        return true;
    } catch (e) {
        return false;
    }
}

export async function POST(req: NextRequest) {
    const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    if (!BOT_TOKEN) return new NextResponse('Unauthorized', { status: 401 });

    let body;
    try {
        body = await req.json();
    } catch (e) {
        return NextResponse.json({ ok: true });
    }

    const firestore = getFirestoreInstance();

    // --- A. Handle Callback Queries ---
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
            await sendTelegramMessage(chatId, "🔒 <b>Account not linked.</b> Connect in Settings.");
            return NextResponse.json({ ok: true });
        }

        const userDoc = userSnapshot.docs[0];
        const userData = userDoc.data() as UserProfile;
        const userId = userDoc.id;

        if (data.startsWith('buy_')) {
            const parts = data.split('_');
            const amountStr = parts[1];
            const tickerId = parts[2];

            if (amountStr === 'custom') {
                await sendTelegramMessage(chatId, `💸 <b>Custom Buy</b>\n\nBuying Token: <code>${tickerId}cruz</code>\n\nHow much NGN would you like to spend?\n\n(Reply with just the number)`, {
                    force_reply: true,
                    selective: true
                });
            } else {
                const amount = parseFloat(amountStr);
                await sendTelegramMessage(chatId, `⏳ <b>Processing...</b>`);
                const result = await executeBuyAction(userId, tickerId, amount);
                if (result.success) {
                    await sendTelegramMessage(chatId, `🚀 <b>Success!</b>\n\nYou bought <b>${result.tokensOut?.toLocaleString()} $${result.tickerName}</b>.`);
                } else {
                    await sendTelegramMessage(chatId, `❌ <b>Failed:</b> ${result.error}`);
                }
            }
        } else if (data.startsWith('page_')) {
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
        } else if (data.startsWith('set_mcap_')) {
            const mcap = data.replace('set_mcap_', '');
            await updateDoc(userDoc.ref, {
                'botSession.step': 'CREATE_BUY',
                'botSession.data.mcap': Number(mcap)
            });
            await sendTelegramMessage(chatId, `💰 <b>Final Step: Initial Buy</b>\n\nHow much NGN do you want to automatically buy when the token launches?\n\n<b>Minimum:</b> 1,000\n<b>Fee:</b> 0.2%\n\n<i>Note: This helps establish an initial price.</i>`);
        }
        return NextResponse.json({ ok: true });
    }

    // --- B. Handle Messages ---
    const message = body.message;
    if (!message || !message.text) return NextResponse.json({ ok: true });

    const chatId = message.chat.id.toString();
    const text = message.text.trim();

    try {
        // --- 1. Account Linking ---
        const parts = text.split(' ');
        let potentialCode = '';
        if (text.startsWith('/start') && parts.length === 2) potentialCode = parts[1].trim();
        else if (text.length === 16 && !text.includes(' ')) potentialCode = text.trim();

        if (potentialCode) {
            const usersRef = collection(firestore, 'users');
            const q = query(usersRef, where('telegramLinkingCode.code', '==', potentialCode), limit(1));
            const snapshot = await getDocs(q);

            if (snapshot.empty) {
                await sendTelegramMessage(chatId, "❌ <b>Invalid or expired code.</b>");
            } else {
                const userDoc = snapshot.docs[0];
                const userData = userDoc.data() as UserProfile;
                const expiry = userData.telegramLinkingCode?.expiresAt;

                if (expiry && expiry.toDate() < new Date()) {
                    await sendTelegramMessage(chatId, "❌ <b>Code expired.</b>");
                } else {
                    await updateDoc(userDoc.ref, { telegramChatId: chatId, telegramLinkingCode: null });
                    await sendTelegramMessage(chatId, `✅ <b>Account Connected!</b> Welcome, <b>${userData.displayName}</b>.\n\n/buy - Purchase tokens\n/create - Launch a token\n/portfolio - View holdings\n/help - All commands`);
                }
            }
            return NextResponse.json({ ok: true });
        }

        if (text === '/start') {
            await sendTelegramMessage(chatId, "Welcome to <b>CruzMarket Bot</b>! 🚀\n\nTo trade, go to <b>Settings</b> in the web app, generate a code, and send it here.");
            return NextResponse.json({ ok: true });
        }

        // --- Identify User ---
        const usersRef = collection(firestore, 'users');
        const userQuery = query(usersRef, where('telegramChatId', '==', chatId), limit(1));
        const userSnapshot = await getDocs(userQuery);

        if (userSnapshot.empty) {
            await sendTelegramMessage(chatId, "🔒 <b>Account not linked.</b> Please link in Settings.");
            return NextResponse.json({ ok: true });
        }

        const userDoc = userSnapshot.docs[0];
        const userId = userDoc.id;
        const userData = userDoc.data() as UserProfile;

        // --- Handle Cancel ---
        if (text.toLowerCase() === '/cancel') {
            await updateDoc(userDoc.ref, { botSession: null });
            await sendTelegramMessage(chatId, "❌ <b>Operation cancelled.</b> Session cleared.");
            return NextResponse.json({ ok: true });
        }

        // --- Stateful Conversation Flow ---
        if (userData.botSession?.type === 'CREATE_TICKER') {
            const step = userData.botSession.step;
            const sessionData = userData.botSession.data;

            if (step === 'CREATE_NAME') {
                if (text.length < 2 || text.length > 20) {
                    return await sendTelegramMessage(chatId, "❌ <b>Invalid Name.</b> Must be between 2 and 20 characters.");
                }
                await updateDoc(userDoc.ref, { 'botSession.step': 'CREATE_ICON', 'botSession.data.name': text });
                await sendTelegramMessage(chatId, "🖼 <b>Step 2: Icon URL</b>\n\nProvide a direct URL to a square image for your token icon.");
            } 
            else if (step === 'CREATE_ICON') {
                if (!isValidUrl(text)) return await sendTelegramMessage(chatId, "❌ <b>Invalid URL.</b> Please provide a direct image link.");
                await updateDoc(userDoc.ref, { 'botSession.step': 'CREATE_COVER', 'botSession.data.icon': text });
                await sendTelegramMessage(chatId, "🎨 <b>Step 3: Cover Image URL</b>\n\nProvide a direct URL to a widescreen (16:9) image for your token banner.");
            }
            else if (step === 'CREATE_COVER') {
                if (!isValidUrl(text)) return await sendTelegramMessage(chatId, "❌ <b>Invalid URL.</b> Please provide a direct image link.");
                await updateDoc(userDoc.ref, { 'botSession.step': 'CREATE_DESC', 'botSession.data.cover': text });
                await sendTelegramMessage(chatId, "📝 <b>Step 4: Description</b>\n\nWhat is your meme about? (Max 200 characters)");
            }
            else if (step === 'CREATE_DESC') {
                if (text.length < 10) return await sendTelegramMessage(chatId, "❌ <b>Too short.</b> Description must be at least 10 characters.");
                await updateDoc(userDoc.ref, { 'botSession.step': 'CREATE_MCAP', 'botSession.data.description': text });
                await sendTelegramMessage(chatId, "📊 <b>Step 5: Market Cap</b>\n\nChoose your starting valuation. Higher MCAPs cost more to launch but are more stable.", {
                    inline_keyboard: [
                        [{ text: "₦100,000 (Fee: ₦1,000)", callback_data: "set_mcap_100000" }],
                        [{ text: "₦1,000,000 (Fee: ₦4,000)", callback_data: "set_mcap_1000000" }],
                        [{ text: "₦5,000,000 (Fee: ₦7,000)", callback_data: "set_mcap_5000000" }],
                        [{ text: "₦10,000,000 (Fee: ₦9,990)", callback_data: "set_mcap_10000000" }]
                    ]
                });
            }
            else if (step === 'CREATE_BUY') {
                const buyAmount = parseFloat(text.replace(/,/g, ''));
                if (isNaN(buyAmount) || buyAmount < 1000) return await sendTelegramMessage(chatId, "❌ <b>Minimum buy is ₦1,000.</b>");
                
                await sendTelegramMessage(chatId, "⏳ <b>Deploying Ticker...</b>");
                const result = await executeCreateTickerAction({
                    userId,
                    name: sessionData.name,
                    icon: sessionData.icon,
                    coverImage: sessionData.cover,
                    description: sessionData.description,
                    supply: 1000000000,
                    initialMarketCap: sessionData.mcap,
                    initialBuyNgn: buyAmount
                });

                if (result.success) {
                    await updateDoc(userDoc.ref, { botSession: null });
                    await sendTelegramMessage(chatId, `🚀 <b>Ticker Launched!</b>\n\nYour token <b>$${sessionData.name}</b> is now live.\n\nView it at: cruzmarket.fun/ticker/${result.tickerId}`);
                } else {
                    await sendTelegramMessage(chatId, `❌ <b>Launch Failed:</b> ${result.error}\n\nType /cancel to clear session.`);
                }
            }
            return NextResponse.json({ ok: true });
        }

        // --- Custom Amount Reply Handling ---
        if (message.reply_to_message) {
            const promptText = message.reply_to_message.text;
            if (promptText && promptText.includes('Custom Buy')) {
                const match = promptText.match(/([a-zA-Z0-9]{15,})cruz/);
                if (match) {
                    const tickerId = match[1];
                    const amount = parseFloat(text.replace(/,/g, ''));
                    if (isNaN(amount) || amount < 100) {
                        await sendTelegramMessage(chatId, "❌ <b>Min buy is ₦100.</b>");
                        return NextResponse.json({ ok: true });
                    }
                    await sendTelegramMessage(chatId, `⏳ <b>Processing...</b>`);
                    const result = await executeBuyAction(userId, tickerId, amount);
                    if (result.success) await sendTelegramMessage(chatId, `🚀 <b>Success!</b> Bought $${result.tickerName}.`);
                    else await sendTelegramMessage(chatId, `❌ <b>Failed:</b> ${result.error}`);
                    return NextResponse.json({ ok: true });
                }
            }
        }

        // --- Standard Commands ---
        const [command, ...args] = text.split(' ');

        if (command.toLowerCase() === '/buy') {
            if (args.length < 2) {
                await sendTelegramMessage(chatId, "Usage: <code>/buy &lt;address&gt; &lt;amount&gt;</code>");
                return NextResponse.json({ ok: true });
            }
            const result = await executeBuyAction(userId, args[0], parseFloat(args[1]));
            if (result.success) await sendTelegramMessage(chatId, `🚀 <b>Success!</b> Bought $${result.tickerName}.`);
            else await sendTelegramMessage(chatId, `❌ <b>Failed:</b> ${result.error}`);

        } else if (command.toLowerCase() === '/create') {
            await updateDoc(userDoc.ref, {
                botSession: {
                    type: 'CREATE_TICKER',
                    step: 'CREATE_NAME',
                    data: {}
                }
            });
            await sendTelegramMessage(chatId, "🚀 <b>Launch a Ticker</b>\n\nFirst, enter the <b>Name</b> of your token (e.g., DogeCoin):");

        } else if (command.toLowerCase() === '/top') {
            const tickersSnap = await getDocs(collection(firestore, 'tickers'));
            let tickers = tickersSnap.docs.map(d => ({ id: d.id, ...d.data() } as Ticker));
            tickers.sort((a, b) => (b.volume24h || 0) - (a.volume24h || 0));
            await sendTelegramMessage(chatId, formatTickerList(tickers.slice(0, 5), "🔥 Top Volume", 0), { inline_keyboard: [[{ text: "Next 5 ➡️", callback_data: "page_top_5" }]] });

        } else if (command.toLowerCase() === '/latest') {
            const tickersSnap = await getDocs(collection(firestore, 'tickers'));
            let tickers = tickersSnap.docs.map(d => ({ id: d.id, ...d.data() } as Ticker));
            tickers.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
            await sendTelegramMessage(chatId, formatTickerList(tickers.slice(0, 5), "🆕 Latest", 0), { inline_keyboard: [[{ text: "Next 5 ➡️", callback_data: "page_latest_5" }]] });

        } else if (command.toLowerCase() === '/portfolio') {
            const portfolioRef = collection(firestore, `users/${userId}/portfolio`);
            const holdingsSnap = await getDocs(portfolioRef);
            if (holdingsSnap.empty) return await sendTelegramMessage(chatId, "Your portfolio is empty.");

            const tickersSnap = await getDocs(collection(firestore, 'tickers'));
            const tickers = tickersSnap.docs.map(d => ({ id: d.id, ...d.data() } as Ticker));
            
            let msg = "<b>📊 Portfolio</b>\n\n";
            let totalVal = 0;
            
            holdingsSnap.forEach(hDoc => {
                const h = hDoc.data() as PortfolioHolding;
                const ticker = tickers.find(t => t.id === h.tickerId);
                if (ticker) {
                    const val = calculateReclaimableValue(h.amount, ticker) * 0.998;
                    totalVal += val;
                    msg += `<b>$${ticker.name}</b>: ₦${val.toLocaleString(undefined, { maximumFractionDigits: 2 })}\n`;
                }
            });
            msg += `\n<b>Total</b>: ₦${totalVal.toLocaleString()}\n<b>Wallet</b>: ₦${userData.balance.toLocaleString()}`;
            await sendTelegramMessage(chatId, msg);

        } else if (command.toLowerCase() === '/balance') {
            await sendTelegramMessage(chatId, `💰 <b>Balance:</b> ₦${userData.balance.toLocaleString()}`);
        } else if (command.toLowerCase() === '/help') {
            await sendTelegramMessage(chatId, "🤖 <b>Commands</b>\n\n/buy &lt;addr&gt; &lt;ngn&gt;\n/create - Launch token\n/top - Trending\n/latest - Newest\n/portfolio - My holdings\n/balance - Wallet\n/cancel - Abort creation");
        }
    } catch (error: any) {
        console.error("WEBHOOK_ERROR:", error);
    }
    return NextResponse.json({ ok: true });
}
