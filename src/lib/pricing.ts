import { getBonusSettings } from "@/lib/bonus"
import { calcCompareAt, discountRateFromEffectValue } from "@/lib/discount"
import { evaluateDiscounts, isRuleScheduleActive } from "@/lib/discount-engine"
import type { PromoCode, PromoCodeValidationError } from "@/types/database"
import type {
  CartItemForEngine,
  DiscountRule,
  GiftCartItem,
} from "@/types/promotions"
import type { SupabaseClient } from "@supabase/supabase-js"

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
  /** База для cap списания бонусов (grand total минус excluded-категории), bani. */
  bonus_cap_base_bani: number
  max_bonuses_redeemable: number
  bonuses_redeemed: number

  delivery_fee_bani: number
  total_bani: number
  active_promotion: boolean

  discount_rules_applied: Array<{
    type: "item_discount" | "promo_code" | "bonus_redemption"
    label: string
    amount_bani: number
  }>

  /** cartLineId — индекс строки корзины ("0", "1", …), тот же порядок, что cartItems/pricing.items. */
  giftUnits: Array<{ cartLineId: string; quantity: number }>
  giftItems: GiftCartItem[]
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
  category_id: string | null
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

async function fetchMenuCategoryExclusionSets(
  supabase: SupabaseClient,
  brandId: string,
): Promise<{
  excludedCategoryIds: Set<string>
  bonusExcludedCategoryIds: Set<string>
}> {
  const { data, error } = await supabase
    .from("menu_categories")
    .select("id, exclude_from_discounts, exclude_from_bonus_redemption")
    .eq("brand_id", brandId)

  if (error) {
    throw new Error(error.message)
  }

  const excludedCategoryIds = new Set<string>()
  const bonusExcludedCategoryIds = new Set<string>()
  for (const row of data ?? []) {
    const id = row.id as string
    if (row.exclude_from_discounts === true) {
      excludedCategoryIds.add(id)
    }
    if (row.exclude_from_bonus_redemption === true) {
      bonusExcludedCategoryIds.add(id)
    }
  }

  return { excludedCategoryIds, bonusExcludedCategoryIds }
}

function giftQtyByCartLineId(
  giftUnits: PricingResult["giftUnits"],
): Map<string, number> {
  const map = new Map<string, number>()
  for (const unit of giftUnits) {
    map.set(unit.cartLineId, (map.get(unit.cartLineId) ?? 0) + unit.quantity)
  }
  return map
}

function lineNetBaniAfterItemDiscount(
  line: PricingResult["items"][number],
): number {
  return Math.max(
    0,
    line.original_price_bani * line.quantity - line.item_discount_bani,
  )
}

function computeBonusExcludedNetBani(
  items: PricingResult["items"],
  engineItems: CartItemForEngine[],
  bonusExcludedCategoryIds: Set<string>,
  giftUnits: PricingResult["giftUnits"],
): number {
  if (bonusExcludedCategoryIds.size === 0) return 0

  const giftQtyByLine = giftQtyByCartLineId(giftUnits)
  let total = 0

  for (let i = 0; i < items.length; i++) {
    const line = items[i]
    const engineItem = engineItems[i]
    if (!bonusExcludedCategoryIds.has(engineItem.category_id)) continue

    const giftQty = giftQtyByLine.get(String(i)) ?? 0
    const paidQty = Math.max(0, line.quantity - giftQty)
    if (paidQty <= 0 || line.quantity <= 0) continue

    const lineNetBani = lineNetBaniAfterItemDiscount(line)
    total += Math.round((lineNetBani * paidQty) / line.quantity)
  }

  return total
}

function hasBonusRedeemablePaidItems(
  engineItems: CartItemForEngine[],
  bonusExcludedCategoryIds: Set<string>,
  giftUnits: PricingResult["giftUnits"],
): boolean {
  const giftQtyByLine = giftQtyByCartLineId(giftUnits)

  for (let i = 0; i < engineItems.length; i++) {
    const item = engineItems[i]
    const paidQty = Math.max(0, item.quantity - (giftQtyByLine.get(String(i)) ?? 0))
    if (paidQty > 0 && !bonusExcludedCategoryIds.has(item.category_id)) {
      return true
    }
  }

  return false
}

/** Как `resolvePromoCode` / `appliedPromoToDiscountEngineRule`. */
function promoCodeToDiscountEngineRule(
  promo: PromoCode,
  brandId: string,
): DiscountRule {
  const isPercent = promo.discount_type === "percent"
  return {
    id: promo.id,
    brand_id: brandId,
    name: promo.code,
    label_ru: promo.description ?? promo.code,
    label_ro: null,
    effect_type: isPercent ? "order_percent" : "order_fixed",
    effect_value: isPercent ? promo.discount_value / 100 : promo.discount_value,
    gift_item_id: null,
    gift_item_variant_id: null,
    target_item_ids: null,
    target_category_ids: null,
    free_every_n: null,
    trigger_type: "promo_code",
    promo_code_id: promo.id,
    min_order_bani: promo.min_order_bani ?? null,
    required_item_ids: null,
    required_item_min_qty: null,
    days_of_week: null,
    active_from: null,
    active_to: null,
    max_uses: promo.max_uses ?? null,
    uses_count: promo.uses_count,
    valid_from: promo.valid_from ?? null,
    valid_until: promo.valid_until ?? null,
    priority: 0,
    is_active: true,
    created_at: promo.created_at ?? new Date().toISOString(),
  }
}

function isRuleEligibleForEngine(rule: DiscountRule, now: Date): boolean {
  if (!rule.is_active) return false
  if (rule.max_uses != null && rule.uses_count >= rule.max_uses) return false
  if (rule.valid_from != null && now < new Date(rule.valid_from)) return false
  if (rule.valid_until != null && now > new Date(rule.valid_until)) return false
  if (!isRuleScheduleActive(rule, now)) return false
  return true
}

function skipExcludedCategoryItem(
  item: CartItemForEngine,
  rule: DiscountRule,
  excludedCategoryIds: Set<string>,
): boolean {
  if (!excludedCategoryIds.has(item.category_id)) return false
  if (
    rule.effect_type === "item_percent" &&
    rule.target_item_ids?.includes(item.menu_item_id)
  ) {
    return false
  }
  return true
}

function matchesTargets(item: CartItemForEngine, rule: DiscountRule): boolean {
  const ti = rule.target_item_ids
  const tc = rule.target_category_ids
  const hasItems = ti != null && ti.length > 0
  const hasCats = tc != null && tc.length > 0
  if (!hasItems && !hasCats) return true
  if (hasItems && hasCats) {
    return ti!.includes(item.menu_item_id) || tc!.includes(item.category_id)
  }
  if (hasItems) return ti!.includes(item.menu_item_id)
  return tc!.includes(item.category_id)
}

function lineItemPercentDiscountBani(
  item: CartItemForEngine,
  rules: DiscountRule[],
  excludedCategoryIds: Set<string>,
): number {
  let total = 0
  for (const rule of rules) {
    if (rule.effect_value == null) continue
    if (skipExcludedCategoryItem(item, rule, excludedCategoryIds)) continue
    if (!matchesTargets(item, rule)) continue
    const rate = discountRateFromEffectValue(rule.effect_value)
    total += Math.round(item.unit_price_bani * item.quantity * rate)
  }
  return total
}

/** cartLineId в результате = String(index) в engineItems (порядок входа сохраняется). */
function allocateGiftUnitsByCartLineId(
  engineItems: CartItemForEngine[],
  giftItems: GiftCartItem[],
): PricingResult["giftUnits"] {
  const remaining = giftItems.map((gift) => ({ ...gift }))
  const result: PricingResult["giftUnits"] = []

  for (let i = 0; i < engineItems.length; i++) {
    const engineItem = engineItems[i]
    let freeOnLine = 0
    let need = engineItem.quantity

    for (const gift of remaining) {
      if (gift.quantity <= 0) continue
      if (gift.menu_item_id !== engineItem.menu_item_id) continue
      const cartVariantId = engineItem.variant_id
      if (gift.variant_id != null && cartVariantId != null) {
        if (gift.variant_id !== cartVariantId) continue
      }
      const take = Math.min(need, gift.quantity)
      freeOnLine += take
      gift.quantity -= take
      need -= take
      if (need <= 0) break
    }

    if (freeOnLine > 0) {
      result.push({ cartLineId: String(i), quantity: freeOnLine })
    }
  }

  return result
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
      bonuses_blocked: false,
      bonus_cap_base_bani: 0,
      max_bonuses_redeemable: 0,
      bonuses_redeemed: 0,
      delivery_fee_bani: deliveryFeeBani,
      total_bani: deliveryFeeBani,
      active_promotion: false,
      discount_rules_applied: [],
      giftUnits: [],
      giftItems: [],
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

  const [
    { data: menuRows, error: menuError },
    variantResult,
    { excludedCategoryIds, bonusExcludedCategoryIds },
  ] = await Promise.all([
    supabase
      .from("menu_items")
      .select("id, price, discount_percent, has_sizes, category_id")
      .in("id", menuItemIds),
    variantIds.length
      ? supabase
          .from("menu_item_variants")
          .select("id, menu_item_id, price")
          .in("id", variantIds)
      : Promise.resolve({ data: [] as VariantRow[], error: null }),
    fetchMenuCategoryExclusionSets(supabase, brandId),
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

    items.push({
      menu_item_id: cartItem.menu_item_id,
      quantity: cartItem.quantity,
      price_bani: unitPriceBani,
      original_price_bani: unitOriginalBani,
      item_discount_pct: itemDiscountPct,
      item_discount_bani: lineItemDiscountBani,
    })
  }

  const subtotalBani = items.reduce(
    (sum, line) => sum + line.original_price_bani * line.quantity,
    0,
  )

  const now = new Date()

  const { data: autoDiscountRulesRaw } = await (
    supabase.from("discount_rules") as any
  )
    .select("*")
    .eq("brand_id", brandId)
    .eq("trigger_type", "auto")
    .eq("is_active", true)

  const activeAutoRules = (autoDiscountRulesRaw ?? []).filter(
    (rule: DiscountRule) => isRuleScheduleActive(rule, now),
  )

  const promotionActive = activeAutoRules.some(
    (rule: DiscountRule) => rule.effect_type !== "bonus_multiplier",
  )

  // База+вариант без топпингов; cheapest_item_free в движке топпинги не учитывает.
  const engineItems: CartItemForEngine[] = cartItems.map((cartItem, index) => {
    const menuItem = menuById.get(cartItem.menu_item_id)!
    const line = items[index]
    return {
      menu_item_id: cartItem.menu_item_id,
      category_id: menuItem.category_id ?? "",
      variant_id: cartItem.variant_id ?? null,
      quantity: cartItem.quantity,
      unit_price_bani: line.price_bani,
    }
  })

  let promoCodeId: string | null = null
  let promoCodeRule: DiscountRule | undefined
  let promoError: string | null = null

  const normalizedPromo = promoCode?.trim() ?? ""
  if (normalizedPromo) {
    const validation = await validatePromoCodeWithClient(
      supabase,
      normalizedPromo,
      brandId,
      subtotalBani,
    )

    if (validation.valid) {
      promoCodeId = validation.promo.id
      promoCodeRule = promoCodeToDiscountEngineRule(validation.promo, brandId)
    } else {
      promoError = validation.error
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

  const eligibleItemPercentRules = activeAutoRules
    .filter(
      (rule: DiscountRule) =>
        rule.effect_type === "item_percent" &&
        isRuleEligibleForEngine(rule, now),
    )
    .sort((a: DiscountRule, b: DiscountRule) => b.priority - a.priority)

  let menuDerivedItemDiscountBani = 0
  let engineItemPercentBani = 0
  let promoDiscountBani = 0

  for (const entry of engineOutput.appliedDiscounts) {
    if (entry.effect_type === "item_percent") {
      engineItemPercentBani += entry.discount_bani
    } else {
      promoDiscountBani += entry.discount_bani
    }
  }

  for (let i = 0; i < items.length; i++) {
    const line = items[i]
    const engineItem = engineItems[i]
    const menuLineDiscountBani = line.item_discount_bani
    menuDerivedItemDiscountBani += menuLineDiscountBani

    const campaignLineDiscountBani = lineItemPercentDiscountBani(
      engineItem,
      eligibleItemPercentRules,
      excludedCategoryIds,
    )
    const lineTotalDiscountBani = menuLineDiscountBani + campaignLineDiscountBani
    const lineOriginalSubtotalBani = line.original_price_bani * line.quantity

    items[i] = {
      ...line,
      item_discount_bani: lineTotalDiscountBani,
      item_discount_pct: pctOf(lineTotalDiscountBani, lineOriginalSubtotalBani),
    }
  }

  const itemDiscountBani = menuDerivedItemDiscountBani + engineItemPercentBani
  const itemDiscountPct = pctOf(itemDiscountBani, subtotalBani)
  const promoDiscountPct = pctOf(promoDiscountBani, subtotalBani)

  const grandTotalAfterDiscountsBani = Math.max(
    0,
    subtotalBani - itemDiscountBani - promoDiscountBani + deliveryFeeBani,
  )

  const giftUnits = allocateGiftUnitsByCartLineId(
    engineItems,
    engineOutput.giftItems,
  )

  const bonusExcludedNetBani = computeBonusExcludedNetBani(
    items,
    engineItems,
    bonusExcludedCategoryIds,
    giftUnits,
  )

  const bonusCapBaseBani = hasBonusRedeemablePaidItems(
    engineItems,
    bonusExcludedCategoryIds,
    giftUnits,
  )
    ? Math.max(0, grandTotalAfterDiscountsBani - bonusExcludedNetBani)
    : 0

  const [{ maxRedemptionRate }, bonusesAvailable] = await Promise.all([
    getBonusSettings(),
    profileId
      ? fetchProfileBonusBalance(supabase, profileId)
      : Promise.resolve(0),
  ])

  const maxBonusesRedeemable = Math.floor(
    Math.min(
      bonusesAvailable,
      (bonusCapBaseBani / 100) * (maxRedemptionRate ?? 0.3),
    ),
  )

  let bonusesRedeemed = 0
  if (profileId && bonusesRequested > 0) {
    bonusesRedeemed = Math.min(
      Math.max(0, Math.floor(bonusesRequested)),
      bonusesAvailable,
      maxBonusesRedeemable,
    )
  }

  const totalBani = Math.max(
    0,
    subtotalBani -
      itemDiscountBani -
      promoDiscountBani -
      bonusesRedeemed * 100 +
      deliveryFeeBani,
  )

  const promoCodeRuleId = promoCodeRule?.id
  const discountRulesApplied: PricingResult["discount_rules_applied"] = []

  if (menuDerivedItemDiscountBani > 0) {
    discountRulesApplied.push({
      type: "item_discount",
      label: "Скидка на товары",
      amount_bani: menuDerivedItemDiscountBani,
    })
  }

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

  if (bonusesRedeemed > 0) {
    discountRulesApplied.push({
      type: "bonus_redemption",
      label: "Списание бонусов",
      amount_bani: bonusesRedeemed * 100,
    })
  }

  const giftItems = engineOutput.giftItems

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
    bonuses_blocked: false,
    bonus_cap_base_bani: bonusCapBaseBani,
    max_bonuses_redeemable: maxBonusesRedeemable,
    bonuses_redeemed: bonusesRedeemed,
    delivery_fee_bani: deliveryFeeBani,
    total_bani: totalBani,
    active_promotion: promotionActive,
    discount_rules_applied: discountRulesApplied,
    giftUnits,
    giftItems,
  }
}
