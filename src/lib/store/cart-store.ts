import { validatePromoCode } from "@/lib/actions/validate-promo-code"
import {
  buildCartToppingsFromSelection,
  cartToppingFromTopping,
  getTotalQuantityInGroup,
  migrateCartToppingsFromLegacy,
  syncCartItemToppingFields,
} from "@/lib/cart-toppings"
import {
  computeCartGoodsSubtotalBani,
  isSameCartConfiguration,
} from "@/lib/cart-helpers"
import { calcPromoDiscount } from "@/lib/discount"
import { useDeliveryStore } from "@/lib/store/delivery-store"
import type { CartItem, CartSelectedSize, CartTopping } from "@/types/cart"
import type { MenuItem, PromoCode, Topping } from "@/types/database"
import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

export const CART_STORAGE_KEY = "kitch-cart"

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

export type PromoErrorState =
  | { code: "not_found" }
  | { code: "inactive" }
  | { code: "expired" }
  | { code: "not_started" }
  | { code: "limit_reached" }
  | { code: "min_order_not_met"; minOrderBani: number }
  | { code: "unknown" }
  | { code: "check_failed" }

/** Минимальная проверка структуры после JSON; битые строки отбрасываются при гидратации. */
function isValidCartItem(raw: unknown): raw is CartItem {
  if (!raw || typeof raw !== "object") return false
  const o = raw as Record<string, unknown>
  if (typeof o.id !== "string" || o.id.length === 0) return false
  if (typeof o.quantity !== "number" || !Number.isInteger(o.quantity) || o.quantity < 1) {
    return false
  }

  const sz = o.selectedSize
  if (sz !== null && sz !== "l" && sz !== "s") return false

  const vid = o.variantId
  if (vid != null && typeof vid !== "string") return false
  const vn = o.variantNameSnapshot
  if (vn != null && typeof vn !== "string") return false

  if (!Array.isArray(o.selectedToppingIds)) return false
  if (!o.selectedToppingIds.every((id) => typeof id === "string")) return false

  if (!Array.isArray(o.toppingsList)) return false

  const mi = o.menuItem
  if (!mi || typeof mi !== "object") return false
  const m = mi as Record<string, unknown>
  if (typeof m.id !== "string" || m.id.length === 0) return false
  if (typeof m.category_id !== "string") return false
  if (typeof m.has_sizes !== "boolean") return false
  if (typeof m.name_ru !== "string" || typeof m.name_ro !== "string") return false

  for (const t of o.toppingsList) {
    if (!t || typeof t !== "object") return false
    const tp = t as Record<string, unknown>
    if (typeof tp.id !== "string") return false
    if (typeof tp.price !== "number" || !Number.isFinite(tp.price)) return false
  }

  const rawCartToppings = o.cartToppings
  if (rawCartToppings !== undefined) {
    if (!Array.isArray(rawCartToppings)) return false
    for (const t of rawCartToppings) {
      if (!t || typeof t !== "object") return false
      const ct = t as Record<string, unknown>
      if (typeof ct.id !== "string") return false
      if (typeof ct.name_ru !== "string" || typeof ct.name_ro !== "string") {
        return false
      }
      if (typeof ct.price !== "number" || !Number.isFinite(ct.price)) return false
      if (
        typeof ct.quantity !== "number" ||
        !Number.isInteger(ct.quantity) ||
        ct.quantity < 1
      ) {
        return false
      }
      if (ct.topping_group_id != null && typeof ct.topping_group_id !== "string") {
        return false
      }
    }
  }

  const rawFreeCounts = o.toppingGroupFreeCounts
  if (rawFreeCounts !== undefined) {
    if (!rawFreeCounts || typeof rawFreeCounts !== "object") return false
    for (const v of Object.values(rawFreeCounts as Record<string, unknown>)) {
      if (typeof v !== "number" || !Number.isFinite(v) || v < 0) return false
    }
  }

  const rawLabels = o.toppingGroupLabels
  if (rawLabels !== undefined) {
    if (!rawLabels || typeof rawLabels !== "object") return false
    for (const v of Object.values(rawLabels as Record<string, unknown>)) {
      if (!v || typeof v !== "object") return false
      const l = v as Record<string, unknown>
      if (typeof l.name_ru !== "string" || typeof l.name_ro !== "string") {
        return false
      }
    }
  }

  return true
}

function normalizeCartItem(raw: CartItem): CartItem {
  const cartToppings = migrateCartToppingsFromLegacy(raw)
  return syncCartItemToppingFields({
    ...raw,
    cartToppings,
    toppingGroupFreeCounts: raw.toppingGroupFreeCounts ?? {},
    toppingGroupLabels: raw.toppingGroupLabels ?? {},
    variantId: raw.variantId ?? null,
    variantNameSnapshot: raw.variantNameSnapshot ?? null,
  })
}

type CartState = {
  items: CartItem[]
  /**
   * Увеличивается при добавлении товара/кол-ва — для анимации кнопки корзины.
   * Не персистится (см. `partialize`).
   */
  cartButtonPulseKey: number
  /** Время последнего сохранения корзины в persist (для срока годности). */
  savedAt: number
  isOpen: boolean
  appliedPromo: PromoCode | null
  promoError: PromoErrorState | null
  promoLoading: boolean
  addItem: (
    menuItem: MenuItem,
    selectedSize: CartSelectedSize,
    toppingIds: string[],
    toppingsList: Topping[],
    lineMeta?: {
      variantId?: string | null
      variantNameSnapshot?: string | null
      toppingGroupFreeCounts?: Record<string, number>
      toppingGroupLabels?: Record<string, { name_ru: string; name_ro: string }>
    },
  ) => void
  removeItem: (cartItemId: string) => void
  updateQuantity: (cartItemId: string, delta: 1 | -1) => void
  addTopping: (
    itemId: string,
    topping: Omit<CartTopping, "quantity">,
    groupToppingIds: readonly string[],
    groupMaxSelections: number | null,
  ) => void
  removeTopping: (itemId: string, toppingId: string) => void
  applyPromo: (code: string) => Promise<void>
  removePromo: () => void
  openCart: () => void
  closeCart: () => void
}

function promoErrorState(
  result: Extract<Awaited<ReturnType<typeof validatePromoCode>>, { valid: false }>,
): PromoErrorState {
  switch (result.error) {
    case "not_found":
      return { code: "not_found" }
    case "inactive":
      return { code: "inactive" }
    case "expired":
      return { code: "expired" }
    case "not_started":
      return { code: "not_started" }
    case "limit_reached":
      return { code: "limit_reached" }
    case "min_order_not_met": {
      const min = result.min_order_bani ?? 0
      return { code: "min_order_not_met", minOrderBani: min }
    }
    default:
      return { code: "unknown" }
  }
}

/** Сброс промокода, если сумма корзины ниже минимума для применённого кода. */
function ensurePromoMinOrder(
  appliedPromo: PromoCode | null,
  items: CartItem[],
): Partial<Pick<CartState, "appliedPromo" | "promoError">> | null {
  const p = appliedPromo
  if (!p?.min_order_bani) return null
  const subtotal = computeCartGoodsSubtotalBani(items)
  if (subtotal < p.min_order_bani) {
    return {
      appliedPromo: null,
      promoError: { code: "min_order_not_met", minOrderBani: p.min_order_bani },
    }
  }
  return null
}

const touchSavedAt = (): Pick<CartState, "savedAt"> => ({
  savedAt: Date.now(),
})

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      cartButtonPulseKey: 0,
      savedAt: Date.now(),
      isOpen: false,
      appliedPromo: null,
      promoError: null,
      promoLoading: false,

      applyPromo: async (code) => {
        set({ promoLoading: true, promoError: null })
        const st = get()
        const subtotal = computeCartGoodsSubtotalBani(st.items)
        try {
          const result = await validatePromoCode(code, subtotal)
          if (result.valid) {
            set({
              appliedPromo: result.promo,
              promoError: null,
              promoLoading: false,
            })
            return
          }
          set({
            appliedPromo: null,
            promoError: promoErrorState(result),
            promoLoading: false,
          })
        } catch (e) {
          console.error(e)
          set({
            promoLoading: false,
            promoError: { code: "check_failed" },
          })
        }
      },

      removePromo: () => set({ appliedPromo: null, promoError: null }),

      addItem: (menuItem, selectedSize, toppingIds, toppingsList, lineMeta) => {
        set((state) => {
          const variantId =
            lineMeta?.variantId === undefined ? null : lineMeta.variantId
          const variantNameSnapshot =
            lineMeta?.variantNameSnapshot === undefined
              ? null
              : lineMeta.variantNameSnapshot
          const cartToppings = buildCartToppingsFromSelection(
            toppingIds,
            toppingsList,
          )
          const existing = state.items.find((entry) =>
            isSameCartConfiguration(
              entry,
              menuItem,
              selectedSize,
              variantId,
              toppingIds,
              cartToppings,
            ),
          )
          let newItems: CartItem[]
          if (existing) {
            newItems = state.items.map((entry) =>
              entry.id === existing.id
                ? { ...entry, quantity: entry.quantity + 1 }
                : entry,
            )
          } else {
            const id =
              typeof crypto !== "undefined" && crypto.randomUUID
                ? crypto.randomUUID()
                : `cart-${Date.now()}-${Math.random().toString(36).slice(2)}`
            const next = syncCartItemToppingFields({
              id,
              menuItem,
              selectedSize,
              variantId,
              variantNameSnapshot,
              cartToppings,
              toppingsList: [...toppingsList],
              toppingGroupFreeCounts: lineMeta?.toppingGroupFreeCounts ?? {},
              toppingGroupLabels: lineMeta?.toppingGroupLabels ?? {},
              quantity: 1,
            })
            newItems = [...state.items, next]
          }
          const patch = ensurePromoMinOrder(state.appliedPromo, newItems)
          return {
            ...touchSavedAt(),
            items: newItems,
            cartButtonPulseKey: state.cartButtonPulseKey + 1,
            ...patch,
          }
        })
      },

      removeItem: (cartItemId) =>
        set((state) => {
          const newItems = state.items.filter((i) => i.id !== cartItemId)
          const patch = ensurePromoMinOrder(state.appliedPromo, newItems)
          return {
            ...touchSavedAt(),
            items: newItems,
            ...patch,
          }
        }),

      addTopping: (itemId, topping, groupToppingIds, groupMaxSelections) => {
        set((state) => {
          const newItems = state.items.map((item) => {
            if (item.id !== itemId) return item

            const totalInGroup = getTotalQuantityInGroup(
              item.cartToppings,
              groupToppingIds,
            )
            if (
              groupMaxSelections != null &&
              totalInGroup >= groupMaxSelections
            ) {
              return item
            }

            const existing = item.cartToppings.find((t) => t.id === topping.id)
            const cartToppings = existing
              ? item.cartToppings.map((t) =>
                  t.id === topping.id
                    ? { ...t, quantity: t.quantity + 1 }
                    : t,
                )
              : [
                  ...item.cartToppings,
                  { ...cartToppingFromTopping(topping), quantity: 1 },
                ]

            const toppingsList = item.toppingsList.some((t) => t.id === topping.id)
              ? item.toppingsList
              : [
                  ...item.toppingsList,
                  {
                    id: topping.id,
                    group_id: topping.topping_group_id,
                    name_ru: topping.name_ru,
                    name_ro: topping.name_ro,
                    price: topping.price,
                    image_url: null,
                    is_active: true,
                    sort_order: 0,
                    created_at: "",
                  },
                ]

            return syncCartItemToppingFields({
              ...item,
              cartToppings,
              toppingsList,
            })
          })
          const patch = ensurePromoMinOrder(state.appliedPromo, newItems)
          return { ...touchSavedAt(), items: newItems, ...patch }
        })
      },

      removeTopping: (itemId, toppingId) => {
        set((state) => {
          const newItems = state.items.map((item) => {
            if (item.id !== itemId) return item
            const existing = item.cartToppings.find((t) => t.id === toppingId)
            if (!existing) return item

            const cartToppings =
              existing.quantity > 1
                ? item.cartToppings.map((t) =>
                    t.id === toppingId
                      ? { ...t, quantity: t.quantity - 1 }
                      : t,
                  )
                : item.cartToppings.filter((t) => t.id !== toppingId)

            return syncCartItemToppingFields({ ...item, cartToppings })
          })
          const patch = ensurePromoMinOrder(state.appliedPromo, newItems)
          return { ...touchSavedAt(), items: newItems, ...patch }
        })
      },

      updateQuantity: (cartItemId, delta) => {
        set((s) => {
          const item = s.items.find((i) => i.id === cartItemId)
          if (!item) return s

          const nextQty = item.quantity + delta
          const newItems =
            nextQty <= 0
              ? s.items.filter((i) => i.id !== cartItemId)
              : s.items.map((i) =>
                  i.id === cartItemId ? { ...i, quantity: nextQty } : i,
                )
          const patch = ensurePromoMinOrder(s.appliedPromo, newItems)
          return {
            ...touchSavedAt(),
            items: newItems,
            cartButtonPulseKey:
              delta === 1
                ? s.cartButtonPulseKey + 1
                : s.cartButtonPulseKey,
            ...patch,
          }
        })
      },

      openCart: () => set({ isOpen: true }),
      closeCart: () => set({ isOpen: false }),
    }),
    {
      name: CART_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        items: state.items,
        savedAt: state.savedAt,
      }),
      onRehydrateStorage: () => (state, error) => {
        if (error) return
        if (state === undefined) return

        const savedAt = state.savedAt
        const items = state.items ?? []

        const expired =
          typeof savedAt !== "number" ||
          !Number.isFinite(savedAt) ||
          Date.now() - savedAt > SEVEN_DAYS_MS

        if (expired) {
          useCartStore.setState({
            items: [],
            savedAt: Date.now(),
          })
          return
        }

        const cleaned = items
          .filter(isValidCartItem)
          .map((ci) => normalizeCartItem(ci))
        useCartStore.setState({
          items: cleaned,
          savedAt,
        })
      },
    },
  ),
)

export function selectCartItemCount(state: CartState): number {
  return state.items.reduce((sum, i) => sum + i.quantity, 0)
}

export function selectCartSubtotal(state: CartState): number {
  return computeCartGoodsSubtotalBani(state.items)
}

export function selectCartDiscount(state: CartState): number {
  if (!state.appliedPromo) return 0
  const subtotal = selectCartSubtotal(state)
  return calcPromoDiscount(state.appliedPromo, subtotal)
}

export function selectCartTotal(state: CartState): number {
  const subtotal = selectCartSubtotal(state)
  const discount = selectCartDiscount(state)
  return Math.max(0, subtotal - discount)
}

/** Товары минус промо + доставка (из `delivery-store`). */
export function getCartGrandTotalBani(): number {
  const cart = useCartStore.getState()
  const subtotal = selectCartSubtotal(cart)
  const goods = Math.max(0, subtotal - selectCartDiscount(cart))
  const fee = useDeliveryStore.getState().getDeliveryFeeBani(subtotal)
  return goods + fee
}
