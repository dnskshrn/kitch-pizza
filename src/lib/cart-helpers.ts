import type { CartItem, CartSelectedSize } from "@/types/cart"
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
  variantId: string | null,
  toppingIds: string[],
): boolean {
  if (a.menuItem.id !== menuItem.id) return false
  if (a.selectedSize !== selectedSize) return false
  if ((a.variantId ?? null) !== variantId) return false
  return sortedToppingIdsKey(a.selectedToppingIds) === sortedToppingIdsKey(toppingIds)
}

export function getCartItemSummary(cartItem: CartItem, lang: CartLang = DEFAULT_LANG): string {
  const { menuItem, selectedSize, variantNameSnapshot, selectedToppingIds, toppingsList } =
    cartItem

  let sizeLabel = ""
  if (variantNameSnapshot?.trim()) {
    sizeLabel = variantNameSnapshot.trim()
  } else if (selectedSize === "l") {
    const variants = menuItem.variants
    if (variants?.length && variants.length >= 2) {
      const v = [...variants].sort((a, b) => a.sort_order - b.sort_order)[1]
      sizeLabel =
        lang === "RO"
          ? v.name_ro?.trim() || v.name_ru.trim()
          : v.name_ru.trim() || v.name_ro?.trim()
    } else sizeLabel = "33см"
  } else if (selectedSize === "s") {
    const variants = menuItem.variants
    if (variants?.length) {
      const v = [...variants].sort((a, b) => a.sort_order - b.sort_order)[0]!
      sizeLabel =
        lang === "RO"
          ? v.name_ro?.trim() || v.name_ru.trim()
          : v.name_ru.trim() || v.name_ro?.trim()
    } else sizeLabel = "30см"
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
  const { menuItem, selectedSize, variantId, selectedToppingIds, toppingsList } =
    cartItem

  let base = 0
  if (menuItem.has_sizes) {
    const variants = menuItem.variants
    if (variantId && variants?.length) {
      const v = variants.find((x) => x.id === variantId)
      if (v) base = v.price
    }
    if (!base && variants?.length && (selectedSize === "s" || selectedSize === "l")) {
      const sorted = [...variants].sort((a, b) => a.sort_order - b.sort_order)
      const idx = selectedSize === "l" ? Math.min(1, sorted.length - 1) : 0
      base = sorted[idx]?.price ?? 0
    }
    if (!base) base = menuItem.price ?? 0
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

export function computeCartGoodsSubtotalBani(items: CartItem[]): number {
  return items.reduce((s, i) => s + getCartItemPrice(i) * i.quantity, 0)
}
