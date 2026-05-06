import * as dotenv from "dotenv"

dotenv.config({ path: ".env.local" })

const token = process.env.TELEGRAM_BOT_TOKEN!
const secret = process.env.TELEGRAM_WEBHOOK_SECRET!
const appUrl = process.env.NEXT_PUBLIC_APP_URL! // e.g. https://yourdomain.com

async function setup() {
  const url = `https://api.telegram.org/bot${token}/setWebhook`
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: `${appUrl}/api/telegram`,
      secret_token: secret,
      allowed_updates: ["message", "edited_message"],
    }),
  })
  const data = await res.json()
  console.log("Webhook setup result:", data)
}

setup()
