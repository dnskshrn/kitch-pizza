import type { BrandConfig } from "@/brands/index"

/** Бренд для шага POS «Бренд»: конфиг витрины + UUID из БД после загрузки каталога. */
export type PosWizardBrandOption = BrandConfig & {
  dbId: string | null
}

export type PosOrderStatus =
  | "draft"
  | "new"
  | "confirmed"
  | "cooking"
  | "ready"
  | "delivery"
  | "done"
  | "cancelled"
  | "rejected"

export type PosOrderSource = "website" | "pos"

/** Тип нового заказа в POS (шаг выбора перед мастером). */
export type OrderType = "pickup" | "delivery" | "aggregator"

/** Топпинг в строке корзины POS (совместим с витриной). */
export type PosCartTopping = {
  id: string
  name_ru: string
  name_ro: string
  price: number
  quantity: number
  topping_group_id: string
}

/** Позиция корзины POS (цена за единицу в бани, с учётом топпингов). */
export type PosCartItem = {
  menuItemId: string
  /** Категория меню (`menu_items.category_id`) — для правил скидок. */
  category_id: string
  name: string
  /** Снимок для order_items.size: исторически `'s'`/`'l'`, либо подпись варианта */
  size: string | null
  variantId?: string | null
  price: number
  qty: number
  imageUrl?: string
  toppings: PosCartTopping[]
  /** free_count по topping_group_id (из menu_item_topping_groups). */
  toppingGroupFreeCounts?: Record<string, number>
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
  delivery_mode: "delivery" | "pickup" | "aggregator"
  delivery_address: string | null
  payment_method: "cash" | "card" | "aggregator_card" | "mixed"
  change_from: number | null
  cash_amount: number | null
  card_amount: number | null
  promo_code: string | null
  total: number
  delivery_fee: number
  discount: number
  /** Пункты лояльности (1 п. ≈ 1 MDL списано с суммы перед сохранением `total`). */
  bonuses_redeemed: number
  comment: string | null
  /** Комментарий повара (только POS → кухня). */
  kitchen_note: string | null
  /** Предзаказ: `asap`, время `HH:MM` или ISO; для KDS см. `isKdsScheduledOrder` */
  scheduled_time: string | null
  created_at: string
  updated_at: string
  item_count: number
  cancel_reason: string | null
  address_entrance: string | null
  address_floor: string | null
  address_apartment: string | null
  address_intercom: string | null
  aggregator: "glovo" | null
  prep_deadline_at: string | null
  ready_at: string | null
  courier_id: string | null
  /** Имя из `staff` при непустом `courier_id`; подгружается в `fetchPosOrders`. */
  courier_name: string | null
  /** Профиль витрины (`orders.profile_id`); для заказов с сайта — до поиска по телефону. */
  profile_id: string | null
  /** FK к `cash_sessions.id`; заполняется при `payOrder`. */
  cash_session_id: string | null
}
