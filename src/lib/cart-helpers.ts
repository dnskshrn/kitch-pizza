import type {
  CartItem,
  CartSelectedSize,
  CondimentLineMeta,
} from "@/types/cart"
import type { MenuItem } from "@/types/database"
import { DEFAULT_LANG } from "@/lib/i18n/storefront"

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

export function getCartItemSummary(cartItem: CartItem, lang: CartLang = DEFAULT_LANG): string {
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

export function computeCondimentsSubtotalBani(
  quantities: Record<string, number>,
  meta: Record<string, CondimentLineMeta>,
): number {
  let sum = 0
  for (const [id, qty] of Object.entries(quantities)) {
    if (qty <= 0) continue
    sum += (meta[id]?.price ?? 0) * qty
  }
  return sum
}

export function computeCartGoodsSubtotalBani(
  items: CartItem[],
  condimentQuantities: Record<string, number>,
  condimentsMeta: Record<string, CondimentLineMeta>,
): number {
  const itemsSum = items.reduce(
    (s, i) => s + getCartItemPrice(i) * i.quantity,
    0,
  )
  return itemsSum + computeCondimentsSubtotalBani(condimentQuantities, condimentsMeta)
}

export function buildCondimentOrderLines(
  quantities: Record<string, number>,
  meta: Record<string, CondimentLineMeta>,
  lang: CartLang,
): Array<{
  menu_item_id: string
  item_name: string
  quantity: number
  price: number
}> {
  const out: Array<{
    menu_item_id: string
    item_name: string
    quantity: number
    price: number
  }> = []
  for (const [id, qty] of Object.entries(quantities)) {
    if (qty <= 0) continue
    const m = meta[id]
    if (!m) continue
    out.push({
      menu_item_id: id,
      item_name: lang === "RO" ? m.name_ro : m.name_ru,
      quantity: qty,
      price: m.price * qty,
    })
  }
  return out
}
