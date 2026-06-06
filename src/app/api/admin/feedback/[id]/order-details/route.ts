import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: fb } = await supabase
    .from("order_feedback")
    .select("order_id, brand_id")
    .eq("id", id)
    .single()

  if (!fb?.order_id) return NextResponse.json(null)

  const { data: order } = await supabase
    .from("orders")
    .select(
      "order_number, created_at, done_at, total, subtotal, discount, delivery_fee, promo_code, payment_method, delivery_mode, bonuses_redeemed, delivery_address",
    )
    .eq("id", fb.order_id)
    .single()

  const { data: items } = await supabase
    .from("order_items")
    .select("quantity, price, item_name, size, is_gift, toppings")
    .eq("order_id", fb.order_id)

  if (!order) return NextResponse.json(null)

  return NextResponse.json({
    order_number: order.order_number,
    created_at: order.created_at,
    done_at: order.done_at ?? null,
    total_bani: order.total,
    subtotal_bani: order.subtotal,
    discount_bani: order.discount ?? 0,
    delivery_fee_bani: order.delivery_fee ?? 0,
    promo_code: order.promo_code ?? null,
    payment_method: order.payment_method,
    delivery_mode: order.delivery_mode,
    bonuses_redeemed: order.bonuses_redeemed ?? 0,
    delivery_address: order.delivery_address ?? null,
    items: (items ?? []).map((i) => ({
      name: i.item_name ?? "—",
      quantity: i.quantity,
      price_bani: i.price,
      size: i.size ?? null,
      is_gift: i.is_gift === true,
      toppings: i.toppings ?? null,
    })),
  })
}
