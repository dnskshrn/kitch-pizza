import { cartToppingsConfigKey, migrateCartToppingsFromLegacy } from "@/lib/cart-toppings"
import {
  calcToppingChargesById,
  calcToppingGroupCharge,
} from "@/lib/topping-pricing"
import type { CartItem, CartSelectedSize, CartTopping } from "@/types/cart"
import type { MenuItem, Topping } from "@/types/database"
import { DEFAULT_LANG } from "@/lib/i18n/storefront"

export type CartLang = "RU" | "RO"

export type CartToppingDisplayLine = {
  toppingId: string
  name: string
  quantity: number
  chargeBani: number
}

export type CartToppingDisplayGroup = {
  groupId: string
  groupName: string | null
  isFullyFree: boolean
  lines: CartToppingDisplayLine[]
}

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
  cartToppings?: CartTopping[],
): boolean {
  if (a.menuItem.id !== menuItem.id) return false
  if (a.selectedSize !== selectedSize) return false
  if ((a.variantId ?? null) !== variantId) return false
  if (cartToppings) {
    return (
      cartToppingsConfigKey(migrateCartToppingsFromLegacy(a)) ===
      cartToppingsConfigKey(cartToppings)
    )
  }
  return sortedToppingIdsKey(a.selectedToppingIds) === sortedToppingIdsKey(toppingIds)
}

export function getCartItemSummary(cartItem: CartItem, lang: CartLang = DEFAULT_LANG): string {
  const {
    menuItem,
    selectedSize,
    variantNameSnapshot,
    selectedToppingIds,
    toppingsList,
    cartToppings,
  } = cartItem

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

  const resolvedToppings = migrateCartToppingsFromLegacy(cartItem)
  const names: string[] = []
  for (const t of resolvedToppings) {
    const label = lang === "RO" ? t.name_ro : t.name_ru
    for (let i = 0; i < t.quantity; i++) names.push(label)
  }
  if (names.length === 0) {
    for (const id of selectedToppingIds) {
      const t = toppingsList.find((x) => x.id === id)
      if (!t) continue
      names.push(lang === "RO" ? t.name_ro : t.name_ru)
    }
  }

  const toppingsPart = names.join(" + ")

  if (sizeLabel && toppingsPart) return `${sizeLabel} + ${toppingsPart}`
  if (sizeLabel) return sizeLabel
  return toppingsPart
}

function calcCartToppingsCharge(cartItem: CartItem): number {
  const toppings = migrateCartToppingsFromLegacy(cartItem)
  const freeCounts = cartItem.toppingGroupFreeCounts ?? {}
  const byGroup = new Map<
    string,
    { id: string; price: number; quantity: number }[]
  >()

  let sum = 0
  for (const t of toppings) {
    if (!t.topping_group_id) {
      sum += t.price * t.quantity
      continue
    }
    const list = byGroup.get(t.topping_group_id) ?? []
    list.push({ id: t.id, price: t.price, quantity: t.quantity })
    byGroup.set(t.topping_group_id, list)
  }

  for (const [groupId, selections] of byGroup) {
    sum += calcToppingGroupCharge(selections, freeCounts[groupId] ?? 0)
  }
  return sum
}

/** Цена одной единицы позиции в банах (база + выбранные топпинги). */
export function getCartItemPrice(cartItem: CartItem): number {
  const { menuItem, selectedSize, variantId } = cartItem

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

  const toppingsSum = calcCartToppingsCharge(cartItem)
  return base + toppingsSum
}

export function getCartItemSizeLabel(
  cartItem: CartItem,
  lang: CartLang = DEFAULT_LANG,
): string {
  const { menuItem, selectedSize, variantNameSnapshot } = cartItem

  if (variantNameSnapshot?.trim()) {
    return variantNameSnapshot.trim()
  }
  if (selectedSize === "l") {
    const variants = menuItem.variants
    if (variants?.length && variants.length >= 2) {
      const v = [...variants].sort((a, b) => a.sort_order - b.sort_order)[1]
      return lang === "RO"
        ? v.name_ro?.trim() || v.name_ru.trim()
        : v.name_ru.trim() || v.name_ro?.trim()
    }
    return "33см"
  }
  if (selectedSize === "s") {
    const variants = menuItem.variants
    if (variants?.length) {
      const v = [...variants].sort((a, b) => a.sort_order - b.sort_order)[0]!
      return lang === "RO"
        ? v.name_ro?.trim() || v.name_ru.trim()
        : v.name_ru.trim() || v.name_ro?.trim()
    }
    return "30см"
  }
  return ""
}

export function getCartItemToppingDisplayGroups(
  cartItem: CartItem,
  lang: CartLang = DEFAULT_LANG,
): CartToppingDisplayGroup[] {
  const toppings = migrateCartToppingsFromLegacy(cartItem)
  const freeCounts = cartItem.toppingGroupFreeCounts ?? {}
  const labels = cartItem.toppingGroupLabels ?? {}
  const byGroup = new Map<string, CartTopping[]>()
  const ungrouped: CartTopping[] = []

  for (const t of toppings) {
    if (!t.topping_group_id) {
      ungrouped.push(t)
      continue
    }
    const list = byGroup.get(t.topping_group_id) ?? []
    list.push(t)
    byGroup.set(t.topping_group_id, list)
  }

  const groups: CartToppingDisplayGroup[] = []

  for (const [groupId, groupToppings] of byGroup) {
    const selections = groupToppings.map((t) => ({
      id: t.id,
      price: t.price,
      quantity: t.quantity,
    }))
    const freeCount = freeCounts[groupId] ?? 0
    const charges = calcToppingChargesById(selections, freeCount)
    const groupCharge = calcToppingGroupCharge(selections, freeCount)
    const label = labels[groupId]
    const groupName = label
      ? lang === "RO"
        ? label.name_ro.trim() || label.name_ru.trim()
        : label.name_ru.trim() || label.name_ro.trim()
      : null

    groups.push({
      groupId,
      groupName,
      isFullyFree:
        groupCharge === 0 &&
        selections.reduce((sum, t) => sum + t.quantity, 0) > 0,
      lines: groupToppings.map((t) => ({
        toppingId: t.id,
        name: lang === "RO" ? t.name_ro : t.name_ru,
        quantity: t.quantity,
        chargeBani: charges.get(t.id) ?? 0,
      })),
    })
  }

  if (ungrouped.length > 0) {
    groups.push({
      groupId: "",
      groupName: null,
      isFullyFree: false,
      lines: ungrouped.map((t) => ({
        toppingId: t.id,
        name: lang === "RO" ? t.name_ro : t.name_ru,
        quantity: t.quantity,
        chargeBani: t.price * t.quantity,
      })),
    })
  }

  return groups
}

export function computeCartGoodsSubtotalBani(items: CartItem[]): number {
  return items.reduce((s, i) => s + getCartItemPrice(i) * i.quantity, 0)
}
