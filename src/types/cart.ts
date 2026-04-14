import type { MenuItem, Topping } from "@/types/database"

export type CartSelectedSize = "l" | "s" | null

export type CartItem = {
  id: string
  menuItem: MenuItem
  selectedSize: CartSelectedSize
  selectedToppingIds: string[]
  toppingsList: Topping[]
  quantity: number
}
