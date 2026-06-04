export interface CustomerRow {
  id: string
  phone: string
  name: string | null
  created_at: string
  orders_count: string
  total_spent_bani: string
  last_order_at: string | null
  poster_orders_count: number | null
  poster_last_order_at: string | null
  bonus_balance: number
}

export interface CustomerFilters {
  search: string
  sortBy:
    | "created_at"
    | "orders_count"
    | "total_spent"
    | "last_order_at"
    | "bonus_balance"
    | "name"
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
