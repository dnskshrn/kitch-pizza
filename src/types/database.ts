// TODO: regenerate `src/lib/supabase/types.ts` via
// `npx supabase gen types typescript --project-id xioizekcyfmyxxklbvsd > src/lib/supabase/types.ts`
// (requires `supabase login` or SUPABASE_ACCESS_TOKEN; out of date for cash_sessions / cash_transactions / orders.cash_session_id)

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
  /** Позиции категории не участвуют в расчёте скидок (витрина / POS). */
  exclude_from_discounts?: boolean
}

export type MenuItemVariant = {
  id: string
  menu_item_id: string
  name_ru: string
  name_ro: string
  price: number
  /** Цена для агрегатора (Glovo и т.п.), бани; null = не задана. */
  aggregator_price_bani: number | null
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
  /** Цена для агрегатора (Glovo и т.п.), бани; null = не задана. */
  aggregator_price_bani: number | null
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
  /** Цена для агрегатора (Glovo и т.п.), бани; null = не задана. */
  aggregator_price_bani: number | null
  image_url: string | null
  is_active: boolean
  sort_order: number
  created_at: string
}

export type MenuItemToppingGroup = {
  id: string
  menu_item_id: string
  topping_group_id: string
  /** Сколько единиц топпингов из группы бесплатны для этой позиции меню. */
  free_count: number
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
  /** Ночная цена доставки (23:00–05:59, Europe/Chisinau); null — без переопределения */
  night_delivery_price_bani: number | null
  min_order_bani: number
  free_delivery_from_bani: number | null
  delivery_time_min: number
  is_active: boolean
  sort_order: number
  created_at: string
  /** "HH:MM" или null — начало окна доставки (Europe/Chisinau) */
  active_from: string | null
  /** "HH:MM" или null — конец окна доставки (Europe/Chisinau) */
  active_to: string | null
}

export type DeliveryZoneCheckResult = {
  zone: DeliveryZone | null
  lat: number
  lng: number
}

// delivery_zone_schedules
export interface DeliveryZoneSchedule {
  id: string
  zone_id: string
  from_time: string // "HH:MM:SS" from DB
  to_time: string // "HH:MM:SS" from DB
  delivery_time_min: number
  delivery_price_bani: number
  min_order_bani: number
  free_delivery_from_bani: number | null
  sort_order: number
  created_at: string | null
}

export type Database = {
  public: {
    Tables: {
      delivery_zones: {
        Row: DeliveryZone
        Insert: {
          id?: string
          name: string
          color: string
          polygon: [number, number][]
          delivery_price_bani: number
          night_delivery_price_bani?: number | null
          min_order_bani: number
          free_delivery_from_bani?: number | null
          delivery_time_min: number
          is_active?: boolean
          sort_order?: number
          created_at?: string
          active_from?: string | null
          active_to?: string | null
        }
        Update: {
          id?: string
          name?: string
          color?: string
          polygon?: [number, number][]
          delivery_price_bani?: number
          night_delivery_price_bani?: number | null
          min_order_bani?: number
          free_delivery_from_bani?: number | null
          delivery_time_min?: number
          is_active?: boolean
          sort_order?: number
          created_at?: string
          active_from?: string | null
          active_to?: string | null
        }
        Relationships: []
      }
      delivery_zone_schedules: {
        Row: DeliveryZoneSchedule
        Insert: {
          id?: string
          zone_id: string
          from_time: string
          to_time: string
          delivery_time_min: number
          delivery_price_bani: number
          min_order_bani: number
          free_delivery_from_bani?: number | null
          sort_order?: number
          created_at?: string | null
        }
        Update: {
          id?: string
          zone_id?: string
          from_time?: string
          to_time?: string
          delivery_time_min?: number
          delivery_price_bani?: number
          min_order_bani?: number
          free_delivery_from_bani?: number | null
          sort_order?: number
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_zone_schedules_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "delivery_zones"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

export type DeliveryZoneWithSchedules =
  Database["public"]["Tables"]["delivery_zones"]["Row"] & {
    schedules: DeliveryZoneSchedule[]
  }

export type OrderStatus =
  | "draft"
  | "new"
  | "confirmed"
  | "cooking"
  | "ready"
  | "delivery"
  | "done"
  | "cancelled"
  | "rejected"

export type DeliveryMode = "delivery" | "pickup" | "aggregator"

export type PaymentMethod =
  | "cash"
  | "card"
  | "aggregator_card"
  | "mixed"
  | "online_card"

export interface Order {
  id: string
  order_number: number
  brand_id: string | null
  operator_id: string | null
  profile_id?: string | null
  user_name: string | null
  user_phone: string | null
  status: OrderStatus
  /** Канал оформления: витрина или POS. */
  source?: string | null
  delivery_mode: DeliveryMode
  aggregator?: "glovo" | null
  delivery_address: string | null
  payment_method: PaymentMethod
  cash_amount?: number | null
  card_amount?: number | null
  change_from: number | null
  total: number
  delivery_fee: number
  discount: number
  bonuses_redeemed?: number
  promo_code: string | null
  scheduled_time: string | null
  /** Заполняется при переходе в `cooking` (триггер в БД); для таймера KDS */
  cooking_started_at?: string | null
  /** KDS: переход `cooking` → `ready` */
  ready_at: string | null
  comment: string | null
  /** Только кухня (POS), не подмешивается в расчёты и витрину. */
  kitchen_note: string | null
  tg_message_id: string | null
  created_at: string
  updated_at: string
  cancel_reason?: string | null
  address_entrance?: string | null
  address_floor?: string | null
  address_apartment?: string | null
  address_intercom?: string | null
  courier_id: string | null
  courier_assigned_at: string | null
  delivered_at: string | null
  /** Момент оплаты (POS / агрегатор); для расчёта времени исполнения. */
  paid_at?: string | null
  delivery_lat: number | null
  delivery_lng: number | null
  /** FK к `cash_sessions.id`; заполняется при `payOrder`. */
  cash_session_id: string | null
}

/** Элемент JSONB `order_items.toppings`. */
export type OrderItemTopping = {
  /** UUID топпинга — в новых заказах; в legacy-строках отсутствует. */
  id?: string
  name: string
  price: number
  quantity: number
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
  toppings: OrderItemTopping[]
  price: number
}

export interface OrderWithItems extends Order {
  order_items: OrderItem[]
  /** Join `brands` при выборке списка заказов в админке. */
  brands?: { name: string; slug?: string | null } | Array<{
    name: string
    slug?: string | null
  }> | null
}

/** Таблица `cash_sessions`. */
export type CashSession = {
  id: string
  shift_log_id: string
  opening_balance_bani: number
  closing_balance_expected_bani: number | null
  closing_balance_actual_bani: number | null
  discrepancy_bani: number | null
  status: "open" | "closed"
  opened_at: string
  closed_at: string | null
  opened_by_staff_id: string | null
  closed_by_staff_id: string | null
  discrepancy_reason: string | null
}

/** Таблица `cash_transactions`. */
export type CashTransaction = {
  id: string
  cash_session_id: string
  type: string
  direction: string
  amount_bani: number
  payment_method: string
  category: string | null
  description: string | null
  order_id: string | null
  created_by_staff_id: string | null
  created_at: string
  order_delivery_mode: DeliveryMode | null
  order_brand_id: string | null
  voided_at: string | null
  voided_by_staff_id: string | null
  void_reason: string | null
  encashment_destination: string | null
}

export type CourierLocation = {
  staff_id: string
  lat: number
  lng: number
  accuracy: number | null
  is_on_shift: boolean
  updated_at: string
}

export type Ingredient = {
  id: string
  brand_id: string
  name: string
  unit: "g" | "ml" | "pcs"
  /** Ссылка на `ingredient_categories`; NULL — без категории. */
  category_id: string | null
  /** Потери при очистке, % (0–100). Нетто в техкарте = брутто × (1 − waste_percent / 100). */
  waste_percent: number
  created_at: string
}

export type IngredientStock = {
  ingredient_id: string
  quantity: number
  updated_at: string
  avg_cost: number
}

export type IngredientWithStock = Ingredient & {
  ingredient_stock: IngredientStock | null
}

export type SemiFinished = {
  id: string
  brand_id: string
  name: string
  yield_qty: number
  yield_unit: "g" | "ml" | "pcs"
  created_at: string
}

export type SemiFinishedItem = {
  id: string
  semi_finished_id: string
  ingredient_id: string
  quantity: number
}

export type ProductRecipe = {
  id: string
  menu_item_id: string
  variant_id: string | null
  ingredient_id: string | null
  semi_finished_id: string | null
  /** Компонент комбо: вложенная позиция; при списании quantity строки не используется (в БД 1). */
  menu_item_ref_id: string | null
  /** Вариант вложенной позиции; NULL — рецепт без варианта. */
  menu_item_ref_variant_id: string | null
  /** Нетто в ед. хранения (без потерь). */
  quantity: number
  /** Брутто в ед. хранения; списание со склада (для строк с ingredient_id). */
  quantity_gross: number | null
}

export type ProductRecipeMeta = {
  id: string
  menu_item_id: string
  variant_id: string | null
  output_qty: number
  output_unit: "g" | "ml" | "pcs"
}

export type Staff = {
  tg_chat_id: number | null
  tg_link_token: string | null
  tg_link_token_expires_at: string | null
}

export type Supplier = {
  id: string
  brand_id: string
  name: string
  contact_person: string | null
  phone: string | null
  note: string | null
  is_active: boolean
  created_at: string
}

export type SupplyOrder = {
  id: string
  brand_id: string
  supplier_id: string | null
  delivery_date: string
  note: string | null
  total_cost_ex_vat: number | null
  total_cost_inc_vat: number | null
  created_at: string
  annulled_at: string | null
}

export type SupplyOrderItem = {
  id: string
  supply_order_id: string
  ingredient_id: string
  quantity: number
  received_qty: number | null
  price_per_unit: number
  vat_rate: number
  price_per_unit_with_vat: number
}

export type StockAudit = {
  id: string
  brand_id: string
  note: string | null
  confirmed_at: string | null
  created_at: string
}

export type StockAuditItem = {
  id: string
  audit_id: string
  ingredient_id: string
  expected_qty: number
  actual_qty: number | null
  diff: number | null
}

export interface CustomerAddress {
  id: string
  address: string
  label: string | null
  entrance: string | null
  floor: string | null
  apartment: string | null
  intercom: string | null
  delivery_lat: number | null
  delivery_lng: number | null
  is_default: boolean
}

export type OrderFeedback = {
  id: string
  order_id: string
  brand_id: string
  token: string
  short_code: string | null
  token_expires_at: string
  sms_sent_at: string | null
  food_rating: number | null
  service_rating: number | null
  comment: string | null
  photo_urls: string[] | null
  submitted_at: string | null
  resolution_note: string | null
  resolved_by: string | null
  resolved_at: string | null
  tg_message_id: number | null
  tg_notified: boolean
  created_at: string
}
