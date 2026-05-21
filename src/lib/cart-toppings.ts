import type { CartTopping } from "@/types/cart"
import type { Topping } from "@/types/database"

export function getTotalQuantityInGroup(
  toppings: CartTopping[],
  groupToppingIds: readonly string[],
): number {
  const ids = new Set(groupToppingIds)
  return toppings
    .filter((t) => ids.has(t.id))
    .reduce((sum, t) => sum + t.quantity, 0)
}

export function cartToppingFromTopping(
  t: Topping | Omit<CartTopping, "quantity">,
): Omit<CartTopping, "quantity"> {
  return {
    id: t.id,
    name_ru: t.name_ru,
    name_ro: t.name_ro,
    price: t.price,
    topping_group_id:
      "topping_group_id" in t && t.topping_group_id
        ? t.topping_group_id
        : (t as Topping).group_id,
  }
}

/** Сборка `cartToppings` из плоского списка id (дубликаты → quantity). */
export function buildCartToppingsFromSelection(
  toppingIds: string[],
  toppingsList: Topping[],
): CartTopping[] {
  const byId = new Map<string, CartTopping>()
  for (const id of toppingIds) {
    const meta = toppingsList.find((x) => x.id === id)
    if (!meta) continue
    const existing = byId.get(id)
    if (existing) {
      existing.quantity += 1
    } else {
      byId.set(id, { ...cartToppingFromTopping(meta), quantity: 1 })
    }
  }
  return [...byId.values()]
}

/** Миграция persist: только `selectedToppingIds` + `toppingsList`. */
export function migrateCartToppingsFromLegacy(item: {
  cartToppings?: CartTopping[]
  selectedToppingIds: string[]
  toppingsList: Topping[]
}): CartTopping[] {
  if (item.cartToppings?.length) {
    return item.cartToppings.map((t) => ({
      ...t,
      topping_group_id:
        t.topping_group_id ??
        item.toppingsList.find((x) => x.id === t.id)?.group_id ??
        "",
      quantity:
        typeof t.quantity === "number" && t.quantity >= 1
          ? Math.floor(t.quantity)
          : 1,
    }))
  }
  return buildCartToppingsFromSelection(
    item.selectedToppingIds,
    item.toppingsList,
  )
}

export function expandSelectedToppingIds(cartToppings: CartTopping[]): string[] {
  return cartToppings.flatMap((t) =>
    Array.from({ length: t.quantity }, () => t.id),
  )
}

export function cartToppingsConfigKey(toppings: CartTopping[]): string {
  return [...toppings]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((t) => `${t.id}:${t.quantity}`)
    .join("\0")
}

export function syncCartItemToppingFields<T extends {
  cartToppings: CartTopping[]
  toppingsList: Topping[]
}>(item: T): T & { selectedToppingIds: string[] } {
  return {
    ...item,
    selectedToppingIds: expandSelectedToppingIds(item.cartToppings),
  }
}
