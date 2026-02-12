
# CruzMarket

**Welcome to CruzMarket: The Premier Battleground for Meme Tickers.**

CruzMarket isn't just another trading platform—it's a high-octane arena where internet culture becomes currency and hype is the ultimate asset. Dive into a volatile, fast-paced ecosystem of community-created tokens, each with its own narrative and explosive potential.

---

## 🛠 Production Worker Setup (Google Cloud Scheduler)

To ensure leveraged positions are liquidated in real-time even when no one is using the site, you must configure a **Cloud Scheduler** job.

### 1. Set Security Secret
In your **Vercel/App Hosting Dashboard**, add a new environment variable:
*   `CRON_SECRET`: Choose a long random string (e.g., `xyz_arena_secret_123`).

### 2. Configure Cloud Scheduler
1.  Go to **Google Cloud Console** > **Cloud Scheduler**.
2.  Create a new job:
    *   **Name**: `perp-liquidation-sweep`
    *   **Frequency**: `* * * * *` (Every minute)
    *   **URL**: `https://cruzmarket.fun/api/cron/liquidate`
    *   **HTTP Method**: `GET`
    *   **Auth Header**: `Add Auth Header` > `Bearer Token`.
    *   **Token**: Use your `CRON_SECRET` value.

---

## 🚀 Critical Production Deployment (Vercel)

If your bot stops working after you close FireStudio, it is because your webhook is still pointing to the temporary studio URL. Follow these steps to fix it permanently:

### 1. Set Environment Variables
Go to your **Vercel Dashboard** > **Settings** > **Environment Variables** and add:
*   `TELEGRAM_BOT_TOKEN`: Your token from @BotFather.
*   `PAYSTACK_SECRET_KEY`: Your secret key from Paystack.
*   `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY`: Your public key from Paystack.
*   `NOWPAYMENTS_API_KEY`: `299PEWX-X9C4349-NF28N7G-A2FFNYH`
*   `NOWPAYMENTS_IPN_SECRET`: Your IPN Secret from NowPayments Dashboard > Settings.
*   `NEXT_PUBLIC_APP_URL`: Set to `https://cruzmarket.fun`.

### 2. Redeploy
You **must** trigger a new deployment on Vercel after adding variables for them to take effect.

### 3. Finalize Webhook (Crucial)
1.  Open your **LIVE site** in a browser: `https://cruzmarket.fun`.
2.  Log in as Admin and go to `/admin`.
3.  Go to the **Telegram** tab.
4.  Ensure the URL is your live domain and click **"Set Webhook"**.

---

## 🤖 Telegram Setup Instructions

**1. Channel Alerts:**
*   Open Telegram and go to your channel: `@Cruzmarketfun_Tickers`.
*   Go to **Administrators** > **Add Administrator**.
*   Search for your bot: `@cruzmarketfunbot` and select it.
*   Ensure the permission **"Post Messages"** is enabled.

---

## 🔗 Webhooks Reference

*   **Paystack Webhook:** `https://cruzmarket.fun/api/webhooks/paystack`
*   **NowPayments Webhook:** `https://cruzmarket.fun/api/webhooks/nowpayments`
*   **Telegram Webhook:** `https://cruzmarket.fun/api/telegram/webhook`
