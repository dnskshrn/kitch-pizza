import type { MenuItem, Topping } from "@/types/database"

export type CartSelectedSize = "l" | "s" | null

/** Топпинг в строке корзины (с количеством). */
export type CartTopping = {
  id: string
  name_ru: string
  name_ro: string
  price: number
  quantity: number
  topping_group_id: string
}

export type CartItem = {
  id: string
  menuItem: MenuItem
  selectedSize: CartSelectedSize
  /** UUID варианта; для старых записей корзины может быть null при selectedSize s/l */
  variantId: string | null
  /** Локализованное имя варианта для order_items.size (текст); null — без имени или legacy s/l */
  variantNameSnapshot: string | null
  cartToppings: CartTopping[]
  /** free_count по topping_group_id (из menu_item_topping_groups). */
  toppingGroupFreeCounts: Record<string, number>
  /** Подписи групп топпингов для отображения в корзине. */
  toppingGroupLabels: Record<string, { name_ru: string; name_ro: string }>
  /** Плоский список id для UI (шаг 2); синхронизируется с `cartToppings`. */
  selectedToppingIds: string[]
  /** Справочник топпингов строки для модалки/лейблов. */
  toppingsList: Topping[]
  quantity: number
}
