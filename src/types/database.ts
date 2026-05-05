export type Category = {
  id: string
  name_ru: string
  name_ro: string
  slug: string
  sort_order: number
  is_active: boolean
  created_at: string
  image_url: string | null
  show_in_upsell: boolean
}

export type MenuItemVariant = {
  id: string
  menu_item_id: string
  name_ru: string
  name_ro: string
  price: number
  weight_grams: number | null
  sort_order: number
  created_at: string
}

export type MenuItem = {
  id: string
  brand_id: string
  category_id: string
  name_ru: string
  name_ro: string
  description_ru: string | null
  description_ro: string | null
  image_url: string | null
  has_sizes: boolean
  /** Вес в граммах для позиции без размеров (has_sizes = false). */
  weight_grams: number | null
  price: number | null
  is_active: boolean
  sort_order: number
  created_at: string
  /** Процент скидки 1–90 или null */
  discount_percent: number | null
  /** Метка витрины: выгодно | новинка | хит | острое | веган | постное */
  tag: string | null
  /** Позиции, входящие в заказ (соусы, приборы и т.п.). */
  included_items?: { name_ru: string; name_ro: string }[] | null
  category?: Category
  variants?: MenuItemVariant[]
}

export type ToppingGroup = {
  id: string
  name_ru: string
  name_ro: string
  sort_order: number
  is_active: boolean
  created_at: string
  /** Максимум выбранных топпингов из группы; null — без лимита. */
  max_selections: number | null
}

export type Topping = {
  id: string
  group_id: string
  name_ru: string
  name_ro: string
  price: number
  image_url: string | null
  is_active: boolean
  sort_order: number
  created_at: string
}

export type MenuItemToppingGroup = {
  id: string
  menu_item_id: string
  topping_group_id: string
}

/** Строка таблицы `promotions`. */
export type Promotion = {
  id: string
  image_url_ru: string | null
  image_url_ro: string | null
  sort_order: number
  is_active: boolean
  created_at: string
}

/** Данные баннера для витрины (язык выбирает изображение). */
export type StorefrontPromotion = {
  id: string
  image_url_ru: string | null
  image_url_ro: string | null
}

/** Категория меню с позициями для витрины (только непустые). */
export type CategoryWithItems = {
  category: Category
  items: MenuItem[]
}

/** Строка карусели «Новое и популярное»: порядок хранится отдельно от меню. */
export type FeaturedMenuItem = {
  id: string
  brand_id: string
  menu_item_id: string
  sort_order: number
  created_at: string
}

export type FeaturedMenuItemWithItem = FeaturedMenuItem & {
  menu_item: MenuItem & {
    category: { id: string; name_ru: string; name_ro: string } | null
  }
}

/** Таблица `promo_codes`; `code` хранится в верхнем регистре. */
export type PromoCode = {
  id: string
  code: string
  discount_type: "percent" | "fixed"
  /** Процент (1–100) или сумма скидки в бани при `fixed`. */
  discount_value: number
  min_order_bani: number | null
  max_uses: number | null
  uses_count: number
  valid_from: string | null
  valid_until: string | null
  is_active: boolean
  description: string | null
  created_at: string
}

export type PromoCodeValidationError =
  | "not_found"
  | "inactive"
  | "expired"
  | "not_started"
  | "limit_reached"
  | "min_order_not_met"

export type PromoCodeValidationResult =
  | { valid: true; promo: PromoCode }
  | {
      valid: false
      error: PromoCodeValidationError
      /** Заполнено при `min_order_not_met`. */
      min_order_bani?: number
    }

/** Таблица `delivery_zones`; `polygon` — JSON массив пар [lat, lng]. */
export type DeliveryZone = {
  id: string
  name: string
  color: string
  polygon: [number, number][]
  delivery_price_bani: number
  min_order_bani: number
  free_delivery_from_bani: number | null
  delivery_time_min: number
  is_active: boolean
  sort_order: number
  created_at: string
}

export type DeliveryZoneCheckResult = {
  zone: DeliveryZone | null
  lat: number
  lng: number
}

export type OrderStatus =
  | "draft"
  | "new"
  | "confirmed"
  | "cooking"
  | "ready"
  | "in_progress"
  | "delivering"
  | "done"
  | "cancelled"
  | "rejected"

export type DeliveryMode = "delivery" | "pickup"

export type PaymentMethod = "cash" | "card"

export interface Order {
  id: string
  order_number: number
  user_name: string | null
  user_phone: string | null
  status: OrderStatus
  delivery_mode: DeliveryMode
  delivery_address: string | null
  payment_method: PaymentMethod
  change_from: number | null
  total: number
  delivery_fee: number
  discount: number
  promo_code: string | null
  scheduled_time: string | null
  comment: string | null
  tg_message_id: string | null
  created_at: string
  updated_at: string
  cancel_reason?: string | null
  address_entrance?: string | null
  address_floor?: string | null
  address_apartment?: string | null
  address_intercom?: string | null
}

export interface OrderItem {
  id: string
  order_id: string
  menu_item_id: string | null
  lunch_set_id: string | null
  variant_id: string | null
  item_name: string
  size: string | null
  quantity: number
  toppings: { name: string; price: number }[]
  price: number
}

export interface OrderWithItems extends Order {
  order_items: OrderItem[]
}
