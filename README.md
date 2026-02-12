
# CruzMarket

**Welcome to CruzMarket: The Premier Battleground for Meme Tickers.**

CruzMarket isn't just another trading platform—it's a high-octane arena where internet culture becomes currency and hype is the ultimate asset. Dive into a volatile, fast-paced ecosystem of community-created tokens, each with its own narrative and explosive potential.

---

## 🔥 Professional Perpetual Worker (Cloud Run)

For high-leverage perpetual trading (400x), standard 1-minute cron jobs are too slow. We provide a dedicated worker script that runs every 10 seconds.

### 1. Requirements
Ensure your `FIREBASE_SERVICE_ACCOUNT` (or API Key credentials) and `CRON_SECRET` are set in the environment where the worker runs.

### 2. Local/VPS Run
To run the worker manually on a server:
```bash
npm run worker:liquidate
```

### 3. Production (Google Cloud Run)
Deployment flow for a persistent background worker:

1.  **Build Image**:
    ```bash
    docker build -t gcr.io/[PROJECT_ID]/perp-worker .
    ```
2.  **Push to Registry**:
    ```bash
    docker push gcr.io/[PROJECT_ID]/perp-worker
    ```
3.  **Deploy to Cloud Run**:
    *   **Service Name**: `perp-worker`
    *   **CPU Allocation**: Set to **"CPU is always allocated"** (Crucial for the `setInterval` loop to stay active).
    *   **Min Instances**: 1 (Ensures the worker never scales to zero).
    *   **Env Variables**: Add all `.env` secrets (`NEXT_PUBLIC_FIREBASE_API_KEY`, etc.).

---

## 🛠 Backup Cron Setup (Google Cloud Scheduler)

Use this as a fallback if your primary worker is offline.

### 1. Set Security Secret
In your **Vercel/App Hosting Dashboard**, add a new environment variable:
*   `CRON_SECRET`: `cruz_market_sweep_auth_72819304_prod`

### 2. Configure Cloud Scheduler
1.  Go to **Google Cloud Console** > **Cloud Scheduler**.
2.  Create a new job:
    *   **Frequency**: `* * * * *` (Every minute)
    *   **URL**: `https://cruzmarket.fun/api/cron/liquidate`
    *   **Auth Header**: `Bearer Token` > `cruz_market_sweep_auth_72819304_prod`

---

## 🚀 Critical Production Deployment (Vercel)

If your bot stops working after you close FireStudio, it is because your webhook is still pointing to the temporary studio URL. 

### 1. Set Environment Variables
Go to your **Vercel Dashboard** > **Settings** > **Environment Variables** and add:
*   `TELEGRAM_BOT_TOKEN`: Your token from @BotFather.
*   `PAYSTACK_SECRET_KEY`: Your secret key from Paystack.
*   `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY`: Your public key from Paystack.
*   `NOWPAYMENTS_API_KEY`: Your key from NowPayments.
*   `NOWPAYMENTS_IPN_SECRET`: Your IPN Secret from NowPayments Dashboard > Settings.
*   `NEXT_PUBLIC_APP_URL`: Set to `https://cruzmarket.fun`.
*   `CRON_SECRET`: `cruz_market_sweep_auth_72819304_prod`

### 2. Redeploy
You **must** trigger a new deployment on Vercel after adding variables for them to take effect.

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
