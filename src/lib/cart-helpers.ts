import type { CartItem, CartSelectedSize } from "@/types/cart"
import type { MenuItem } from "@/types/database"

export type CartLang = "RU" | "RO"

function sortedToppingIdsKey(ids: string[]): string {
  return [...ids].sort().join("\0")
}

/** Сравнение конфигураций для merge в корзине. */
export function isSameCartConfiguration(
  a: CartItem,
  menuItem: MenuItem,
  selectedSize: CartSelectedSize,
  toppingIds: string[],
): boolean {
  if (a.menuItem.id !== menuItem.id) return false
  if (a.selectedSize !== selectedSize) return false
  return sortedToppingIdsKey(a.selectedToppingIds) === sortedToppingIdsKey(toppingIds)
}

export function getCartItemSummary(cartItem: CartItem, lang: CartLang = "RU"): string {
  const { menuItem, selectedSize, selectedToppingIds, toppingsList } = cartItem

  let sizeLabel = ""
  if (selectedSize === "l") {
    sizeLabel = menuItem.size_l_label?.trim() || "33см"
  } else if (selectedSize === "s") {
    sizeLabel = menuItem.size_s_label?.trim() || "30см"
  }

  const names = selectedToppingIds
    .map((id) => {
      const t = toppingsList.find((x) => x.id === id)
      if (!t) return null
      return lang === "RO" ? t.name_ro : t.name_ru
    })
    .filter(Boolean) as string[]

  const toppingsPart = names.join(" + ")

  if (sizeLabel && toppingsPart) return `${sizeLabel} + ${toppingsPart}`
  if (sizeLabel) return sizeLabel
  return toppingsPart
}

/** Цена одной единицы позиции в банах (база + выбранные топпинги). */
export function getCartItemPrice(cartItem: CartItem): number {
  const { menuItem, selectedSize, selectedToppingIds, toppingsList } = cartItem

  let base = 0
  if (menuItem.has_sizes) {
    if (selectedSize === "l") base = menuItem.size_l_price ?? menuItem.price ?? 0
    else if (selectedSize === "s") base = menuItem.size_s_price ?? menuItem.price ?? 0
    else base = menuItem.price ?? 0
  } else {
    base = menuItem.price ?? 0
  }

  let toppingsSum = 0
  for (const id of selectedToppingIds) {
    const t = toppingsList.find((x) => x.id === id)
    if (t) toppingsSum += t.price
  }
  return base + toppingsSum
}
