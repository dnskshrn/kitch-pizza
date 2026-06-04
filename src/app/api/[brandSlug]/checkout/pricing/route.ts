import { resolveBrandIdBySlug } from "@/lib/resolve-brand-id"
import {
  calculateOrderPricing,
  type CartItem,
  type PricingResult,
} from "@/lib/pricing"
import { getStorefrontSession } from "@/lib/storefront-session"
import { createServiceSupabaseClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

type PricingRequestBody = {
  items: CartItem[]
  delivery_fee: number
  promo_code?: string
  bonuses_to_redeem?: number
  delivery_mode: "delivery" | "pickup"
}

function parsePricingBody(body: unknown): PricingRequestBody | { error: string } {
  if (!body || typeof body !== "object") {
    return { error: "Invalid JSON body" }
  }

  const raw = body as Record<string, unknown>

  if (!Array.isArray(raw.items) || raw.items.length === 0) {
    return { error: "items must be a non-empty array" }
  }

  const items: CartItem[] = []
  for (const row of raw.items) {
    if (!row || typeof row !== "object") {
      return { error: "Invalid cart item" }
    }
    const item = row as Record<string, unknown>
    if (typeof item.menu_item_id !== "string" || !item.menu_item_id.trim()) {
      return { error: "menu_item_id is required" }
    }
    if (
      typeof item.quantity !== "number" ||
      !Number.isFinite(item.quantity) ||
      item.quantity < 1 ||
      !Number.isInteger(item.quantity)
    ) {
      return { error: "quantity must be a positive integer" }
    }
    if (
      item.variant_id != null &&
      (typeof item.variant_id !== "string" || !item.variant_id.trim())
    ) {
      return { error: "variant_id must be a string" }
    }

    items.push({
      menu_item_id: item.menu_item_id.trim(),
      quantity: item.quantity,
      ...(typeof item.variant_id === "string" && item.variant_id.trim()
        ? { variant_id: item.variant_id.trim() }
        : {}),
    })
  }

  if (
    typeof raw.delivery_fee !== "number" ||
    !Number.isFinite(raw.delivery_fee) ||
    raw.delivery_fee < 0
  ) {
    return { error: "delivery_fee must be a non-negative number" }
  }

  if (raw.delivery_mode !== "delivery" && raw.delivery_mode !== "pickup") {
    return { error: "delivery_mode must be delivery or pickup" }
  }

  let promo_code: string | undefined
  if (raw.promo_code != null) {
    if (typeof raw.promo_code !== "string") {
      return { error: "promo_code must be a string" }
    }
    promo_code = raw.promo_code
  }

  let bonuses_to_redeem: number | undefined
  if (raw.bonuses_to_redeem != null) {
    if (
      typeof raw.bonuses_to_redeem !== "number" ||
      !Number.isFinite(raw.bonuses_to_redeem) ||
      raw.bonuses_to_redeem < 0
    ) {
      return { error: "bonuses_to_redeem must be a non-negative number" }
    }
    bonuses_to_redeem = raw.bonuses_to_redeem
  }

  return {
    items,
    delivery_fee: Math.round(raw.delivery_fee),
    delivery_mode: raw.delivery_mode,
    ...(promo_code !== undefined ? { promo_code } : {}),
    ...(bonuses_to_redeem !== undefined ? { bonuses_to_redeem } : {}),
  }
}

export async function POST(
  request: Request,
  context: { params: { brandSlug: string } },
): Promise<NextResponse<PricingResult | { error: string }>> {
  const brandId = await resolveBrandIdBySlug(context.params.brandSlug)
  if (!brandId) {
    return NextResponse.json({ error: "Brand not found" }, { status: 404 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = parsePricingBody(body)
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }

  const session = await getStorefrontSession()
  const profileId = session?.profileId ?? null
  const bonusesRequested =
    profileId != null ? (parsed.bonuses_to_redeem ?? 0) : 0

  const deliveryFeeBani =
    parsed.delivery_mode === "pickup" ? 0 : parsed.delivery_fee

  try {
    const supabase = createServiceSupabaseClient()
    const pricing = await calculateOrderPricing(supabase, {
      cartItems: parsed.items,
      brandId,
      promoCode: parsed.promo_code ?? null,
      profileId,
      bonusesRequested,
      deliveryFeeBani,
    })

    if (!profileId) {
      return NextResponse.json({
        ...pricing,
        bonuses_available: 0,
        bonuses_redeemed: 0,
        max_bonuses_redeemable: 0,
      })
    }

    return NextResponse.json(pricing)
  } catch (e) {
    const message = e instanceof Error ? e.message : "Pricing failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
