
# CruzMarket

**Welcome to CruzMarket: The Premier Battleground for Meme Tickers.**

CruzMarket isn't just another trading platform—it's a high-octane arena where internet culture becomes currency and hype is the ultimate asset. Dive into a volatile, fast-paced ecosystem of community-created tokens, each with its own narrative and explosive potential.

---

## 🔥 Professional Perpetual Worker (Optional)

For high-leverage perpetual trading (400x), standard 1-minute cron jobs might be slow. If you want 10-second updates, you can run the dedicated worker script on a server:

### 1. Local/VPS Run
```bash
npm run worker:liquidate
```

### 2. Google Cloud Run
Deploy using the provided `Dockerfile`. Set CPU to **"Always Allocated"** to keep the 10-second loop active.

---

## 🛠 Standard Cron Setup (Google Cloud Scheduler)

Use this for reliable, hands-off platform maintenance.

### 1. Configure Cloud Scheduler
1.  Go to **Google Cloud Console** > **Cloud Scheduler**.
2.  Create a new job:
    *   **Frequency**: `* * * * *` (Every minute)
    *   **URL**: `https://cruzmarket.fun/api/system/sweep-auth-72819304-prod`
    *   **HTTP Method**: `GET`
    *   **Auth Header**: None (Endpoint is secured via obscure naming)

---

## 🚀 Critical Production Deployment (Vercel)

If your bot stops working after you close FireStudio, ensure your variables are set in Vercel:

### 1. Set Environment Variables
*   `TELEGRAM_BOT_TOKEN`: Your token from @BotFather.
*   `PAYSTACK_SECRET_KEY`: Your secret key from Paystack.
*   `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY`: Your public key from Paystack.
*   `NOWPAYMENTS_API_KEY`: Your key from NowPayments.
*   `NEXT_PUBLIC_APP_URL`: Set to `https://cruzmarket.fun`.

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
