import { create } from "zustand"
import type { MenuItem } from "@/types/database"
import type { CartSelectedSize } from "@/types/cart"

export type ProductModalOpenOptions = {
  editingCartItemId?: string | null
  initialSize?: CartSelectedSize
  initialVariantId?: string | null
  initialToppingIds?: string[]
}

type ProductModalState = {
  item: MenuItem | null
  isOpen: boolean
  editingCartItemId: string | null
  initialSize: CartSelectedSize | undefined
  initialVariantId: string | null | undefined
  initialToppingIds: string[] | undefined
  /** После «В корзину» при редактировании из корзины — на мобилке снова открыть корзину */
  returnToCart: boolean
  open: (item: MenuItem, options?: ProductModalOpenOptions) => void
  openForEdit: (
    item: MenuItem,
    initialSize: CartSelectedSize | undefined,
    initialToppingIds: string[],
    cartItemId: string,
    initialVariantId?: string | null,
  ) => void
  close: () => void
}

export const useProductModalStore = create<ProductModalState>((set) => ({
  item: null,
  isOpen: false,
  editingCartItemId: null,
  initialSize: undefined,
  initialVariantId: undefined,
  initialToppingIds: undefined,
  returnToCart: false,
  open: (item, options) =>
    set({
      item,
      isOpen: true,
      editingCartItemId: options?.editingCartItemId ?? null,
      initialSize: options?.initialSize,
      initialVariantId: options?.initialVariantId,
      initialToppingIds: options?.initialToppingIds,
      returnToCart: false,
    }),
  openForEdit: (item, initialSize, initialToppingIds, cartItemId, initialVariantId) =>
    set({
      item,
      isOpen: true,
      editingCartItemId: cartItemId,
      initialSize,
      initialVariantId,
      initialToppingIds,
      returnToCart: true,
    }),
  close: () =>
    set({
      isOpen: false,
      item: null,
      editingCartItemId: null,
      initialSize: undefined,
      initialVariantId: undefined,
      initialToppingIds: undefined,
      returnToCart: false,
    }),
}))
