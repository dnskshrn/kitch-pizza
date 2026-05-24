
export type DiscountEffect =
| 'order_percent'
| 'order_fixed'
| 'item_percent'
| 'free_delivery'
| 'free_item'
| 'cheapest_item_free'
| 'bonus_multiplier'
export type DiscountTrigger = 'auto' | 'promo_code'
export interface DiscountRule {
id: string
brand_id: string
name: string
label_ru: string | null
label_ro: string | null
effect_type: DiscountEffect
effect_value: number | null
gift_item_id: string | null
gift_item_variant_id: string | null
target_item_ids: string[] | null
target_category_ids: string[] | null
free_every_n: number | null
max_free_items?: number | null
trigger_type: DiscountTrigger
promo_code_id: string | null
min_order_bani: number | null
required_item_ids: string[] | null
required_item_min_qty: number | null
days_of_week: number[] | null  // 1=Mon..7=Sun
active_from: string | null     // 'HH:MM:SS'
active_to: string | null
max_uses: number | null
uses_count: number
valid_from: string | null
valid_until: string | null
priority: number
is_active: boolean
created_at: string
}
// Cart item passed into the discount engine
export interface CartItemForEngine {
menu_item_id: string
category_id: string
variant_id: string | null
quantity: number
unit_price_bani: number   // price of one unit, before any discount
}
// Gift item produced by the engine
export interface GiftCartItem {
menu_item_id: string
variant_id: string | null
rule_id: string
label_ru: string
quantity: number
}
// One applied discount entry (written to orders.discount_rules_applied)
export interface AppliedDiscount {
rule_id: string
effect_type: DiscountEffect
label_ru: string
discount_bani: number
}
// Delivery zone input for engine
export interface DeliveryZoneForEngine {
price_bani: number
free_from_bani: number
}
// Full engine input
export interface DiscountEngineInput {
items: CartItemForEngine[]
rules: DiscountRule[]          // already-filtered active auto rules
promoCodeRule?: DiscountRule   // resolved promo code rule (if any)
deliveryZone: DeliveryZoneForEngine | null
/** Категории меню, на которые не распространяются скидки (исключённые из базы расчёта). */
excludedCategoryIds?: string[]
}
// Engine output
export interface DiscountEngineOutput {
appliedDiscounts: AppliedDiscount[]
giftItems: GiftCartItem[]
itemSubtotalBani: number        // raw items total
totalDiscountBani: number       // sum of all discounts on items
discountedSubtotalBani: number  // itemSubtotal - totalDiscount
deliveryFeeBani: number | null  // null if deliveryZone is null
totalBani: number | null        // null if deliveryZone is null
bonusMultiplier: number         // default 1.0, higher if bonus_multiplier rule active
/** category_id, по которым в корзине были позиции и exclude=true в конфиге движка */
excludedCategoryIds: string[]
}
