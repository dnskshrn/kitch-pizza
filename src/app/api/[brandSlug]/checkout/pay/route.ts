import { NextResponse } from "next/server"
import { createMaibPayment } from "@/lib/maib/client"
import { resolveBrandIdBySlug } from "@/lib/resolve-brand-id"
import { createServiceSupabaseClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

type PayRequestBody = {
  orderId: string
}

type OrderPayRow = {
  id: string
  order_number: number
  total: number
  delivery_fee: number
  brand_id: string | null
  payment_method: string
  status: string
  paid_at: string | null
  maib_pay_id: string | null
  user_name: string | null
  user_phone: string | null
}

export async function POST(
  request: Request,
  context: { params: { brandSlug: string } },
) {
  if (process.env.CARD_PAYMENT_ENABLED !== "true") {
    return NextResponse.json({ error: "Not available" }, { status: 503 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const orderId =
    body &&
    typeof body === "object" &&
    typeof (body as PayRequestBody).orderId === "string"
      ? (body as PayRequestBody).orderId.trim()
      : ""

  if (!orderId) {
    return NextResponse.json({ error: "orderId is required" }, { status: 400 })
  }

  const brandId = await resolveBrandIdBySlug(context.params.brandSlug)
  if (!brandId) {
    return NextResponse.json({ error: "Brand not found" }, { status: 404 })
  }

  const supabase = createServiceSupabaseClient()
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select(
      "id, order_number, total, delivery_fee, brand_id, payment_method, status, paid_at, maib_pay_id, user_name, user_phone",
    )
    .eq("id", orderId)
    .maybeSingle()

  if (orderError) {
    console.error("[checkout/pay] order fetch", orderError.message)
    return NextResponse.json({ error: "Order lookup failed" }, { status: 500 })
  }

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 })
  }

  const row = order as OrderPayRow

  if (row.brand_id !== brandId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  if (row.payment_method !== "online_card") {
    return NextResponse.json(
      { error: "wrong_payment_method" },
      { status: 400 },
    )
  }

  if (row.paid_at != null) {
    return NextResponse.json({ error: "already_paid" }, { status: 409 })
  }

  if (row.status === "cancelled") {
    return NextResponse.json({ error: "order_cancelled" }, { status: 409 })
  }

  const forwarded = request.headers.get("x-forwarded-for")
  const clientIp = forwarded
    ? forwarded.split(",")[0].trim()
    : "127.0.0.1"

  const host = request.headers.get("host") ?? "localhost:3000"
  const proto = host.includes("localhost") ? "http" : "https"
  const baseUrl = `${proto}://${host}`

  const callbackUrl = process.env.MAIB_CALLBACK_URL
  if (!callbackUrl) {
    console.error("[checkout/pay] MAIB_CALLBACK_URL is not set")
    return NextResponse.json(
      { error: "payment_gateway_error", message: "Callback URL not configured" },
      { status: 502 },
    )
  }

  const okUrl = `${baseUrl}/payment/success`
  const failUrl = `${baseUrl}/payment/fail`

  let payResult
  try {
    payResult = await createMaibPayment({
      amount: row.total / 100,
      currency: "MDL",
      clientIp,
      language: "ro",
      orderId: row.id,
      clientName: row.user_name ?? undefined,
      phone: row.user_phone ?? undefined,
      delivery:
        row.delivery_fee > 0 ? row.delivery_fee / 100 : undefined,
      callbackUrl,
      okUrl,
      failUrl,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : "MAIB payment failed"
    return NextResponse.json(
      { error: "payment_gateway_error", message },
      { status: 502 },
    )
  }

  const now = new Date().toISOString()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- maib_pay_id may be absent from generated types
  const { error: updateError } = await (supabase.from("orders") as any)
    .update({ maib_pay_id: payResult.payId, updated_at: now })
    .eq("id", orderId)

  if (updateError) {
    console.error("[checkout/pay] maib_pay_id update", updateError.message)
    return NextResponse.json(
      { error: "payment_gateway_error", message: updateError.message },
      { status: 502 },
    )
  }

  return NextResponse.json({ payUrl: payResult.payUrl })
}
