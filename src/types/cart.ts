import type { MenuItem, Topping } from "@/types/database"

/** Снимок строки кондимента для корзины и заказа (имена + цена за ед., бани). */
export type CondimentLineMeta = {
  name_ru: string
  name_ro: string
  price: number
}

export type CartSelectedSize = "l" | "s" | null

export type CartItem = {
  id: string
  menuItem: MenuItem
  selectedSize: CartSelectedSize
  selectedToppingIds: string[]
  toppingsList: Topping[]
  quantity: number
}
