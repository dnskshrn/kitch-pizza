import { randomUUID } from "crypto"
import { NextRequest, NextResponse } from "next/server"
import {
  generateFeedbackShortCode,
  getFeedbackSmsText,
} from "@/lib/feedback"
import { sendSms } from "@/lib/sms"
import { createServiceRoleClient } from "@/lib/supabase/service-role"

export const dynamic = "force-dynamic"

type PendingFeedbackOrderRow = {
  id: string
  brand_id: string
  profile_id: string
  done_at: string
  phone: string | null
  brand_slug: string | null
}

async function hasRecentSmsCooldown(
  supabase: ReturnType<typeof createServiceRoleClient>,
  brandId: string,
  profileId: string,
): Promise<boolean> {
  const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString()

  const { data: profileOrders, error: ordersError } = await supabase
    .from("orders")
    .select("id")
    .eq("profile_id", profileId)

  if (ordersError) {
    console.error("feedback-sms cooldown orders error:", ordersError.message)
    return true
  }

  const orderIds = (profileOrders ?? []).map((r) => r.id)
  if (orderIds.length === 0) return false

  const { data: recent, error: feedbackError } = await (
    supabase.from("order_feedback") as ReturnType<typeof supabase.from>
  )
    .select("id")
    .eq("brand_id", brandId)
    .in("order_id", orderIds)
    .gt("sms_sent_at", threeHoursAgo)
    .limit(1)
    .maybeSingle()

  if (feedbackError) {
    console.error("feedback-sms cooldown feedback error:", feedbackError.message)
    return true
  }

  return recent != null
}

export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV !== "development") {
    const secret = process.env.CRON_SECRET
    if (secret) {
      const auth = req.headers.get("authorization")
      if (auth !== `Bearer ${secret}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }
    }
  }

  const supabase = createServiceRoleClient()
  const errors: string[] = []
  let processed = 0
  let skipped = 0

  const { data: rawOrders, error: ordersError } = await supabase.rpc(
    "get_pending_feedback_orders",
    { p_limit: 50 },
  )

  if (ordersError) {
    console.error("feedback-sms orders query error:", ordersError.message)
    return NextResponse.json({ error: ordersError.message }, { status: 500 })
  }

  for (const row of (rawOrders ?? []) as PendingFeedbackOrderRow[]) {
    const phone = row.phone?.trim() ?? ""
    const profileId = row.profile_id
    const brandSlug = row.brand_slug?.trim() ?? ""

    if (!phone || !brandSlug || !row.brand_id) {
      skipped += 1
      continue
    }

    if (await hasRecentSmsCooldown(supabase, row.brand_id, profileId)) {
      skipped += 1
      continue
    }

    const token = randomUUID()
    const shortCode = generateFeedbackShortCode()
    const tokenExpiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString()
    const smsSentAt = new Date().toISOString()

    const { data: inserted, error: insertError } = await (
      supabase.from("order_feedback") as ReturnType<typeof supabase.from>
    )
      .upsert(
        {
          order_id: row.id,
          brand_id: row.brand_id,
          token,
          short_code: shortCode,
          token_expires_at: tokenExpiresAt,
          sms_sent_at: smsSentAt,
        },
        { onConflict: "order_id", ignoreDuplicates: true },
      )
      .select("id")
      .maybeSingle()

    if (insertError) {
      console.error("feedback-sms insert error:", insertError.message)
      errors.push(`${row.id}: ${insertError.message}`)
      continue
    }

    if (!inserted) {
      skipped += 1
      continue
    }

    const smsText = getFeedbackSmsText(shortCode, brandSlug)
    try {
      await sendSms({ to: phone, text: smsText, brandSlug })
    } catch (err) {
      console.error("feedback-sms SMS error:", err)
      const { error: deleteError } = await (
        supabase.from("order_feedback") as ReturnType<typeof supabase.from>
      )
        .delete()
        .eq("id", (inserted as { id: string }).id)

      if (deleteError) {
        console.error("feedback-sms rollback error:", deleteError.message)
      }

      errors.push(`${row.id}: SMS send failed`)
      continue
    }

    processed += 1
  }

  return NextResponse.json({ processed, skipped, errors })
}
