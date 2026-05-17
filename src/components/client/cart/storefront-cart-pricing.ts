import { getCartItemPrice } from "@/lib/cart-helpers"
import { evaluateDiscounts } from "@/lib/discount-engine"
import type { CartItem } from "@/types/cart"
import type { PromoCode } from "@/types/database"
import type {
  CartItemForEngine,
  DeliveryZoneForEngine,
  DiscountEngineOutput,
  DiscountRule,
} from "@/types/promotions"

export function cartItemsForDiscountEngine(items: CartItem[]): CartItemForEngine[] {
  return items.map((ci) => ({
    menu_item_id: ci.menuItem.id,
    category_id: ci.menuItem.category_id,
    variant_id: ci.variantId ?? null,
    quantity: ci.quantity,
    unit_price_bani: getCartItemPrice(ci),
  }))
}

/** Как при `resolvePromoCode`; `brand_id` движку не нужен. */
export function appliedPromoToDiscountEngineRule(promo: PromoCode): DiscountRule {
  const isPercent = promo.discount_type === "percent"
  return {
    id: promo.id,
    brand_id: "",
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

export type StorefrontDiscountEvaluationArgs = {
  cartItems: CartItem[]
  discountAutoRules: DiscountRule[]
  appliedPromo: PromoCode | null
  excludedCategoryIds: string[]
  deliveryZone: DeliveryZoneForEngine | null
}

export function evaluateStorefrontCartDiscount(
  args: StorefrontDiscountEvaluationArgs,
): DiscountEngineOutput {
  const items = cartItemsForDiscountEngine(args.cartItems)
  return evaluateDiscounts({
    items,
    rules: args.discountAutoRules,
    promoCodeRule:
      args.appliedPromo != null
        ? appliedPromoToDiscountEngineRule(args.appliedPromo)
        : undefined,
    deliveryZone: args.deliveryZone,
    excludedCategoryIds:
      args.excludedCategoryIds.length > 0
        ? args.excludedCategoryIds
        : undefined,
  })
}
