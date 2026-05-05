import type { BrandConfig } from "@/brands/index"

/** Бренд для шага POS «Бренд»: конфиг витрины + UUID из БД после загрузки каталога. */
export type PosWizardBrandOption = BrandConfig & {
  dbId: string | null
}

export type PosOrderStatus =
  | "draft"
  | "new"
  | "in_progress"
  | "delivering"
  | "done"
  | "cancelled"
  | "rejected"

export type PosOrderSource = "website" | "pos"

/** Позиция корзины POS (цена за единицу в бани, с учётом топпингов). */
export type PosCartItem = {
  menuItemId: string
  name: string
  /** Снимок для order_items.size: исторически `'s'`/`'l'`, либо подпись варианта */
  size: string | null
  variantId?: string | null
  price: number
  qty: number
  imageUrl?: string
  toppings: Array<{ id: string; name: string; price: number }>
  /** Строка `order_items`, если позиция уже сохранена в БД. */
  orderItemId?: string
}

export type PosOrder = {
  id: string
  order_number: number
  brand_id: string | null
  brand_slug: string
  operator_id: string | null
  source: PosOrderSource
  status: PosOrderStatus
  user_name: string | null
  user_phone: string | null
  delivery_mode: "delivery" | "pickup"
  delivery_address: string | null
  payment_method: "cash" | "card"
  change_from: number | null
  promo_code: string | null
  total: number
  delivery_fee: number
  discount: number
  comment: string | null
  created_at: string
  updated_at: string
  item_count: number
  cancel_reason: string | null
  address_entrance: string | null
  address_floor: string | null
  address_apartment: string | null
  address_intercom: string | null
}
