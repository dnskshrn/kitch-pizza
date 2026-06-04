import { BRANDS } from "@/brands"

interface SendSmsOptions {
  to: string
  text: string
  brandSlug?: string
}

export async function sendSms({
  to,
  text,
  brandSlug,
}: SendSmsOptions): Promise<void> {
  const brand = BRANDS.find((b) => b.slug === brandSlug)
  const sender = brand?.smsSender ?? process.env.SMS_MD_SENDER ?? "FoodService"

  const url = new URL("https://api.sms.md/v1/send")
  url.searchParams.set("from", sender)
  url.searchParams.set("to", to)
  url.searchParams.set("message", text)
  url.searchParams.set("token", process.env.SMS_MD_API_KEY!)

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: { accept: "application/json" },
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`SMS.md error: ${res.status} ${body}`)
  }
}
