
# CruzMarket

**Welcome to CruzMarket: The Premier Battleground for Meme Tickers.**

CruzMarket isn't just another trading platform—it's a high-octane arena where internet culture becomes currency and hype is the ultimate asset. Dive into a volatile, fast-paced ecosystem of community-created tokens, each with its own narrative and explosive potential.

---

## 🛠 Standard System Maintenance

Reliable, hands-off platform maintenance via scheduled jobs.

### 1. Configure System Sweeper (Optional)
If specific periodic tasks are needed, use a scheduler to trigger designated endpoints.

---

## 🚀 C add .ritical Production Deployment (Vercel)

Ensure your environment variables are correctly set in Vercel for full functionality:

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
