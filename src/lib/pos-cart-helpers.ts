import { calcToppingGroupCharge, calcToppingChargesById } from "@/lib/topping-pricing"
import {
  migratePosCartToppingsFromLegacy,
  posCartToppingsConfigKey,
} from "@/lib/pos-cart-toppings"
import type { PosCartItem, PosCartTopping } from "@/types/pos"

export type PosCartLang = "RU" | "RO"

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
    const chargeBani = t.price * t.quantity
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
): number {
  const resolved = migratePosCartToppingsFromLegacy(toppings)
  const byGroup = new Map<
    string,
    { id: string; price: number; quantity: number }[]
  >()
  let sum = 0

  for (const t of resolved) {
    if (!t.topping_group_id) {
      sum += t.price * t.quantity
      continue
    }
    const list = byGroup.get(t.topping_group_id) ?? []
    list.push({ id: t.id, price: t.price, quantity: t.quantity })
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
  basePriceBani: number,
  toppings: PosCartTopping[],
  toppingGroupFreeCounts: Record<string, number> = {},
): number {
  return (
    Math.round(basePriceBani) +
    calcPosToppingsCharge(toppings, toppingGroupFreeCounts)
  )
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
): PosOrderItemToppingPayload[] {
  return migratePosCartToppingsFromLegacy(toppings).map((t) => ({
    name: posToppingDisplayName(t, lang),
    price: Math.round(t.price),
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

export function posLinePayloadFromCartItem(c: PosCartItem) {
  return {
    menuItemId: c.menuItemId,
    name: posLineItemName(c.name, c.toppings),
    size: c.size,
    variantId: c.variantId ?? null,
    unitPriceBani: c.price,
    qty: c.qty,
    toppings: posToppingsPayloadForDb(c.toppings),
  }
}

/** Пересчёт unit price строки при известной базовой цене (без топпингов). */
export function withPosCartItemRecalculatedPrice(
  item: PosCartItem,
  basePriceBani: number,
): PosCartItem {
  return {
    ...item,
    price: getPosCartItemUnitPriceBani(
      basePriceBani,
      item.toppings,
      item.toppingGroupFreeCounts ?? {},
    ),
  }
}
