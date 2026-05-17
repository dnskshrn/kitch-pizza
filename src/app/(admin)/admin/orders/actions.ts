"use server"

import { createServiceRoleClient } from "@/lib/supabase/service-role"
import type { OrderStatus } from "@/types/database"

export type StaffMini = {
  id: string
  name: string | null
  role: string | null
}

export type ProfileMini = {
  name: string | null
  phone: string | null
}

/** Строки `order_items` с полями, нужными для карточки заказа. */
export type AdminOrderDetailItem = {
  id: string
  item_name: string
  size: string | null
  quantity: number
  price: number
  toppings: unknown
  is_gift?: boolean | null
}

/** Снимок `orders` + joins для заказной шторки админки. */
export type AdminOrderDetailRow = {
  id: string
  order_number: number
  brand_id: string | null
  operator_id: string | null
  courier_id: string | null
  profile_id?: string | null
  user_name: string | null
  user_phone: string | null
  status: OrderStatus
  source?: string | null
  delivery_mode: string
  aggregator?: string | null
  total: number
  delivery_fee: number
  discount: number
  cash_amount?: number | null
  card_amount?: number | null
  change_from?: number | null
  payment_method?: string | null
  promo_code?: string | null
  bonuses_redeemed?: number | null
  scheduled_time?: string | null
  cooking_started_at?: string | null
  ready_at: string | null
  courier_assigned_at?: string | null
  delivered_at?: string | null
  paid_at?: string | null
  created_at: string
  updated_at: string
  cancel_reason?: string | null
  delivery_address?: string | null
  address_entrance?: string | null
  address_floor?: string | null
  address_apartment?: string | null
  address_intercom?: string | null
  comment?: string | null
  brands?: { name: string; slug: string } | { name: string; slug: string }[] | null
  order_items?: AdminOrderDetailItem[] | null
  operator?: StaffMini | StaffMini[] | null
  courier?: StaffMini | StaffMini[] | null
  profiles?: ProfileMini | ProfileMini[] | null
}

const ORDER_DETAIL_SELECT =
  `
  *,
  brands(name, slug),
  order_items(id, item_name, size, quantity, price, toppings, is_gift),
  operator:staff!orders_operator_id_fkey(id, name, role),
  courier:staff!orders_courier_id_fkey(id, name, role),
  profiles!orders_profile_id_fkey(name, phone)
`

export async function fetchAdminOrderDetail(orderId: string): Promise<{
  order: AdminOrderDetailRow | null
  error: string | null
}> {
  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from("orders")
    .select(ORDER_DETAIL_SELECT)
    .eq("id", orderId)
    .maybeSingle()

  if (error) return { order: null, error: error.message }

  const row = data as AdminOrderDetailRow | null
  return { order: row ?? null, error: null }
}
