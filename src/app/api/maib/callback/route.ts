import { NextResponse } from "next/server"
import { sendNewOrderTelegramNotification } from "@/lib/actions/create-order"
import { validateMaibSignature } from "@/lib/maib/signature"
import { createServiceSupabaseClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

function ok200() {
  return NextResponse.json({ ok: true }, { status: 200 })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

export async function POST(request: Request) {
  try {
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return ok200()
    }

    if (!isRecord(body)) {
      console.warn("[maib/callback] invalid body shape")
      return ok200()
    }

    const result = body.result
    const signature = body.signature
    if (!isRecord(result) || typeof signature !== "string") {
      console.warn("[maib/callback] missing result or signature")
      return ok200()
    }

    const signatureKey = process.env.MAIB_SIGNATURE_KEY
    if (!signatureKey) {
      console.warn("[maib/callback] MAIB_SIGNATURE_KEY is not set")
      return ok200()
    }

    if (!validateMaibSignature(result, signature, signatureKey)) {
      console.warn("MAIB invalid signature")
      return ok200()
    }

    const orderId = String(result.orderId ?? "")
    const status = String(result.status ?? "")
    const payId = String(result.payId ?? "")

    if (!orderId) {
      console.warn("[maib/callback] missing orderId")
      return ok200()
    }

    const supabase = createServiceSupabaseClient()
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id, status, payment_method, paid_at")
      .eq("id", orderId)
      .maybeSingle()

    if (orderError || !order) {
      console.warn("[maib/callback] order not found", orderId, orderError?.message)
      return ok200()
    }

    if (order.payment_method !== "online_card") {
      console.warn(
        "[maib/callback] payment_method is not online_card",
        orderId,
      )
      return ok200()
    }

    const now = new Date().toISOString()

    if (status === "OK") {
      if (order.paid_at != null) {
        return ok200()
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- maib_pay_id may be absent from generated types
      const { error: updateError } = await (supabase.from("orders") as any)
        .update({
          paid_at: now,
          maib_pay_id: payId || null,
          updated_at: now,
        })
        .eq("id", orderId)

      if (updateError) {
        console.error("[maib/callback] paid update", updateError.message)
        return ok200()
      }

      try {
        await sendNewOrderTelegramNotification(orderId)
      } catch (e) {
        console.error(
          "[maib/callback] telegram",
          e instanceof Error ? e.message : e,
        )
      }
    } else if (order.status === "new") {
      const { error: cancelError } = await supabase
        .from("orders")
        .update({ status: "cancelled", updated_at: now })
        .eq("id", orderId)

      if (cancelError) {
        console.error("[maib/callback] cancel update", cancelError.message)
      }
    }

    return ok200()
  } catch (e) {
    console.error(
      "[maib/callback]",
      e instanceof Error ? e.message : e,
    )
    return ok200()
  }
}
