import { NextRequest, NextResponse } from "next/server"
import {
  setStorefrontSessionCookie,
  signStorefrontSession,
} from "@/lib/storefront-session"
import { createServiceRoleClient } from "@/lib/supabase/service-role"

function normalizePhone(phone: string) {
  const normalized = phone.replace(/\s+/g, "")
  return normalized.startsWith("+") ? normalized : `+${normalized}`
}

export async function POST(req: NextRequest) {
  try {
    const { phone, code } = await req.json()
    if (
      !phone ||
      typeof phone !== "string" ||
      !code ||
      typeof code !== "string"
    ) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 })
    }

    const normalized = normalizePhone(phone)
    if (normalized === "+") {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 })
    }

    const supabase = createServiceRoleClient()
    const { data: otpRow, error: otpError } = await supabase
      .from("otp_codes")
      .select("id, code, expires_at")
      .eq("phone", normalized)
      .eq("used", false)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (otpError) {
      console.error("OTP lookup error:", otpError.message)
      return NextResponse.json({ error: "Server error" }, { status: 500 })
    }

    if (!otpRow) {
      return NextResponse.json(
        { error: "Код не найден или истёк" },
        { status: 400 },
      )
    }

    if (otpRow.code !== code) {
      return NextResponse.json({ error: "Неверный код" }, { status: 400 })
    }

    const { error: updateError } = await supabase
      .from("otp_codes")
      .update({ used: true })
      .eq("id", otpRow.id)

    if (updateError) {
      console.error("OTP update error:", updateError.message)
      return NextResponse.json({ error: "Server error" }, { status: 500 })
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .upsert({ phone: normalized }, { onConflict: "phone" })
      .select("id, phone, name")
      .single()

    if (profileError || !profile) {
      console.error("Profile upsert error:", profileError?.message)
      return NextResponse.json({ error: "Profile error" }, { status: 500 })
    }

    const token = await signStorefrontSession({
      profileId: profile.id,
      phone: profile.phone,
    })
    await setStorefrontSessionCookie(token)

    return NextResponse.json({ success: true, profile })
  } catch (err) {
    console.error("verify-otp error:", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
