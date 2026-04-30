import { randomInt } from "crypto"
import { NextRequest, NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"

function normalizePhone(phone: string) {
  const normalized = phone.replace(/\s+/g, "")
  return normalized.startsWith("+") ? normalized : `+${normalized}`
}

export async function POST(req: NextRequest) {
  try {
    const { phone } = await req.json()
    if (!phone || typeof phone !== "string") {
      return NextResponse.json({ error: "Invalid phone" }, { status: 400 })
    }

    const normalized = normalizePhone(phone)
    if (normalized === "+") {
      return NextResponse.json({ error: "Invalid phone" }, { status: 400 })
    }

    const supabase = createServiceRoleClient()
    const { data: recent, error: recentError } = await supabase
      .from("otp_codes")
      .select("created_at")
      .eq("phone", normalized)
      .eq("used", false)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (recentError) {
      console.error("OTP rate limit error:", recentError.message)
      return NextResponse.json({ error: "Server error" }, { status: 500 })
    }

    if (recent) {
      const elapsed = Date.now() - new Date(recent.created_at).getTime()
      if (elapsed < 60_000) {
        return NextResponse.json(
          { error: "Подождите 60 секунд перед повторной отправкой" },
          { status: 429 },
        )
      }
    }

    const code = randomInt(100000, 1000000).toString()
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()

    const { error: insertError } = await supabase.from("otp_codes").insert({
      phone: normalized,
      code,
      expires_at: expiresAt,
    })

    if (insertError) {
      console.error("OTP insert error:", insertError.message)
      return NextResponse.json({ error: "Server error" }, { status: 500 })
    }

    const smsUrl = new URL("https://api.sms.md/v1/send")
    smsUrl.searchParams.set("from", process.env.SMS_MD_SENDER!)
    smsUrl.searchParams.set("to", normalized)
    smsUrl.searchParams.set(
      "message",
      `Ваш код: ${code}. Действителен 10 минут.`,
    )
    smsUrl.searchParams.set("token", process.env.SMS_MD_API_KEY!)

    const smsRes = await fetch(smsUrl.toString(), {
      method: "GET",
      headers: { accept: "application/json" },
    })

    if (!smsRes.ok) {
      console.error("SMS.md error:", await smsRes.text())
      return NextResponse.json({ error: "Ошибка отправки SMS" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("send-otp error:", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
