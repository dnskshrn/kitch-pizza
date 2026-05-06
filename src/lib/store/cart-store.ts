import { validatePromoCode } from "@/lib/actions/validate-promo-code"
import {
  computeCartGoodsSubtotalBani,
  isSameCartConfiguration,
} from "@/lib/cart-helpers"
import { calcPromoDiscount } from "@/lib/discount"
import { useDeliveryStore } from "@/lib/store/delivery-store"
import type {
  CartItem,
  CartSelectedSize,
  CondimentLineMeta,
} from "@/types/cart"
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

  return true
}

type CartState = {
  items: CartItem[]
  condimentQuantities: Record<string, number>
  condimentsMeta: Record<string, CondimentLineMeta>
  /**
   * Увеличивается при добавлении товара/кол-ва/кондимента — для анимации кнопки корзины.
   * Не персистится (см. `partialize`).
   */
  cartButtonPulseKey: number
  /** Время последнего сохранения корзины в persist (для срока годности). */
  savedAt: number
  isOpen: boolean
  appliedPromo: PromoCode | null
  promoError: PromoErrorState | null
  promoLoading: boolean
  setCondimentQty: (id: string, qty: number) => void
  mergeCondimentsMeta: (
    rows: Array<{ id: string } & CondimentLineMeta>,
  ) => void
  applyCondimentDefaults: (
    defaults: Array<{ id: string; condiment_default_qty?: number | null }>,
  ) => void
  addItem: (
    menuItem: MenuItem,
    selectedSize: CartSelectedSize,
    toppingIds: string[],
    toppingsList: Topping[],
    lineMeta?: {
      variantId?: string | null
      variantNameSnapshot?: string | null
    },
  ) => void
  removeItem: (cartItemId: string) => void
  updateQuantity: (cartItemId: string, delta: 1 | -1) => void
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
  condimentQuantities: Record<string, number>,
  condimentsMeta: Record<string, CondimentLineMeta>,
): Partial<Pick<CartState, "appliedPromo" | "promoError">> | null {
  const p = appliedPromo
  if (!p?.min_order_bani) return null
  const subtotal = computeCartGoodsSubtotalBani(
    items,
    condimentQuantities,
    condimentsMeta,
  )
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
      condimentQuantities: {},
      condimentsMeta: {},
      cartButtonPulseKey: 0,
      savedAt: Date.now(),
      isOpen: false,
      appliedPromo: null,
      promoError: null,
      promoLoading: false,

      setCondimentQty: (id, qty) =>
        set((s) => {
          const q = Math.max(0, Math.floor(Number(qty)) || 0)
          const prev = s.condimentQuantities[id] ?? 0
          const nextQty = { ...s.condimentQuantities, [id]: q }
          const patch = ensurePromoMinOrder(
            s.appliedPromo,
            s.items,
            nextQty,
            s.condimentsMeta,
          )
          return {
            ...touchSavedAt(),
            condimentQuantities: nextQty,
            cartButtonPulseKey:
              q > prev ? s.cartButtonPulseKey + 1 : s.cartButtonPulseKey,
            ...patch,
          }
        }),

      mergeCondimentsMeta: (rows) =>
        set((s) => {
          const next = { ...s.condimentsMeta }
          for (const r of rows) {
            next[r.id] = {
              name_ru: r.name_ru,
              name_ro: r.name_ro,
              price: r.price,
            }
          }
          return { ...touchSavedAt(), condimentsMeta: next }
        }),

      applyCondimentDefaults: (defaults) =>
        set((s) => {
          const next = { ...s.condimentQuantities }
          for (const row of defaults) {
            if (next[row.id] !== undefined) continue
            const raw = row.condiment_default_qty ?? 0
            const q = Math.max(0, Math.floor(Number(raw)))
            next[row.id] = Number.isFinite(q) ? q : 0
          }
          const patch = ensurePromoMinOrder(
            s.appliedPromo,
            s.items,
            next,
            s.condimentsMeta,
          )
          return {
            ...touchSavedAt(),
            condimentQuantities: next,
            ...patch,
          }
        }),

      applyPromo: async (code) => {
        set({ promoLoading: true, promoError: null })
        const st = get()
        const subtotal = computeCartGoodsSubtotalBani(
          st.items,
          st.condimentQuantities,
          st.condimentsMeta,
        )
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
          const existing = state.items.find((entry) =>
            isSameCartConfiguration(
              entry,
              menuItem,
              selectedSize,
              variantId,
              toppingIds,
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
            const next: CartItem = {
              id,
              menuItem,
              selectedSize,
              variantId,
              variantNameSnapshot,
              selectedToppingIds: [...toppingIds],
              toppingsList: [...toppingsList],
              quantity: 1,
            }
            newItems = [...state.items, next]
          }
          const patch = ensurePromoMinOrder(
            state.appliedPromo,
            newItems,
            state.condimentQuantities,
            state.condimentsMeta,
          )
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
          const patch = ensurePromoMinOrder(
            state.appliedPromo,
            newItems,
            state.condimentQuantities,
            state.condimentsMeta,
          )
          return {
            ...touchSavedAt(),
            items: newItems,
            ...patch,
          }
        }),

      updateQuantity: (cartItemId, delta) => {
        const state = get()
        const item = state.items.find((i) => i.id === cartItemId)
        if (!item) return
        const nextQty = item.quantity + delta
        if (nextQty <= 0) {
          get().removeItem(cartItemId)
          return
        }
        set((s) => {
          const newItems = s.items.map((i) =>
            i.id === cartItemId ? { ...i, quantity: nextQty } : i,
          )
          const patch = ensurePromoMinOrder(
            s.appliedPromo,
            newItems,
            s.condimentQuantities,
            s.condimentsMeta,
          )
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
        condimentQuantities: state.condimentQuantities,
        condimentsMeta: state.condimentsMeta,
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
            condimentQuantities: {},
            condimentsMeta: {},
          })
          return
        }

        const cleaned = items
          .filter(isValidCartItem)
          .map((ci) => ({
            ...ci,
            variantId: ci.variantId ?? null,
            variantNameSnapshot: ci.variantNameSnapshot ?? null,
          }))
        if (
          cleaned.length !== items.length ||
          items.some(
            (raw, i) =>
              (raw.variantId ?? null) !== (cleaned[i]?.variantId ?? null) ||
              (raw.variantNameSnapshot ?? null) !==
                (cleaned[i]?.variantNameSnapshot ?? null),
          )
        ) {
          useCartStore.setState({
            items: cleaned,
            savedAt,
          })
        }
      },
    },
  ),
)

export function selectCartItemCount(state: CartState): number {
  return state.items.reduce((sum, i) => sum + i.quantity, 0)
}

export function selectCartSubtotal(state: CartState): number {
  return computeCartGoodsSubtotalBani(
    state.items,
    state.condimentQuantities,
    state.condimentsMeta,
  )
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
