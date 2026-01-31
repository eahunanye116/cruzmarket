
# CruzMarket

**Welcome to CruzMarket: The Premier Battleground for Meme Tickers.**

CruzMarket isn't just another trading platform—it's a high-octane arena where internet culture becomes currency and hype is the ultimate asset. Dive into a volatile, fast-paced ecosystem of community-created tokens, each with its own narrative and explosive potential.

**Key Features:**

*   **Launch Your Legend:** Instantly create and launch your own meme ticker on a live, open market.
*   **Trade the Hype:** Forget order books. All tickers are powered by a dynamic bonding curve where price is a direct reflection of market demand.
*   **Become the King of the Hill:** In "Cruz Mode," only the most explosive tokens—those with meteoric 5x gains—can claim the throne. A king's reign is fleeting; they must defend their crown every minute against new challengers.
*   **Live Arena:** Witness every buy, sell, and creation in the live activity feed.

---

## 🚀 Production Deployment (Vercel)

To ensure your Telegram bot works 24/7 even after you close FireStudio, follow these steps:

1.  **Environment Variables:** Add these to your Vercel Project Settings:
    *   `TELEGRAM_BOT_TOKEN`: Your bot token from @BotFather.
    *   `PAYSTACK_SECRET_KEY`: Your secret key from Paystack Dashboard.
    *   `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY`: Your public key from Paystack Dashboard.
    *   `X_APP_KEY`, `X_APP_SECRET`, etc.: (Optional) For X/Twitter integration.
2.  **Deploy:** Push your code to Vercel.
3.  **Activate Bot:** 
    *   Go to your live site (e.g., `https://your-domain.com/admin`).
    *   Go to the **Telegram** tab.
    *   Ensure the URL is your live domain and click **"Set Webhook"**.
    *   *Note: If you set the webhook inside FireStudio, it will stop working when FireStudio closes.*

---

## 🤖 Telegram Setup Instructions

To ensure the automated ticker alerts and trading work correctly:

**1. Channel Alerts:**
*   Open Telegram and go to your channel: `@Cruzmarketfun_Tickers`.
*   Go to **Administrators** > **Add Administrator**.
*   Search for your bot: `@cruzmarketfunbot` and select it.
*   Ensure the permission **"Post Messages"** is enabled.
*   Click **Done** to save.

**2. User Linking:**
*   Users must go to **Settings** in the web app to link their account before trading in the bot.

---

## 🔗 Webhooks Reference

If you are configuring external services, use these exact endpoints:
*   **Paystack Webhook:** `https://cruzmarket.fun/api/webhooks/paystack`
*   **Telegram Webhook:** `https://cruzmarket.fun/api/telegram/webhook`

CruzMarket is the wild west of meme finance. It's chaotic, it's unpredictable, and it's where the next legendary meme coin could be born.
