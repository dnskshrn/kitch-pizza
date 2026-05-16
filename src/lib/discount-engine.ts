import type {
  AppliedDiscount,
  CartItemForEngine,
  DiscountEngineInput,
  DiscountEngineOutput,
  DiscountRule,
  GiftCartItem,
} from '@/types/promotions'

/** JS getDay(): 0 Sun … 6 Sat → 1 Mon … 7 Sun */
function calendarDay1To7(d: Date): number {
  const dow = d.getDay()
  return dow === 0 ? 7 : dow
}

function parseTimeToSeconds(hms: string): number | null {
  const parts = hms.trim().split(':').map((p) => Number.parseInt(p, 10))
  if (parts.some((n) => Number.isNaN(n))) return null
  const h = parts[0] ?? 0
  const m = parts[1] ?? 0
  const s = parts[2] ?? 0
  if (h < 0 || h > 23 || m < 0 || m > 59 || s < 0 || s > 59) return null
  return h * 3600 + m * 60 + s
}

/**
 * Returns true if the rule is currently within its schedule.
 * Handles overnight ranges (e.g. active_from='23:00', active_to='03:00').
 * days_of_week: 1=Monday … 7=Sunday; null → all days.
 * If active_from and active_to are both null → all times match (after day check).
 */
export function isRuleScheduleActive(rule: DiscountRule, now: Date): boolean {
  if (rule.days_of_week != null && rule.days_of_week.length > 0) {
    const day = calendarDay1To7(now)
    if (!rule.days_of_week.includes(day)) return false
  }

  if (rule.active_from == null && rule.active_to == null) return true

  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const t = Math.floor((now.getTime() - midnight.getTime()) / 1000)

  if (rule.active_from != null && rule.active_to == null) {
    const fromSec = parseTimeToSeconds(rule.active_from)
    return fromSec != null && t >= fromSec
  }
  if (rule.active_from == null && rule.active_to != null) {
    const toSec = parseTimeToSeconds(rule.active_to)
    return toSec != null && t <= toSec
  }

  const fromSec = parseTimeToSeconds(rule.active_from!)
  const toSec = parseTimeToSeconds(rule.active_to!)
  if (fromSec == null || toSec == null) return false

  if (fromSec <= toSec) {
    return t >= fromSec && t <= toSec
  }

  // Overnight
  return t >= fromSec || t <= toSec
}

function isRuleEligible(rule: DiscountRule, now: Date): boolean {
  if (!rule.is_active) return false
  if (rule.max_uses != null && rule.uses_count >= rule.max_uses) return false
  if (rule.valid_from != null && now < new Date(rule.valid_from)) return false
  if (rule.valid_until != null && now > new Date(rule.valid_until)) return false
  if (!isRuleScheduleActive(rule, now)) return false
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

function lineKey(item: CartItemForEngine): string {
  return `${item.menu_item_id}:${item.variant_id ?? ''}`
}

type MutableQty = Map<string, { item: CartItemForEngine; qty: number }>

function buildMutableQty(items: CartItemForEngine[]): MutableQty {
  const m: MutableQty = new Map()
  for (const it of items) {
    const k = lineKey(it)
    const prev = m.get(k)
    if (prev) prev.qty += it.quantity
    else m.set(k, { item: it, qty: it.quantity })
  }
  return m
}

function expandUnitsFromMutable(
  work: MutableQty,
  rule: DiscountRule
): { unitPriceBani: number; key: string }[] {
  const units: { unitPriceBani: number; key: string }[] = []
  for (const [key, { item, qty }] of work) {
    if (qty <= 0) continue
    if (!matchesTargets(item, rule)) continue
    for (let i = 0; i < qty; i++) {
      units.push({ unitPriceBani: item.unit_price_bani, key })
    }
  }
  units.sort((a, b) => a.unitPriceBani - b.unitPriceBani)
  return units
}

function consumeUnits(work: MutableQty, key: string, count: number): void {
  const row = work.get(key)
  if (!row) return
  row.qty = Math.max(0, row.qty - count)
}

function aggregateGiftsFromKeys(
  keysTaken: Map<string, number>,
  rule: DiscountRule,
  work: MutableQty
): GiftCartItem[] {
  const label = rule.label_ru ?? ''
  const out: GiftCartItem[] = []
  for (const [key, qty] of keysTaken) {
    if (qty <= 0) continue
    const row = work.get(key)
    if (!row) continue
    out.push({
      menu_item_id: row.item.menu_item_id,
      variant_id: row.item.variant_id,
      rule_id: rule.id,
      label_ru: label,
      quantity: qty,
    })
  }
  return out
}

export function evaluateDiscounts(
  input: DiscountEngineInput,
  currentTime?: Date
): DiscountEngineOutput {
  const now = currentTime ?? new Date()

  const appliedDiscounts: AppliedDiscount[] = []
  const giftItems: GiftCartItem[] = []

  const items = input.items
  const itemSubtotalBani = items.reduce(
    (s, it) => s + it.unit_price_bani * it.quantity,
    0
  )

  if (items.length === 0) {
    const dz = input.deliveryZone
    return {
      appliedDiscounts: [],
      giftItems: [],
      itemSubtotalBani: 0,
      totalDiscountBani: 0,
      discountedSubtotalBani: 0,
      deliveryFeeBani: dz ? (0 >= dz.free_from_bani ? 0 : dz.price_bani) : null,
      totalBani: dz ? (0 >= dz.free_from_bani ? 0 : dz.price_bani) : null,
      bonusMultiplier: 1.0,
    }
  }

  const autoRules = input.rules.filter((r) => isRuleEligible(r, now))

  const cheapestRules = autoRules
    .filter((r) => r.effect_type === 'cheapest_item_free')
    .sort((a, b) => b.priority - a.priority)

  const workQty = buildMutableQty(items)
  let cheapestTotalDiscount = 0

  for (const rule of cheapestRules) {
    const n = rule.free_every_n
    if (n == null || n <= 0) continue

    const units = expandUnitsFromMutable(workQty, rule)
    const freeCount = Math.floor(units.length / n)
    if (freeCount <= 0) continue

    const keysTaken = new Map<string, number>()
    let ruleDiscount = 0
    for (let i = 0; i < freeCount; i++) {
      const u = units[i]
      ruleDiscount += u.unitPriceBani
      keysTaken.set(u.key, (keysTaken.get(u.key) ?? 0) + 1)
      consumeUnits(workQty, u.key, 1)
    }

    cheapestTotalDiscount += ruleDiscount
    appliedDiscounts.push({
      rule_id: rule.id,
      effect_type: 'cheapest_item_free',
      label_ru: rule.label_ru ?? '',
      discount_bani: ruleDiscount,
    })
    giftItems.push(...aggregateGiftsFromKeys(keysTaken, rule, workQty))
  }

  const itemPercentRules = autoRules
    .filter((r) => r.effect_type === 'item_percent')
    .sort((a, b) => b.priority - a.priority)

  let itemPercentTotal = 0
  for (const rule of itemPercentRules) {
    const ev = rule.effect_value
    if (ev == null) continue
    let ruleDisc = 0
    for (const it of items) {
      if (!matchesTargets(it, rule)) continue
      const lineSub = it.unit_price_bani * it.quantity
      ruleDisc += Math.round(lineSub * ev)
    }
    if (ruleDisc <= 0) continue
    itemPercentTotal += ruleDisc
    appliedDiscounts.push({
      rule_id: rule.id,
      effect_type: 'item_percent',
      label_ru: rule.label_ru ?? '',
      discount_bani: ruleDisc,
    })
  }

  let running = itemSubtotalBani - cheapestTotalDiscount - itemPercentTotal
  running = Math.max(0, running)

  const orderPercentAutos = autoRules
    .filter((r) => r.effect_type === 'order_percent' && r.trigger_type === 'auto')
    .sort((a, b) => b.priority - a.priority)

  for (const rule of orderPercentAutos) {
    const ev = rule.effect_value
    if (ev == null) continue
    const disc = Math.round(running * ev)
    if (disc <= 0) continue
    appliedDiscounts.push({
      rule_id: rule.id,
      effect_type: 'order_percent',
      label_ru: rule.label_ru ?? '',
      discount_bani: disc,
    })
    running = Math.max(0, running - disc)
  }

  const promo = input.promoCodeRule
  if (promo && isRuleEligible(promo, now)) {
    if (promo.effect_type === 'order_percent' && promo.effect_value != null) {
      const disc = Math.round(running * promo.effect_value)
      if (disc > 0) {
        appliedDiscounts.push({
          rule_id: promo.id,
          effect_type: 'order_percent',
          label_ru: promo.label_ru ?? '',
          discount_bani: disc,
        })
        running = Math.max(0, running - disc)
      }
    } else if (promo.effect_type === 'order_fixed' && promo.effect_value != null) {
      const disc = Math.min(promo.effect_value, running)
      if (disc > 0) {
        appliedDiscounts.push({
          rule_id: promo.id,
          effect_type: 'order_fixed',
          label_ru: promo.label_ru ?? '',
          discount_bani: disc,
        })
        running = Math.max(0, running - disc)
      }
    }
  }

  const discountedSubtotalBani = running
  const totalDiscountBani = itemSubtotalBani - discountedSubtotalBani

  const bonusRules = autoRules.filter((r) => r.effect_type === 'bonus_multiplier')
  let bonusMultiplier = 1.0
  for (const r of bonusRules) {
    if (r.effect_value != null && r.effect_value > bonusMultiplier) {
      bonusMultiplier = r.effect_value
    }
  }

  const dz = input.deliveryZone
  let deliveryFeeBani: number | null = null
  let totalBani: number | null = null

  if (dz) {
    const freeFromFreeDelivery = autoRules.some((r) => r.effect_type === 'free_delivery')

    if (freeFromFreeDelivery) {
      deliveryFeeBani = 0
    } else if (discountedSubtotalBani >= dz.free_from_bani) {
      deliveryFeeBani = 0
    } else {
      deliveryFeeBani = dz.price_bani
    }

    totalBani = discountedSubtotalBani + deliveryFeeBani
  }

  return {
    appliedDiscounts,
    giftItems,
    itemSubtotalBani,
    totalDiscountBani,
    discountedSubtotalBani,
    deliveryFeeBani,
    totalBani,
    bonusMultiplier,
  }
}
