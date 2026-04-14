import { validatePromoCode } from "@/lib/actions/validate-promo-code"
import { getCartItemPrice, isSameCartConfiguration } from "@/lib/cart-helpers"
import { calcPromoDiscount } from "@/lib/discount"
import { useDeliveryStore } from "@/lib/store/delivery-store"
import type { CartItem, CartSelectedSize } from "@/types/cart"
import type { MenuItem, PromoCode, Topping } from "@/types/database"
import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

export const CART_STORAGE_KEY = "kitch-cart"

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

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
  /** Время последнего сохранения корзины в persist (для срока годности). */
  savedAt: number
  isOpen: boolean
  appliedPromo: PromoCode | null
  promoError: string | null
  promoLoading: boolean
  addItem: (
    menuItem: MenuItem,
    selectedSize: CartSelectedSize,
    toppingIds: string[],
    toppingsList: Topping[],
  ) => void
  removeItem: (cartItemId: string) => void
  updateQuantity: (cartItemId: string, delta: 1 | -1) => void
  applyPromo: (code: string) => Promise<void>
  removePromo: () => void
  openCart: () => void
  closeCart: () => void
}

function formatLei(bani: number): string {
  return (bani / 100).toLocaleString("ro-MD", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
}

function promoErrorMessage(
  result: Extract<Awaited<ReturnType<typeof validatePromoCode>>, { valid: false }>,
): string {
  switch (result.error) {
    case "not_found":
      return "Промокод не найден"
    case "inactive":
      return "Промокод недействителен"
    case "expired":
      return "Срок действия промокода истёк"
    case "not_started":
      return "Промокод ещё не активен"
    case "limit_reached":
      return "Промокод больше не действует"
    case "min_order_not_met": {
      const min = result.min_order_bani ?? 0
      return `Минимальная сумма заказа: ${formatLei(min)} лей`
    }
    default:
      return "Не удалось применить промокод"
  }
}

function promoMinOrderMessage(minBani: number): string {
  return `Минимальная сумма заказа: ${formatLei(minBani)} лей`
}

function computeCartSubtotal(items: CartItem[]): number {
  return items.reduce((sum, i) => sum + getCartItemPrice(i) * i.quantity, 0)
}

/** Сброс промокода, если сумма корзины ниже минимума для применённого кода. */
function ensurePromoMinOrder(
  appliedPromo: PromoCode | null,
  items: CartItem[],
): Partial<Pick<CartState, "appliedPromo" | "promoError">> | null {
  const p = appliedPromo
  if (!p?.min_order_bani) return null
  const subtotal = computeCartSubtotal(items)
  if (subtotal < p.min_order_bani) {
    return {
      appliedPromo: null,
      promoError: promoMinOrderMessage(p.min_order_bani),
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
      savedAt: Date.now(),
      isOpen: false,
      appliedPromo: null,
      promoError: null,
      promoLoading: false,

      applyPromo: async (code) => {
        set({ promoLoading: true, promoError: null })
        const subtotal = computeCartSubtotal(get().items)
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
            promoError: promoErrorMessage(result),
            promoLoading: false,
          })
        } catch (e) {
          console.error(e)
          set({
            promoLoading: false,
            promoError: "Не удалось проверить промокод",
          })
        }
      },

      removePromo: () => set({ appliedPromo: null, promoError: null }),

      addItem: (menuItem, selectedSize, toppingIds, toppingsList) => {
        set((state) => {
          const existing = state.items.find((entry) =>
            isSameCartConfiguration(entry, menuItem, selectedSize, toppingIds),
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
              selectedToppingIds: [...toppingIds],
              toppingsList: [...toppingsList],
              quantity: 1,
            }
            newItems = [...state.items, next]
          }
          const patch = ensurePromoMinOrder(state.appliedPromo, newItems)
          return {
            ...touchSavedAt(),
            items: newItems,
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
          const patch = ensurePromoMinOrder(s.appliedPromo, newItems)
          return {
            ...touchSavedAt(),
            items: newItems,
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
          useCartStore.setState({ items: [], savedAt: Date.now() })
          return
        }

        const cleaned = items.filter(isValidCartItem)
        if (cleaned.length !== items.length) {
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
  return state.items.reduce(
    (sum, i) => sum + getCartItemPrice(i) * i.quantity,
    0,
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
