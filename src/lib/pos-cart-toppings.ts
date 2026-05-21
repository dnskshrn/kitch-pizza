import {
  cartToppingFromTopping,
  cartToppingsConfigKey,
  getTotalQuantityInGroup,
} from "@/lib/cart-toppings"
import type { PosCartTopping } from "@/types/pos"

export { getTotalQuantityInGroup, cartToppingsConfigKey as posCartToppingsConfigKey, cartToppingFromTopping }

export type PosToppingInput = Omit<PosCartTopping, "quantity">

export function posAddTopping(
  toppings: PosCartTopping[],
  topping: PosToppingInput,
  groupToppingIds: readonly string[],
  groupMaxSelections: number | null,
): PosCartTopping[] {
  const totalInGroup = getTotalQuantityInGroup(toppings, groupToppingIds)
  if (groupMaxSelections != null && totalInGroup >= groupMaxSelections) {
    return toppings
  }

  const existing = toppings.find((t) => t.id === topping.id)
  if (existing) {
    return toppings.map((t) =>
      t.id === topping.id ? { ...t, quantity: t.quantity + 1 } : t,
    )
  }
  return [...toppings, { ...cartToppingFromTopping(topping), quantity: 1 }]
}

export function posRemoveTopping(
  toppings: PosCartTopping[],
  toppingId: string,
): PosCartTopping[] {
  const existing = toppings.find((t) => t.id === toppingId)
  if (!existing) return toppings
  if (existing.quantity > 1) {
    return toppings.map((t) =>
      t.id === toppingId ? { ...t, quantity: t.quantity - 1 } : t,
    )
  }
  return toppings.filter((t) => t.id !== toppingId)
}

type LegacyPosDbTopping = {
  id?: string
  name?: string
  name_ru?: string
  name_ro?: string
  price?: number
  quantity?: number
  topping_group_id?: string
}

/** Нормализация топпингов POS (БД / legacy `{ name, price }` → quantity-aware). */
export function migratePosCartToppingsFromLegacy(
  toppings: PosCartTopping[] | LegacyPosDbTopping[],
  metaById?: ReadonlyMap<
    string,
    { name_ru: string; name_ro: string; group_id: string; price: number }
  >,
): PosCartTopping[] {
  if (!toppings.length) return []

  const first = toppings[0] as PosCartTopping | LegacyPosDbTopping
  if (
    "quantity" in first &&
    typeof first.quantity === "number" &&
    "topping_group_id" in first &&
    typeof first.topping_group_id === "string" &&
    first.topping_group_id &&
    "name_ru" in first &&
    typeof first.name_ru === "string"
  ) {
    return (toppings as PosCartTopping[]).map((t) => ({
      ...t,
      quantity:
        typeof t.quantity === "number" && t.quantity >= 1
          ? Math.floor(t.quantity)
          : 1,
      topping_group_id: t.topping_group_id ?? "",
    }))
  }

  const byKey = new Map<string, PosCartTopping>()
  for (let i = 0; i < toppings.length; i++) {
    const raw = toppings[i] as LegacyPosDbTopping
    const id =
      typeof raw.id === "string" && raw.id.trim()
        ? raw.id.trim()
        : `legacy-${i}-${raw.name ?? raw.name_ru ?? ""}`
    const meta = metaById?.get(id)
    const nameRu =
      typeof raw.name_ru === "string"
        ? raw.name_ru
        : typeof raw.name === "string"
          ? raw.name
          : (meta?.name_ru ?? "")
    const nameRo =
      typeof raw.name_ro === "string"
        ? raw.name_ro
        : (meta?.name_ro ?? nameRu)
    const price = Math.round(
      typeof raw.price === "number" ? raw.price : (meta?.price ?? 0),
    )
    const groupId =
      typeof raw.topping_group_id === "string" && raw.topping_group_id
        ? raw.topping_group_id
        : (meta?.group_id ?? "")
    const qty =
      typeof raw.quantity === "number" && raw.quantity >= 1
        ? Math.floor(raw.quantity)
        : 1

    const existing = byKey.get(id)
    if (existing) {
      existing.quantity += qty
    } else {
      byKey.set(id, {
        id,
        name_ru: nameRu,
        name_ro: nameRo,
        price,
        quantity: qty,
        topping_group_id: groupId,
      })
    }
  }
  return [...byKey.values()].filter((t) => t.name_ru)
}
