
import { NextRequest, NextResponse } from 'next/server';
import { getFirestoreInstance } from '@/firebase/server';
import { collection, query, where, getDocs, limit, updateDoc, doc, orderBy } from 'firebase/firestore';
import { UserProfile, Ticker, PortfolioHolding, WithdrawalRequest } from '@/lib/types';
import { executeBuyAction, executeSellAction, executeCreateTickerAction } from '@/app/actions/trade-actions';
import { requestWithdrawalAction } from '@/app/actions/wallet-actions';
import { calculateReclaimableValue, escapeHtmlForTelegram } from '@/lib/utils';
import { formatDistanceToNow, format } from 'date-fns';
import { sendTelegramMessage } from '@/app/actions/telegram-actions';

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
    } catch (error) {}
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
        msg += `${startIdx + i + 1}. <b>$${escapeHtmlForTelegram(t.name)}</b>\n`;
        msg += `Price: ₦${t.price.toLocaleString(undefined, { maximumFractionDigits: 8 })}\n`;
        msg += `Vol (24h): ₦${(t.volume24h || 0).toLocaleString()}\n`;
        msg += `Age: ${age}\n`;
        msg += `Address: <code>${t.tickerAddress}</code>\n\n`;
    });
    return msg;
}

function formatPortfolioList(mergedHoldings: [string, number][], tickers: Ticker[], startIdx: number, pageSize: number): string {
    let msg = "<b>📊 Portfolio</b>\n\n";
    const page = mergedHoldings.slice(startIdx, startIdx + pageSize);
    
    if (page.length === 0) return msg + "No assets found on this page.";

    page.forEach(([tId, amount], i) => {
        const ticker = tickers.find(t => t.id === tId);
        if (ticker) {
            const val = calculateReclaimableValue(amount, ticker) * 0.998;
            msg += `${startIdx + i + 1}. <b>$${escapeHtmlForTelegram(ticker.name)}</b>\n`;
            msg += `Value: ₦${val.toLocaleString(undefined, { maximumFractionDigits: 2 })}\n`;
            msg += `Address: <code>${ticker.tickerAddress}</code>\n\n`;
        }
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
        const userId = userDoc.id;
        const userData = userDoc.data() as UserProfile;

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
                    await sendTelegramMessage(chatId, `🚀 <b>Success!</b>\n\nYou bought <b>${result.tokensOut?.toLocaleString()} $${escapeHtmlForTelegram(result.tickerName)}</b>.\nFee: ₦${result.fee?.toLocaleString()}`);
                } else {
                    await sendTelegramMessage(chatId, `❌ <b>Failed:</b> ${escapeHtmlForTelegram(result.error)}`);
                }
            }
        } else if (data.startsWith('page_')) {
            const [, type, offsetStr] = data.split('_');
            const offset = parseInt(offsetStr);
            const PAGE_SIZE = 5;

            if (type === 'portfolio') {
                const portfolioRef = collection(firestore, `users/${userId}/portfolio`);
                const holdingsSnap = await getDocs(portfolioRef);
                const tickersSnap = await getDocs(collection(firestore, 'tickers'));
                const tickers = tickersSnap.docs.map(d => ({ id: d.id, ...d.data() } as Ticker));
                
                const merged: Record<string, number> = {};
                holdingsSnap.forEach(hDoc => {
                    const h = hDoc.data() as PortfolioHolding;
                    merged[h.tickerId] = (merged[h.tickerId] || 0) + h.amount;
                });
                const mergedEntries = Object.entries(merged);

                let totalVal = 0;
                mergedEntries.forEach(([tId, amount]) => {
                    const ticker = tickers.find(t => t.id === tId);
                    if (ticker) totalVal += calculateReclaimableValue(amount, ticker) * 0.998;
                });

                let msg = formatPortfolioList(mergedEntries, tickers, offset, PAGE_SIZE);
                msg += `\n<b>Total Position Value</b>: ₦${totalVal.toLocaleString()}\n<b>Wallet Balance</b>: ₦${userData.balance.toLocaleString()}\n<b>Total Equity</b>: ₦${(totalVal + userData.balance).toLocaleString()}`;
                
                const buttons = [];
                const row = [];
                if (offset > 0) row.push({ text: "⬅️ Previous 5", callback_data: `page_portfolio_${Math.max(0, offset - PAGE_SIZE)}` });
                if (offset + PAGE_SIZE < mergedEntries.length) row.push({ text: "Next 5 ➡️", callback_data: `page_portfolio_${offset + PAGE_SIZE}` });
                if (row.length > 0) buttons.push(row);

                await editTelegramMessage(chatId, messageId, msg, { inline_keyboard: buttons });
                return NextResponse.json({ ok: true });
            }

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
        } else if (data === 'skip_video') {
            await updateDoc(userDoc.ref, {
                'botSession.step': 'CREATE_MCAP',
                'botSession.data.video': null
            });
            await sendTelegramMessage(chatId, "📊 <b>Step 6: Market Cap</b>\n\nChoose your starting valuation. Higher MCAPs cost more to launch but are more stable.", {
                inline_keyboard: [
                    [{ text: "₦100 (Fee: ₦1)", callback_data: "set_mcap_100" }],
                    [{ text: "₦1,000 (Fee: ₦4)", callback_data: "set_mcap_1000" }],
                    [{ text: "₦5,000 (Fee: ₦7)", callback_data: "set_mcap_5000" }],
                    [{ text: "₦10,000 (Fee: ₦10)", callback_data: "set_mcap_10000" }]
                ]
            });
        } else if (data.startsWith('set_mcap_')) {
            const mcap = data.replace('set_mcap_', '');
            await updateDoc(userDoc.ref, {
                'botSession.step': 'CREATE_BUY',
                'botSession.data.mcap': Number(mcap)
            });
            await sendTelegramMessage(chatId, `💰 <b>Final Step: Initial Buy</b>\n\nHow much NGN do you want to automatically buy when the token launches?\n\n<b>Minimum:</b> 5\n<b>Fee:</b> 0.2%\n\n<i>Note: This helps establish an initial price.</i>`);
        }
        return NextResponse.json({ ok: true });
    }

    const message = body.message;
    if (!message || !message.text) return NextResponse.json({ ok: true });

    const chatId = message.chat.id.toString();
    const text = message.text.trim();

    try {
        const parts = text.split(' ');
        let startParam = '';
        if (text.startsWith('/start') && parts.length === 2) startParam = parts[1].trim();

        const usersRef = collection(firestore, 'users');
        const userQuery = query(usersRef, where('telegramChatId', '==', chatId), limit(1));
        const userSnapshot = await getDocs(userQuery);

        if (startParam) {
            if (startParam.startsWith('buy_')) {
                if (userSnapshot.empty) {
                    await sendTelegramMessage(chatId, "🔒 <b>Account not linked.</b> Please link in Settings before you can trade.");
                    return NextResponse.json({ ok: true });
                }
                const [, amountStr, tId] = startParam.split('_');
                const amount = parseFloat(amountStr);
                const userId = userSnapshot.docs[0].id;

                await sendTelegramMessage(chatId, `⏳ <b>Processing Trade Request...</b>`);
                const result = await executeBuyAction(userId, tId, amount);
                if (result.success) {
                    await sendTelegramMessage(chatId, `🚀 <b>Success!</b>\n\nYou bought <b>${result.tokensOut?.toLocaleString()} $${escapeHtmlForTelegram(result.tickerName)}</b> via channel deep link.\nFee: ₦${result.fee?.toLocaleString()}`);
                } else {
                    await sendTelegramMessage(chatId, `❌ <b>Deep Link Trade Failed:</b> ${escapeHtmlForTelegram(result.error)}`);
                }
                return NextResponse.json({ ok: true });
            }

            if (startParam.length === 16) {
                const q = query(usersRef, where('telegramLinkingCode.code', '==', startParam), limit(1));
                const snap = await getDocs(q);

                if (snap.empty) {
                    await sendTelegramMessage(chatId, "❌ <b>Invalid or expired code.</b>");
                } else {
                    const userDoc = snap.docs[0];
                    const userData = userDoc.data() as UserProfile;
                    const expiry = userData.telegramLinkingCode?.expiresAt;

                    if (expiry && expiry.toDate() < new Date()) {
                        await sendTelegramMessage(chatId, "❌ <b>Code expired.</b>");
                    } else {
                        await updateDoc(userDoc.ref, { telegramChatId: chatId, telegramLinkingCode: null });
                        await sendTelegramMessage(chatId, `✅ <b>Account Connected!</b> Welcome, <b>${escapeHtmlForTelegram(userData.displayName)}</b>.\n\n/buy - Purchase tokens\n/sell - Sell tokens\n/create - Launch a token\n/portfolio - View holdings\n/withdraw - Request funds\n/help - All commands`);
                    }
                }
                return NextResponse.json({ ok: true });
            }
        }

        if (userSnapshot.empty) {
            if (text === '/start') {
                await sendTelegramMessage(chatId, "Welcome to <b>CruzMarket Bot</b>! 🚀\n\nTo trade, go to <b>Settings</b> in the web app, generate a code, and send it here.");
            } else {
                await sendTelegramMessage(chatId, "🔒 <b>Account not linked.</b> Please link in Settings.");
            }
            return NextResponse.json({ ok: true });
        }

        const userDoc = userSnapshot.docs[0];
        const userId = userDoc.id;
        const userData = userDoc.data() as UserProfile;

        if (text === '/start') {
            await sendTelegramMessage(chatId, `Welcome back, <b>${escapeHtmlForTelegram(userData.displayName)}</b>! 🚀\n\nYou're connected to CruzMarket. Ready to find the next moonshot?\n\n/buy - Purchase tokens\n/sell - Sell tokens\n/create - Launch a token\n/portfolio - View holdings\n/withdraw - Request funds\n/top - Trending tickers\n/help - All commands`);
            return NextResponse.json({ ok: true });
        }

        if (text.toLowerCase() === '/cancel') {
            const wasInSession = !!userData.botSession;
            await updateDoc(userDoc.ref, { botSession: null });
            if (wasInSession) {
                await sendTelegramMessage(chatId, "⏹ <b>Process Ended.</b>\n\nYour session has been cleared. You can start fresh or explore the market with /top.");
            } else {
                await sendTelegramMessage(chatId, "ℹ️ <b>No active process to cancel.</b>");
            }
            return NextResponse.json({ ok: true });
        }

        if (userData.botSession) {
            const { type, step, data: sessionData } = userData.botSession;

            if (type === 'WITHDRAW_FUNDS') {
                if (step === 'WITHDRAW_AMOUNT') {
                    const amount = parseFloat(text.replace(/,/g, ''));
                    if (isNaN(amount) || amount < 20) {
                        await sendTelegramMessage(chatId, "❌ <b>Invalid Amount.</b> Minimum withdrawal is 20.");
                        return NextResponse.json({ ok: true });
                    }
                    if (amount > userData.balance) {
                        await sendTelegramMessage(chatId, `❌ <b>Insufficient Balance.</b> Your wallet has ₦${userData.balance.toLocaleString()}.`);
                        return NextResponse.json({ ok: true });
                    }
                    await updateDoc(userDoc.ref, { 'botSession.step': 'WITHDRAW_BANK', 'botSession.data.amount': amount });
                    await sendTelegramMessage(chatId, "🏦 <b>Step 2: Bank Name</b>\n\nEnter the name of your bank (e.g., Kuda Bank, Zenith Bank).");
                } 
                else if (step === 'WITHDRAW_BANK') {
                    if (text.length < 2) {
                        await sendTelegramMessage(chatId, "❌ <b>Bank name is too short.</b>");
                        return NextResponse.json({ ok: true });
                    }
                    await updateDoc(userDoc.ref, { 'botSession.step': 'WITHDRAW_ACCOUNT_NUM', 'botSession.data.bank': text });
                    await sendTelegramMessage(chatId, "🔢 <b>Step 3: Account Number</b>\n\nEnter your 10-digit account number.");
                }
                else if (step === 'WITHDRAW_ACCOUNT_NUM') {
                    if (!/^\d{10}$/.test(text)) {
                        await sendTelegramMessage(chatId, "❌ <b>Invalid Format.</b> Please enter exactly 10 digits.");
                        return NextResponse.json({ ok: true });
                    }
                    await updateDoc(userDoc.ref, { 'botSession.step': 'WITHDRAW_ACCOUNT_NAME', 'botSession.data.accountNumber': text });
                    await sendTelegramMessage(chatId, "👤 <b>Step 4: Account Name</b>\n\nEnter the full name associated with this bank account.");
                }
                else if (step === 'WITHDRAW_ACCOUNT_NAME') {
                    if (text.length < 3) {
                        await sendTelegramMessage(chatId, "❌ <b>Name is too short.</b>");
                        return NextResponse.json({ ok: true });
                    }
                    
                    await sendTelegramMessage(chatId, "⏳ <b>Submitting Request...</b>");
                    const result = await requestWithdrawalAction({
                        userId,
                        amount: sessionData.amount,
                        bankName: sessionData.bank,
                        accountNumber: sessionData.accountNumber,
                        accountName: text
                    });

                    if (result.success) {
                        await updateDoc(userDoc.ref, { botSession: null });
                        await sendTelegramMessage(chatId, `✅ <b>Request Submitted!</b>\n\nYour request for <b>₦${sessionData.amount.toLocaleString()}</b> has been received. Our team will process it shortly.\n\nType /withdrawals to check status.`);
                    } else {
                        await sendTelegramMessage(chatId, `❌ <b>Submission Failed:</b> ${escapeHtmlForTelegram(result.error)}\n\nType /cancel to clear session.`);
                    }
                }
                return NextResponse.json({ ok: true });
            }

            if (type === 'CREATE_TICKER') {
                if (step === 'CREATE_NAME') {
                    if (text.length < 2 || text.length > 20) {
                        await sendTelegramMessage(chatId, "❌ <b>Invalid Name.</b> Must be between 2 and 20 characters.");
                        return NextResponse.json({ ok: true });
                    }
                    await updateDoc(userDoc.ref, { 'botSession.step': 'CREATE_ICON', 'botSession.data.name': text });
                    await sendTelegramMessage(chatId, "🖼 <b>Step 2: Icon URL</b>\n\nProvide a direct URL to a square image for your token icon.");
                } 
                else if (step === 'CREATE_ICON') {
                    if (!isValidUrl(text)) {
                        await sendTelegramMessage(chatId, "❌ <b>Invalid URL.</b> Please provide a direct image link.");
                        return NextResponse.json({ ok: true });
                    }
                    await updateDoc(userDoc.ref, { 'botSession.step': 'CREATE_COVER', 'botSession.data.icon': text });
                    await sendTelegramMessage(chatId, "🎨 <b>Step 3: Cover Image URL</b>\n\nProvide a direct URL to a widescreen (16:9) image for your token banner.");
                }
                else if (step === 'CREATE_COVER') {
                    if (!isValidUrl(text)) {
                        await sendTelegramMessage(chatId, "❌ <b>Invalid URL.</b> Please provide a direct image link.");
                        return NextResponse.json({ ok: true });
                    }
                    await updateDoc(userDoc.ref, { 'botSession.step': 'CREATE_DESC', 'botSession.data.cover': text });
                    await sendTelegramMessage(chatId, "📝 <b>Step 4: Description</b>\n\nWhat is your meme about? (Max 200 characters)");
                }
                else if (step === 'CREATE_DESC') {
                    if (text.length < 10) {
                        await sendTelegramMessage(chatId, "❌ <b>Too short.</b> Description must be at least 10 characters.");
                        return NextResponse.json({ ok: true });
                    }
                    await updateDoc(userDoc.ref, { 'botSession.step': 'CREATE_VIDEO', 'botSession.data.description': text });
                    await sendTelegramMessage(chatId, "🎥 <b>Step 5: Video URL (Optional)</b>\n\nPaste a YouTube, TikTok, or Instagram URL if you want a video on your page. Otherwise, click skip.", {
                        inline_keyboard: [[{ text: "⏭ Skip Step", callback_data: "skip_video" }]]
                    });
                }
                else if (step === 'CREATE_VIDEO') {
                    if (!isValidUrl(text)) {
                        await sendTelegramMessage(chatId, "❌ <b>Invalid URL.</b> Please provide a valid video link or click skip.");
                        return NextResponse.json({ ok: true });
                    }
                    await updateDoc(userDoc.ref, { 'botSession.step': 'CREATE_MCAP', 'botSession.data.video': text });
                    await sendTelegramMessage(chatId, "📊 <b>Step 6: Market Cap</b>\n\nChoose your starting valuation. Higher MCAPs cost more to launch but are more stable.", {
                        inline_keyboard: [
                            [{ text: "₦100 (Fee: ₦1)", callback_data: "set_mcap_100" }],
                            [{ text: "₦1,000 (Fee: ₦4)", callback_data: "set_mcap_1000" }],
                            [{ text: "₦5,000 (Fee: ₦7)", callback_data: "set_mcap_5000" }],
                            [{ text: "₦10,000 (Fee: ₦10)", callback_data: "set_mcap_10000" }]
                        ]
                    });
                }
                else if (step === 'CREATE_BUY') {
                    const buyAmount = parseFloat(text.replace(/,/g, ''));
                    if (isNaN(buyAmount) || buyAmount < 5) {
                        await sendTelegramMessage(chatId, "❌ <b>Minimum buy is 5.</b>");
                        return NextResponse.json({ ok: true });
                    }
                    
                    await sendTelegramMessage(chatId, "⏳ <b>Deploying Ticker...</b>");
                    const result = await executeCreateTickerAction({
                        userId,
                        name: sessionData.name,
                        icon: sessionData.icon,
                        coverImage: sessionData.cover,
                        description: sessionData.description,
                        videoUrl: sessionData.video || undefined,
                        supply: 1000000000,
                        initialMarketCap: sessionData.mcap,
                        initialBuyNgn: buyAmount
                    });

                    if (result.success) {
                        await updateDoc(userDoc.ref, { botSession: null });
                        await sendTelegramMessage(chatId, `🚀 <b>Ticker Launched!</b>\n\nYour token <b>$${escapeHtmlForTelegram(sessionData.name)}</b> is now live.\nFee: ₦${result.fee?.toLocaleString()}\n\nView it at: cruzmarket.fun/ticker/${result.tickerId}`);
                    } else {
                        await sendTelegramMessage(chatId, `❌ <b>Launch Failed:</b> ${escapeHtmlForTelegram(result.error)}\n\nType /cancel to clear session.`);
                    }
                }
                return NextResponse.json({ ok: true });
            }
        }

        if (message.reply_to_message) {
            const promptText = message.reply_to_message.text;
            if (promptText && promptText.includes('Custom Buy')) {
                const match = promptText.match(/([a-zA-Z0-9]{15,})cruz/);
                if (match) {
                    const tickerId = match[1];
                    const amount = parseFloat(text.replace(/,/g, ''));
                    if (isNaN(amount) || amount < 1) {
                        await sendTelegramMessage(chatId, "❌ <b>Min buy is 1.</b>");
                        return NextResponse.json({ ok: true });
                    }
                    await sendTelegramMessage(chatId, `⏳ <b>Processing...</b>`);
                    const result = await executeBuyAction(userId, tickerId, amount);
                    if (result.success) await sendTelegramMessage(chatId, `🚀 <b>Success!</b> Bought $${escapeHtmlForTelegram(result.tickerName)}.\nFee: ₦${result.fee?.toLocaleString()}`);
                    else await sendTelegramMessage(chatId, `❌ <b>Failed:</b> ${escapeHtmlForTelegram(result.error)}`);
                    return NextResponse.json({ ok: true });
                }
            }
        }

        const [command, ...args] = text.split(' ');

        if (command.toLowerCase() === '/buy') {
            if (args.length < 2) {
                await sendTelegramMessage(chatId, "Usage: <code>/buy &lt;address&gt; &lt;amount_ngn&gt;</code>");
                return NextResponse.json({ ok: true });
            }
            const result = await executeBuyAction(userId, args[0], parseFloat(args[1]));
            if (result.success) await sendTelegramMessage(chatId, `🚀 <b>Success!</b> Bought $${escapeHtmlForTelegram(result.tickerName)}.\nFee: ₦${result.fee?.toLocaleString()}`);
            else await sendTelegramMessage(chatId, `❌ <b>Failed:</b> ${escapeHtmlForTelegram(result.error)}`);

        } else if (command.toLowerCase() === '/sell') {
            if (args.length < 2) {
                await sendTelegramMessage(chatId, "Usage: <code>/sell &lt;address&gt; &lt;token_amount&gt;</code>\n\n<i>Tip: Enter 'all' to sell your entire holding.</i>");
                return NextResponse.json({ ok: true });
            }
            
            let resolvedId = args[0].trim();
            if (resolvedId.toLowerCase().endsWith('cruz') && resolvedId.length > 5) {
                resolvedId = resolvedId.slice(0, -4);
            }

            let amountToSell = 0;
            if (args[1].toLowerCase() === 'all') {
                const portfolioRef = collection(firestore, `users/${userId}/portfolio`);
                const q = query(portfolioRef, where('tickerId', '==', resolvedId));
                const snap = await getDocs(q);
                if (snap.empty) {
                    await sendTelegramMessage(chatId, "❌ <b>You do not own this token.</b>");
                    return NextResponse.json({ ok: true });
                }
                amountToSell = snap.docs.reduce((acc, d) => acc + (d.data().amount || 0), 0);
            } else {
                amountToSell = parseFloat(args[1].replace(/,/g, ''));
            }

            if (isNaN(amountToSell) || amountToSell <= 0) {
                await sendTelegramMessage(chatId, "❌ <b>Invalid amount.</b>");
                return NextResponse.json({ ok: true });
            }

            await sendTelegramMessage(chatId, `⏳ <b>Processing Sale...</b>`);
            const result = await executeSellAction(userId, resolvedId, amountToSell);
            if (result.success) await sendTelegramMessage(chatId, `💰 <b>Sale Successful!</b>\n\nYou sold <b>${amountToSell.toLocaleString()} $${escapeHtmlForTelegram(result.tickerName)}</b> and received <b>₦${result.ngnToUser?.toLocaleString()}</b>.\nFee: ₦${result.fee?.toLocaleString()}`);
            else await sendTelegramMessage(chatId, `❌ <b>Failed:</b> ${escapeHtmlForTelegram(result.error)}`);

        } else if (command.toLowerCase() === '/create') {
            await updateDoc(userDoc.ref, {
                botSession: {
                    type: 'CREATE_TICKER',
                    step: 'CREATE_NAME',
                    data: {}
                }
            });
            await sendTelegramMessage(chatId, "🚀 <b>Launch a Ticker</b>\n\nFirst, enter the <b>Name</b> of your token (e.g., DogeCoin):\n\n<i>Type /cancel at any time to abort.</i>");

        } else if (command.toLowerCase() === '/withdraw') {
            await updateDoc(userDoc.ref, {
                botSession: {
                    type: 'WITHDRAW_FUNDS',
                    step: 'WITHDRAW_AMOUNT',
                    data: {}
                }
            });
            await sendTelegramMessage(chatId, `💸 <b>Withdraw Funds</b>\n\nHow much NGN would you like to withdraw?\n\n<b>Min:</b> 20\n<b>Balance:</b> ₦${userData.balance.toLocaleString()}`);

        } else if (command.toLowerCase() === '/withdrawals') {
            const requestsRef = collection(firestore, 'withdrawalRequests');
            const q = query(requestsRef, where('userId', '==', userId));
            const snap = await getDocs(q);
            
            if (snap.empty) {
                await sendTelegramMessage(chatId, "No withdrawal history found.");
            } else {
                const requests = snap.docs
                    .map(d => ({ id: d.id, ...d.data() } as WithdrawalRequest))
                    .sort((a, b) => {
                        const timeA = a.createdAt?.toMillis() || 0;
                        const timeB = b.createdAt?.toMillis() || 0;
                        return timeB - timeA;
                    })
                    .slice(0, 5);

                let msg = "💳 <b>Recent Withdrawals</b>\n\n";
                requests.forEach(r => {
                    const date = r.createdAt ? format(r.createdAt.toDate(), 'dd MMM') : 'N/A';
                    const statusIcon = r.status === 'completed' ? '✅' : r.status === 'rejected' ? '❌' : '⏳';
                    msg += `${statusIcon} <b>₦${r.amount.toLocaleString()}</b> - ${date}\n`;
                    msg += `Status: ${r.status.toUpperCase()}\n`;
                    if (r.status === 'rejected' && r.rejectionReason) msg += `Reason: ${escapeHtmlForTelegram(r.rejectionReason)}\n`;
                    msg += "\n";
                });
                await sendTelegramMessage(chatId, msg);
            }

        } else if (command.toLowerCase() === '/top') {
            const tickersSnap = await getDocs(collection(firestore, 'tickers'));
            let tickers = tickersSnap.docs.map(d => ({ id: d.id, ...d.data() } as Ticker));
            tickers.sort((a, b) => (b.volume24h || 0) - (a.volume24h || 0));
            await sendTelegramMessage(chatId, formatTickerList(tickers.slice(0, 5), "🔥 Top Volume", 0), { inline_keyboard: [[{ text: "Next 5 ➡️", callback_data: "page_top_5" }]] });

        } else if (command.toLowerCase() === '/portfolio') {
            const portfolioRef = collection(firestore, `users/${userId}/portfolio`);
            const holdingsSnap = await getDocs(portfolioRef);
            if (holdingsSnap.empty) return await sendTelegramMessage(chatId, "Your portfolio is empty.");

            const tickersSnap = await getDocs(collection(firestore, 'tickers'));
            const tickers = tickersSnap.docs.map(d => ({ id: d.id, ...d.data() } as Ticker));
            
            const merged: Record<string, number> = {};
            holdingsSnap.forEach(hDoc => {
                const h = hDoc.data() as PortfolioHolding;
                merged[h.tickerId] = (merged[h.tickerId] || 0) + h.amount;
            });

            const mergedEntries = Object.entries(merged);
            const PAGE_SIZE = 5;
            
            let totalVal = 0;
            mergedEntries.forEach(([tId, amount]) => {
                const ticker = tickers.find(t => t.id === tId);
                if (ticker) {
                    totalVal += calculateReclaimableValue(amount, ticker) * 0.998;
                }
            });

            let msg = formatPortfolioList(mergedEntries, tickers, 0, PAGE_SIZE);
            msg += `\n<b>Total Position Value</b>: ₦${totalVal.toLocaleString()}\n<b>Wallet Balance</b>: ₦${userData.balance.toLocaleString()}\n<b>Total Equity</b>: ₦${(totalVal + userData.balance).toLocaleString()}`;

            const buttons = [];
            if (mergedEntries.length > PAGE_SIZE) {
                buttons.push([{ text: "Next 5 ➡️", callback_data: `page_portfolio_5` }]);
            }

            await sendTelegramMessage(chatId, msg, { inline_keyboard: buttons });

        } else if (command.toLowerCase() === '/balance') {
            await sendTelegramMessage(chatId, `💰 <b>Balance:</b> ₦${userData.balance.toLocaleString()}`);
        } else if (command.toLowerCase() === '/help') {
            await sendTelegramMessage(chatId, "🤖 <b>Commands</b>\n\n/buy &lt;addr&gt; &lt;ngn&gt; - Purchase tokens\n/sell &lt;addr&gt; &lt;tokens&gt; - Sell tokens\n/create - Launch token step-by-step\n/withdraw - Request funds\n/withdrawals - Check request status\n/top - Trending by volume\n/portfolio - View holdings & equity\n/balance - Wallet balance\n/cancel - Abort current process");
        }
    } catch (error: any) {
        console.error("WEBHOOK_ERROR:", error);
    }
    return NextResponse.json({ ok: true });
}
