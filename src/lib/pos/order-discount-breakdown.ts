import { getActiveDiscountRules, resolvePromoCode } from "@/lib/actions/discounts"
import { calcCompareAt } from "@/lib/discount"
import { evaluateDiscounts, isRuleScheduleActive } from "@/lib/discount-engine"
import type { CartItemForEngine, DiscountRule } from "@/types/promotions"
import type { SupabaseClient } from "@supabase/supabase-js"

export type OrderItemForDiscount = {
  menu_item_id: string
  variant_id: string | null
  quantity: number
}

export type PosDiscountRulesAppliedEntry = {
  type: "item_discount" | "promo_code"
  label: string
  amount_bani: number
}

export type PosOrderDiscountBreakdown = {
  subtotalBani: number
  itemDiscountBani: number
  promoDiscountBani: number
  discountBani: number
  discountRulesApplied: PosDiscountRulesAppliedEntry[]
  promoCodeSaved: string | null
}

type MenuItemRow = {
  id: string
  price: number | null
  discount_percent: number | null
  category_id: string | null
}

type VariantRow = {
  id: string
  menu_item_id: string
  price: number
}

type PaidOrderItemRow = {
  menu_item_id: string
  variant_id: string | null
  quantity: number
  price: number
  is_gift?: boolean | null
}

function unitOriginalPriceBani(
  unitPriceBani: number,
  discountPercent: number,
): number {
  if (discountPercent <= 0) return unitPriceBani
  return calcCompareAt(unitPriceBani, discountPercent)
}

async function fetchExcludedDiscountCategoryIds(
  supabase: SupabaseClient,
  brandId: string,
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("menu_categories")
    .select("id")
    .eq("brand_id", brandId)
    .eq("exclude_from_discounts", true)

  if (error) {
    throw new Error(error.message)
  }

  return new Set((data ?? []).map((row) => row.id as string))
}

export function mapPaidOrderItemsForDiscount(
  rows: PaidOrderItemRow[],
): OrderItemForDiscount[] {
  return rows
    .filter((row) => !row.is_gift)
    .map((row) => ({
      menu_item_id: row.menu_item_id,
      variant_id: row.variant_id ?? null,
      quantity: Math.max(1, Math.round(row.quantity)),
    }))
}

export function paidOrderItemsPriceSumBani(rows: PaidOrderItemRow[]): number {
  return rows
    .filter((row) => !row.is_gift)
    .reduce((sum, row) => sum + Math.round(row.price ?? 0), 0)
}

export function calcPosOrderTotalBani(input: {
  itemsPriceSumBani: number
  discountBani: number
  deliveryFeeBani: number
  bonusesRedeemedPoints: number
}): number {
  const bonusBani = Math.max(0, Math.floor(input.bonusesRedeemedPoints)) * 100
  const safeDiscount = Math.min(
    Math.max(0, Math.round(input.discountBani)),
    Math.max(0, Math.round(input.itemsPriceSumBani)),
  )
  return Math.max(
    0,
    input.itemsPriceSumBani - safeDiscount + input.deliveryFeeBani - bonusBani,
  )
}

export async function computePosOrderDiscountBreakdown(
  supabase: SupabaseClient,
  params: {
    brandId: string
    orderItems: OrderItemForDiscount[]
    promoCodeRaw: string | null | undefined
    isAggregator: boolean
  },
): Promise<PosOrderDiscountBreakdown> {
  const empty: PosOrderDiscountBreakdown = {
    subtotalBani: 0,
    itemDiscountBani: 0,
    promoDiscountBani: 0,
    discountBani: 0,
    discountRulesApplied: [],
    promoCodeSaved: null,
  }

  if (!params.orderItems.length) return empty

  const menuItemIds = [
    ...new Set(params.orderItems.map((row) => row.menu_item_id)),
  ]
  const variantIds = [
    ...new Set(
      params.orderItems
        .map((row) => row.variant_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ]

  const [
    { data: menuRows, error: menuError },
    variantResult,
    excludedCategoryIds,
  ] = await Promise.all([
    supabase
      .from("menu_items")
      .select("id, price, discount_percent, category_id")
      .in("id", menuItemIds),
    variantIds.length
      ? supabase
          .from("menu_item_variants")
          .select("id, menu_item_id, price")
          .in("id", variantIds)
      : Promise.resolve({ data: [] as VariantRow[], error: null }),
    fetchExcludedDiscountCategoryIds(supabase, params.brandId),
  ])

  if (menuError) throw new Error(menuError.message)
  if (variantResult.error) throw new Error(variantResult.error.message)

  const menuById = new Map<string, MenuItemRow>(
    (menuRows ?? []).map((row) => [row.id, row as MenuItemRow]),
  )
  const variantById = new Map<string, VariantRow>(
    (variantResult.data ?? []).map((row) => [row.id, row as VariantRow]),
  )

  let subtotalBani = 0
  let menuDerivedItemDiscountBani = 0
  const engineItems: CartItemForEngine[] = []

  for (const row of params.orderItems) {
    const menuItem = menuById.get(row.menu_item_id)
    if (!menuItem) continue

    const variant =
      row.variant_id != null ? variantById.get(row.variant_id) : null
    const unitPriceBani = variant?.price ?? menuItem.price ?? 0
    const itemDiscountPct = menuItem.discount_percent ?? 0
    const unitOriginalBani = unitOriginalPriceBani(unitPriceBani, itemDiscountPct)

    subtotalBani += unitOriginalBani * row.quantity
    menuDerivedItemDiscountBani +=
      (unitOriginalBani - unitPriceBani) * row.quantity

    engineItems.push({
      menu_item_id: row.menu_item_id,
      category_id: menuItem.category_id ?? "",
      variant_id: row.variant_id,
      quantity: row.quantity,
      unit_price_bani: unitPriceBani,
    })
  }

  if (params.isAggregator) {
    // TODO: заменить на channels-поле правила
    return {
      ...empty,
      subtotalBani,
    }
  }

  const now = new Date()
  const autoRulesRaw = await getActiveDiscountRules(params.brandId)
  const activeAutoRules = autoRulesRaw.filter((rule) =>
    isRuleScheduleActive(rule, now),
  )

  let promoCodeRule: DiscountRule | undefined
  let promoCodeSaved: string | null = null
  const normalizedPromo = params.promoCodeRaw?.trim() ?? ""
  if (normalizedPromo) {
    const promoResult = await resolvePromoCode(params.brandId, normalizedPromo)
    if ("rule" in promoResult) {
      promoCodeRule = promoResult.rule
      promoCodeSaved = normalizedPromo.toUpperCase()
    }
  }

  const engineOutput = evaluateDiscounts(
    {
      items: engineItems,
      rules: activeAutoRules,
      promoCodeRule,
      deliveryZone: null,
      excludedCategoryIds:
        excludedCategoryIds.size > 0
          ? [...excludedCategoryIds]
          : undefined,
    },
    now,
  )

  let engineItemPercentBani = 0
  let promoDiscountBani = 0

  for (const entry of engineOutput.appliedDiscounts) {
    if (entry.effect_type === "item_percent") {
      engineItemPercentBani += entry.discount_bani
    } else {
      promoDiscountBani += entry.discount_bani
    }
  }

  const itemDiscountBani = menuDerivedItemDiscountBani + engineItemPercentBani
  const discountBani = itemDiscountBani + promoDiscountBani

  const discountRulesApplied: PosDiscountRulesAppliedEntry[] = []

  if (menuDerivedItemDiscountBani > 0) {
    discountRulesApplied.push({
      type: "item_discount",
      label: "Скидка на товары",
      amount_bani: menuDerivedItemDiscountBani,
    })
  }

  const promoCodeRuleId = promoCodeRule?.id
  for (const entry of engineOutput.appliedDiscounts) {
    if (entry.discount_bani <= 0) continue

    if (entry.effect_type === "item_percent") {
      discountRulesApplied.push({
        type: "item_discount",
        label: entry.label_ru?.trim() || "Скидка на товары",
        amount_bani: entry.discount_bani,
      })
      continue
    }

    const isPromoCodeRule =
      promoCodeRuleId != null && entry.rule_id === promoCodeRuleId

    discountRulesApplied.push({
      type: "promo_code",
      label: isPromoCodeRule
        ? normalizedPromo.toUpperCase()
        : entry.label_ru?.trim() || "Акция",
      amount_bani: entry.discount_bani,
    })
  }

  return {
    subtotalBani,
    itemDiscountBani,
    promoDiscountBani,
    discountBani,
    discountRulesApplied,
    promoCodeSaved,
  }
}

/** POS: подарки 3+1 — только скидка в orders, не отдельные строки order_items. */
export async function purgePosOrderGiftItems(
  supabase: SupabaseClient,
  orderId: string,
): Promise<{ success: true } | { success: false; error: string }> {
  const { error } = await (supabase.from("order_items") as any)
    .delete()
    .eq("order_id", orderId)
    .eq("is_gift", true)

  if (error) {
    console.error("[purgePosOrderGiftItems]", error.message)
    return { success: false, error: "Не удалось удалить устаревшие подарочные строки" }
  }

  return { success: true }
}

export async function recomputePosOrderDiscountAndTotals(
  supabase: SupabaseClient,
  orderId: string,
  options?: { promoCodeOverride?: string | null },
): Promise<
  | { success: true; totalBani: number }
  | { success: false; error: string }
> {
  const { data: orderRow, error: orderError } = await supabase
    .from("orders")
    .select(
      "id, brand_id, delivery_mode, delivery_fee, promo_code, bonuses_redeemed",
    )
    .eq("id", orderId)
    .maybeSingle()

  if (orderError || !orderRow) {
    console.error("[recomputePosOrderDiscountAndTotals] order", orderError?.message)
    return { success: false, error: "Заказ не найден" }
  }

  const order = orderRow as {
    brand_id: string | null
    delivery_mode: "delivery" | "pickup" | "aggregator"
    delivery_fee: number | null
    promo_code: string | null
    bonuses_redeemed: number | null
  }

  const { data: itemRows, error: itemsError } = await supabase
    .from("order_items")
    .select("menu_item_id, variant_id, quantity, price, is_gift")
    .eq("order_id", orderId)

  if (itemsError) {
    console.error("[recomputePosOrderDiscountAndTotals] items", itemsError.message)
    return { success: false, error: "Не удалось пересчитать заказ" }
  }

  const paidRows = (itemRows ?? []) as PaidOrderItemRow[]
  const itemsPriceSumBani = paidOrderItemsPriceSumBani(paidRows)
  const isAggregator = order.delivery_mode === "aggregator"
  const promoCodeRaw =
    options?.promoCodeOverride !== undefined
      ? options.promoCodeOverride
      : order.promo_code

  let discountBreakdown: PosOrderDiscountBreakdown = {
    subtotalBani: 0,
    itemDiscountBani: 0,
    promoDiscountBani: 0,
    discountBani: 0,
    discountRulesApplied: [],
    promoCodeSaved: null,
  }

  if (order.brand_id) {
    try {
      discountBreakdown = await computePosOrderDiscountBreakdown(supabase, {
        brandId: order.brand_id,
        orderItems: mapPaidOrderItemsForDiscount(paidRows),
        promoCodeRaw: isAggregator ? null : promoCodeRaw,
        isAggregator,
      })
    } catch (e) {
      console.error(
        "[recomputePosOrderDiscountAndTotals] discount",
        e instanceof Error ? e.message : e,
      )
      return { success: false, error: "Не удалось пересчитать скидки" }
    }
  }

  const purgeGifts = await purgePosOrderGiftItems(supabase, orderId)
  if (!purgeGifts.success) {
    return purgeGifts
  }

  const bonusesRedeemedPoints =
    typeof order.bonuses_redeemed === "number" &&
    Number.isFinite(order.bonuses_redeemed)
      ? Math.max(0, Math.floor(order.bonuses_redeemed))
      : Math.max(0, Math.floor(Number(order.bonuses_redeemed) || 0))

  const safeDiscount = Math.min(
    Math.max(0, Math.round(discountBreakdown.discountBani)),
    itemsPriceSumBani,
  )

  const totalBani = calcPosOrderTotalBani({
    itemsPriceSumBani,
    discountBani: safeDiscount,
    deliveryFeeBani: Math.max(0, Math.round(order.delivery_fee ?? 0)),
    bonusesRedeemedPoints,
  })

  const { error: updateError } = await supabase
    .from("orders")
    .update({
      subtotal: discountBreakdown.subtotalBani,
      item_discount: discountBreakdown.itemDiscountBani,
      promo_discount: discountBreakdown.promoDiscountBani,
      discount: safeDiscount,
      discount_rules_applied: discountBreakdown.discountRulesApplied,
      promo_code: isAggregator ? null : discountBreakdown.promoCodeSaved,
      total: totalBani,
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId)

  if (updateError) {
    console.error("[recomputePosOrderDiscountAndTotals] update", updateError.message)
    return { success: false, error: "Не удалось обновить сумму заказа" }
  }

  return { success: true, totalBani }
}
