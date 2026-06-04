import { calcCompareAt, calcPromoDiscount } from "@/lib/discount"
import type { PromoCode, PromoCodeValidationError } from "@/types/database"
import type { SupabaseClient } from "@supabase/supabase-js"

const MAX_BONUS_REDEMPTION_PCT = 30

export interface CartItem {
  menu_item_id: string
  quantity: number
  variant_id?: string
}

export interface PricingResult {
  items: Array<{
    menu_item_id: string
    quantity: number
    price_bani: number
    original_price_bani: number
    item_discount_pct: number
    item_discount_bani: number
  }>
  subtotal_bani: number
  item_discount_bani: number
  item_discount_pct: number

  promo_code_id: string | null
  promo_discount_bani: number
  promo_discount_pct: number
  promo_error: string | null

  bonuses_available: number
  bonuses_blocked: boolean
  max_bonuses_redeemable: number
  bonuses_redeemed: number

  delivery_fee_bani: number
  total_bani: number

  discount_rules_applied: Array<{
    type: "item_discount" | "promo_code" | "bonus_redemption"
    label: string
    amount_bani: number
  }>
}

export interface CalculateOrderPricingInput {
  cartItems: CartItem[]
  brandId: string
  promoCode?: string | null
  profileId?: string | null
  /** Запрошенное списание бонусов, MDL (1 п. = 1 MDL). */
  bonusesRequested?: number
  deliveryFeeBani?: number
}

type MenuItemRow = {
  id: string
  price: number | null
  discount_percent: number | null
  has_sizes: boolean
}

type VariantRow = {
  id: string
  menu_item_id: string
  price: number
}

async function fetchProfileBonusBalance(
  supabase: SupabaseClient,
  profileId: string,
): Promise<number> {
  const { data, error } = await supabase
    .from("bonus_transactions")
    .select("balance_after")
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !data) return 0
  return Number(data.balance_after) || 0
}

function unitOriginalPriceBani(
  unitPriceBani: number,
  discountPercent: number,
): number {
  if (discountPercent <= 0) return unitPriceBani
  return calcCompareAt(unitPriceBani, discountPercent)
}

function pctOf(part: number, whole: number): number {
  if (whole <= 0) return 0
  return (part / whole) * 100
}

async function validatePromoCodeWithClient(
  supabase: SupabaseClient,
  code: string,
  brandId: string,
  subtotalBani: number,
): Promise<
  | { valid: true; promo: PromoCode }
  | { valid: false; error: PromoCodeValidationError; min_order_bani?: number }
> {
  const normalized = code.trim().toUpperCase()
  if (!normalized) {
    return { valid: false, error: "not_found" }
  }

  const { data, error } = await supabase
    .from("promo_codes")
    .select("*")
    .eq("brand_id", brandId)
    .eq("code", normalized)
    .maybeSingle()

  if (error || !data) {
    return { valid: false, error: "not_found" }
  }

  const row = data as PromoCode

  if (!row.is_active) {
    return { valid: false, error: "inactive" }
  }

  const now = new Date()
  if (row.valid_from && now < new Date(row.valid_from)) {
    return { valid: false, error: "not_started" }
  }
  if (row.valid_until && now > new Date(row.valid_until)) {
    return { valid: false, error: "expired" }
  }
  if (row.max_uses != null && row.uses_count >= row.max_uses) {
    return { valid: false, error: "limit_reached" }
  }
  if (row.min_order_bani != null && subtotalBani < row.min_order_bani) {
    return {
      valid: false,
      error: "min_order_not_met",
      min_order_bani: row.min_order_bani,
    }
  }

  return { valid: true, promo: row }
}

export async function calculateOrderPricing(
  supabase: SupabaseClient,
  input: CalculateOrderPricingInput,
): Promise<PricingResult> {
  const {
    cartItems,
    brandId,
    promoCode = null,
    profileId = null,
    bonusesRequested = 0,
    deliveryFeeBani = 0,
  } = input

  if (!cartItems.length) {
    return {
      items: [],
      subtotal_bani: 0,
      item_discount_bani: 0,
      item_discount_pct: 0,
      promo_code_id: null,
      promo_discount_bani: 0,
      promo_discount_pct: 0,
      promo_error: null,
      bonuses_available: profileId
        ? await fetchProfileBonusBalance(supabase, profileId)
        : 0,
      bonuses_blocked: Boolean(promoCode?.trim()),
      max_bonuses_redeemable: 0,
      bonuses_redeemed: 0,
      delivery_fee_bani: deliveryFeeBani,
      total_bani: deliveryFeeBani,
      discount_rules_applied: [],
    }
  }

  const menuItemIds = [...new Set(cartItems.map((c) => c.menu_item_id))]
  const variantIds = [
    ...new Set(
      cartItems
        .map((c) => c.variant_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ]

  const [{ data: menuRows, error: menuError }, variantResult] = await Promise.all([
    supabase
      .from("menu_items")
      .select("id, price, discount_percent, has_sizes")
      .in("id", menuItemIds),
    variantIds.length
      ? supabase
          .from("menu_item_variants")
          .select("id, menu_item_id, price")
          .in("id", variantIds)
      : Promise.resolve({ data: [] as VariantRow[], error: null }),
  ])

  if (menuError) {
    throw new Error(menuError.message)
  }
  if (variantResult.error) {
    throw new Error(variantResult.error.message)
  }

  const menuById = new Map<string, MenuItemRow>(
    (menuRows ?? []).map((row) => [row.id, row as MenuItemRow]),
  )
  const variantById = new Map<string, VariantRow>(
    (variantResult.data ?? []).map((row) => [row.id, row as VariantRow]),
  )

  const items: PricingResult["items"] = []
  let subtotalBani = 0
  let itemDiscountBani = 0

  for (const cartItem of cartItems) {
    const menuItem = menuById.get(cartItem.menu_item_id)
    if (!menuItem) {
      throw new Error(`menu_item not found: ${cartItem.menu_item_id}`)
    }

    const variant =
      cartItem.variant_id != null
        ? variantById.get(cartItem.variant_id)
        : null

    if (cartItem.variant_id && !variant) {
      throw new Error(`menu_item_variant not found: ${cartItem.variant_id}`)
    }
    if (variant && variant.menu_item_id !== cartItem.menu_item_id) {
      throw new Error(
        `variant ${cartItem.variant_id} does not belong to menu_item ${cartItem.menu_item_id}`,
      )
    }

    const unitPriceBani = variant?.price ?? menuItem.price ?? 0
    const itemDiscountPct = menuItem.discount_percent ?? 0
    const unitOriginalBani = unitOriginalPriceBani(unitPriceBani, itemDiscountPct)
    const lineItemDiscountBani =
      (unitOriginalBani - unitPriceBani) * cartItem.quantity

    subtotalBani += unitOriginalBani * cartItem.quantity
    itemDiscountBani += lineItemDiscountBani

    items.push({
      menu_item_id: cartItem.menu_item_id,
      quantity: cartItem.quantity,
      price_bani: unitPriceBani,
      original_price_bani: unitOriginalBani,
      item_discount_pct: itemDiscountPct,
      item_discount_bani: lineItemDiscountBani,
    })
  }

  const itemDiscountPct = pctOf(itemDiscountBani, subtotalBani)

  let promoCodeId: string | null = null
  let promoDiscountBani = 0
  let promoDiscountPct = 0
  let promoError: string | null = null
  let bonusesBlocked = false
  let bonusesRedeemed = 0
  let maxBonusesRedeemable = 0

  const bonusesAvailable = profileId
    ? await fetchProfileBonusBalance(supabase, profileId)
    : 0

  const normalizedPromo = promoCode?.trim() ?? ""
  if (normalizedPromo) {
    bonusesBlocked = true
    const validation = await validatePromoCodeWithClient(
      supabase,
      normalizedPromo,
      brandId,
      subtotalBani,
    )

    if (validation.valid) {
      promoCodeId = validation.promo.id
      promoDiscountBani = calcPromoDiscount(validation.promo, subtotalBani)
      promoDiscountPct = pctOf(promoDiscountBani, subtotalBani)
    } else {
      promoError = validation.error
    }
  } else {
    const remainingPct = Math.max(0, MAX_BONUS_REDEMPTION_PCT - itemDiscountPct)
    maxBonusesRedeemable = Math.floor(
      (subtotalBani / 100) * (remainingPct / 100),
    )

    if (profileId && bonusesRequested > 0) {
      bonusesRedeemed = Math.min(
        Math.max(0, Math.floor(bonusesRequested)),
        bonusesAvailable,
        maxBonusesRedeemable,
      )
    }
  }

  const totalBani = Math.max(
    0,
    subtotalBani -
      itemDiscountBani -
      promoDiscountBani -
      bonusesRedeemed * 100 +
      deliveryFeeBani,
  )

  const discountRulesApplied: PricingResult["discount_rules_applied"] = []

  if (itemDiscountBani > 0) {
    discountRulesApplied.push({
      type: "item_discount",
      label: "Скидка на товары",
      amount_bani: itemDiscountBani,
    })
  }

  if (promoDiscountBani > 0) {
    discountRulesApplied.push({
      type: "promo_code",
      label: normalizedPromo.toUpperCase(),
      amount_bani: promoDiscountBani,
    })
  }

  if (bonusesRedeemed > 0) {
    discountRulesApplied.push({
      type: "bonus_redemption",
      label: "Списание бонусов",
      amount_bani: bonusesRedeemed * 100,
    })
  }

  return {
    items,
    subtotal_bani: subtotalBani,
    item_discount_bani: itemDiscountBani,
    item_discount_pct: itemDiscountPct,
    promo_code_id: promoCodeId,
    promo_discount_bani: promoDiscountBani,
    promo_discount_pct: promoDiscountPct,
    promo_error: promoError,
    bonuses_available: bonusesAvailable,
    bonuses_blocked: bonusesBlocked,
    max_bonuses_redeemable: maxBonusesRedeemable,
    bonuses_redeemed: bonusesRedeemed,
    delivery_fee_bani: deliveryFeeBani,
    total_bani: totalBani,
    discount_rules_applied: discountRulesApplied,
  }
}
