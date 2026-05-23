import { calcToppingGroupCharge, calcToppingChargesById } from "@/lib/topping-pricing"
import {
  migratePosCartToppingsFromLegacy,
  posCartToppingsConfigKey,
} from "@/lib/pos-cart-toppings"
import type { PosCartItem, PosCartTopping } from "@/types/pos"

export type PosCartLang = "RU" | "RO"

function posToppingUnitPriceBani(
  t: PosCartTopping,
  isAggregator: boolean,
): number {
  if (isAggregator && t.aggregator_price_bani != null) {
    return t.aggregator_price_bani
  }
  return t.price
}

export function posToppingDisplayName(
  t: PosCartTopping,
  lang: PosCartLang = "RU",
): string {
  return lang === "RO" ? t.name_ro : t.name_ru
}

export function posCartToppingsDisplayNames(
  toppings: PosCartTopping[],
  lang: PosCartLang = "RU",
): string[] {
  const names: string[] = []
  for (const t of migratePosCartToppingsFromLegacy(toppings)) {
    const label = posToppingDisplayName(t, lang)
    for (let i = 0; i < t.quantity; i++) names.push(label)
  }
  return names
}

export function posCartItemToppingsSummary(
  toppings: PosCartTopping[],
  lang: PosCartLang = "RU",
): string {
  return posCartToppingsDisplayNames(toppings, lang).join(", ")
}

export type PosCartToppingSummaryLine = {
  toppingId: string
  name: string
  quantity: number
  chargeBani: number
  isFree: boolean
}

/** Строки топпингов для сводки POS (с учётом free_count и charge). */
export function getPosCartItemToppingDisplayLines(
  item: Pick<PosCartItem, "toppings" | "toppingGroupFreeCounts">,
  lang: PosCartLang = "RU",
): PosCartToppingSummaryLine[] {
  const toppings = migratePosCartToppingsFromLegacy(item.toppings)
  if (toppings.length === 0) return []

  const freeCounts = item.toppingGroupFreeCounts ?? {}
  const byGroup = new Map<string, PosCartTopping[]>()
  const ungrouped: PosCartTopping[] = []

  for (const t of toppings) {
    if (!t.topping_group_id) {
      ungrouped.push(t)
      continue
    }
    const list = byGroup.get(t.topping_group_id) ?? []
    list.push(t)
    byGroup.set(t.topping_group_id, list)
  }

  const lines: PosCartToppingSummaryLine[] = []

  for (const [, groupToppings] of byGroup) {
    const selections = groupToppings.map((t) => ({
      id: t.id,
      price: t.price,
      quantity: t.quantity,
    }))
    const groupId = groupToppings[0]?.topping_group_id ?? ""
    const freeCount = freeCounts[groupId] ?? 0
    const charges = calcToppingChargesById(selections, freeCount)

    for (const t of groupToppings) {
      const chargeBani = charges.get(t.id) ?? 0
      lines.push({
        toppingId: t.id,
        name: posToppingDisplayName(t, lang),
        quantity: t.quantity,
        chargeBani,
        isFree: chargeBani === 0 && t.quantity > 0,
      })
    }
  }

  for (const t of ungrouped) {
    const chargeBani = posToppingUnitPriceBani(t, false) * t.quantity
    lines.push({
      toppingId: t.id,
      name: posToppingDisplayName(t, lang),
      quantity: t.quantity,
      chargeBani,
      isFree: chargeBani === 0 && t.quantity > 0,
    })
  }

  return lines
}

export function calcPosToppingsCharge(
  toppings: PosCartTopping[],
  toppingGroupFreeCounts: Record<string, number> = {},
  isAggregator = false,
): number {
  const resolved = migratePosCartToppingsFromLegacy(toppings)
  const byGroup = new Map<
    string,
    { id: string; price: number; quantity: number }[]
  >()
  let sum = 0

  for (const t of resolved) {
    const unitPrice = posToppingUnitPriceBani(t, isAggregator)
    if (!t.topping_group_id) {
      sum += unitPrice * t.quantity
      continue
    }
    const list = byGroup.get(t.topping_group_id) ?? []
    list.push({ id: t.id, price: unitPrice, quantity: t.quantity })
    byGroup.set(t.topping_group_id, list)
  }

  for (const [groupId, selections] of byGroup) {
    sum += calcToppingGroupCharge(
      selections,
      toppingGroupFreeCounts[groupId] ?? 0,
    )
  }
  return sum
}

/** Цена одной единицы позиции POS (база + топпинги с учётом free_count). */
export function getPosCartItemUnitPriceBani(
  item: PosCartItem,
  isAggregator: boolean,
): number {
  if (isAggregator && item.aggregatorUnitPriceBani != null) {
    return (
      Math.round(item.aggregatorUnitPriceBani) +
      calcPosToppingsCharge(
        item.toppings,
        item.toppingGroupFreeCounts ?? {},
        true,
      )
    )
  }
  return Math.round(item.price)
}

export function isSamePosCartToppingConfig(
  a: PosCartTopping[],
  b: PosCartTopping[],
): boolean {
  return posCartToppingsConfigKey(a) === posCartToppingsConfigKey(b)
}

export type PosOrderItemToppingPayload = {
  name: string
  price: number
  quantity: number
}

/** JSON для `order_items.toppings` (каталожная цена за единицу + quantity). */
export function posToppingsPayloadForDb(
  toppings: PosCartTopping[],
  lang: PosCartLang = "RU",
  isAggregator = false,
): PosOrderItemToppingPayload[] {
  return migratePosCartToppingsFromLegacy(toppings).map((t) => ({
    name: posToppingDisplayName(t, lang),
    price: Math.round(posToppingUnitPriceBani(t, isAggregator)),
    quantity: t.quantity,
  }))
}

export function posLineItemName(
  baseName: string,
  toppings: PosCartTopping[],
  lang: PosCartLang = "RU",
): string {
  const part = posCartItemToppingsSummary(toppings, lang)
  return part ? `${baseName} + ${part}` : baseName
}

export function posLinePayloadFromCartItem(
  item: PosCartItem,
  isAggregator = false,
) {
  const unitPriceBani = isAggregator
    ? getPosCartItemUnitPriceBani(item, true)
    : Math.round(item.price)

  return {
    menuItemId: item.menuItemId,
    name: posLineItemName(item.name, item.toppings),
    size: item.size,
    variantId: item.variantId ?? null,
    unitPriceBani,
    qty: item.qty,
    toppings: posToppingsPayloadForDb(item.toppings, "RU", isAggregator),
  }
}

/** Пересчёт unit price строки при известной базовой цене (без топпингов). */
export function withPosCartItemRecalculatedPrice(
  item: PosCartItem,
  basePriceBani: number,
  isAggregator: boolean,
  aggregatorBasePriceBani?: number | null,
): PosCartItem {
  const next: PosCartItem = {
    ...item,
    ...(isAggregator && aggregatorBasePriceBani != null
      ? { aggregatorUnitPriceBani: aggregatorBasePriceBani }
      : {}),
    price:
      Math.round(basePriceBani) +
      calcPosToppingsCharge(
        item.toppings,
        item.toppingGroupFreeCounts ?? {},
        isAggregator,
      ),
  }
  if (isAggregator && aggregatorBasePriceBani != null) {
    next.aggregatorUnitPriceBani = aggregatorBasePriceBani
    next.price = getPosCartItemUnitPriceBani(next, true)
  }
  return next
}
