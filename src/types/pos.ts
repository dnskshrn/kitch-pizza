export type PosOrderStatus =
  | "new"
  | "in_progress"
  | "delivering"
  | "done"
  | "cancelled"

export type PosOrderSource = "website" | "pos"

/** Позиция корзины POS (цена за единицу в бани, с учётом топпингов). */
export type PosCartItem = {
  menuItemId: string
  name: string
  size: "s" | "l" | null
  price: number
  qty: number
  imageUrl?: string
  toppings: Array<{ id: string; name: string; price: number }>
}

export type PosOrder = {
  id: string
  order_number: number
  brand_id: string
  brand_slug: string
  operator_id: string | null
  source: PosOrderSource
  status: PosOrderStatus
  user_name: string | null
  user_phone: string
  delivery_mode: "delivery" | "pickup"
  delivery_address: string | null
  total: number
  delivery_fee: number
  discount: number
  comment: string | null
  created_at: string
  updated_at: string
  item_count: number
}
