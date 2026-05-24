export interface CustomerRow {
  id: string
  phone: string
  name: string | null
  created_at: string
  site_orders_count: number
  site_total_spend: number
  site_last_order_at: string | null
  poster_orders_count: number | null
  poster_last_order_at: string | null
  total_orders_count: number
  last_order_at: string | null
  bonus_balance: number
  total_count: number
}

export interface CustomerFilters {
  search: string
  sortBy: "created_at" | "last_order" | "total_spend" | "orders_count"
  sortDir: "asc" | "desc"
  minOrders: number
  hasBonus: boolean | null
  regFrom: string
  regTo: string
  activeDays: number | null
}

export const DEFAULT_CUSTOMER_FILTERS: CustomerFilters = {
  search: "",
  sortBy: "created_at",
  sortDir: "desc",
  minOrders: 0,
  hasBonus: null,
  regFrom: "",
  regTo: "",
  activeDays: null,
}

export const CUSTOMERS_PAGE_SIZE = 50
