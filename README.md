# Chapter Bot

Telegram bot with reading-comprehension exercises for **"The Secret Garden"** (chapters 6&ndash;16). Original Python (`pytelegrambotapi`) implementation rewritten as a **Next.js + TypeScript** app, deployable to **Vercel** as serverless functions over a Telegram webhook.

The user-facing logic and content are identical to the original `main.py`:

- `/start` shows a chapter menu.
- Each chapter is a flat list of questions; tapping any answer advances to the next question.
- A "Stop & Exit to Menu" button is shown under every question.
- After the last question, a congratulations message is shown with a "Back to Chapters" button.

## Project structure

```
app/
  api/
    webhook/route.ts       # Receives Telegram updates (POST)
    set-webhook/route.ts   # GET to register, DELETE to remove the webhook
  layout.tsx
  page.tsx                 # Simple landing page
  globals.css
lib/
  bookData.ts              # All chapter questions (ported from main.py)
  telegram.ts              # Thin Telegram Bot API client (fetch)
  handlers.ts              # /start + callback_query routing & state-less flow
```

## Local development

```bash
npm install
cp .env.example .env.local      # then fill in TELEGRAM_BOT_TOKEN
npm run dev
```

Locally Telegram cannot reach your machine directly. Use a tunnel like `ngrok http 3000`, then set the webhook to your public URL once:

```bash
curl "https://<your-ngrok-domain>/api/set-webhook"
```

## Deploy to Vercel

1. Push this repo to GitHub and import it in Vercel (framework auto-detected as Next.js).
2. In **Project Settings &rarr; Environment Variables**, add:
   - `TELEGRAM_BOT_TOKEN` &ndash; the token from [@BotFather](https://t.me/BotFather).
   - `TELEGRAM_WEBHOOK_SECRET` &ndash; any long random string. Telegram will send it back in the `X-Telegram-Bot-Api-Secret-Token` header and the webhook route will reject mismatches.
3. Deploy.
4. Visit `https://<your-vercel-domain>/api/set-webhook` once. You should get back `{ "ok": true, ... }`.
5. Open the bot in Telegram and send `/start`.

To remove the webhook (e.g. before switching back to polling for local dev):

```bash
curl -X DELETE "https://<your-vercel-domain>/api/set-webhook"
```

## Notes

- The original Python script hardcoded the bot token. The TS version reads it from `TELEGRAM_BOT_TOKEN`. **Rotate the token via @BotFather** since the original was committed in plaintext.
- The bot is fully stateless &mdash; the current chapter and question index are encoded in the inline-button `callback_data` (`q_<chapter>_<questionIndex>_<optionIndex>`), exactly like the Python original. No database is required.
- Telegram's "message is not modified" error is silently ignored, so double-tapping the same answer is harmless.
