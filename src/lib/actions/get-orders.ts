"use server"

import {
  ORDERS_PAGE_SIZE,
  escapeIlikePattern,
  ordersCreatedAtBounds,
  type OrdersUrlState,
} from "@/lib/admin/orders-url"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import type { OrderWithItems } from "@/types/database"

const ORDERS_ADMIN_LIST_SELECT = [
  "id",
  "order_number",
  "brand_id",
  "operator_id",
  "courier_id",
  "profile_id",
  "user_name",
  "user_phone",
  "status",
  "source",
  "delivery_mode",
  "aggregator",
  "delivery_address",
  "payment_method",
  "change_from",
  "cash_amount",
  "card_amount",
  "total",
  "delivery_fee",
  "discount",
  "promo_code",
  "bonuses_redeemed",
  "scheduled_time",
  "cooking_started_at",
  "ready_at",
  "courier_assigned_at",
  "delivered_at",
  "paid_at",
  "comment",
  "tg_message_id",
  "created_at",
  "updated_at",
  "cancel_reason",
  "address_entrance",
  "address_floor",
  "address_apartment",
  "address_intercom",
  "delivery_lat",
  "delivery_lng",
  "brands(name,slug)",
  "order_items(*)",
].join(",")

const ACTIVE_STATUSES = [
  "new",
  "confirmed",
  "cooking",
  "ready",
  "delivery",
] as const

const CANCEL_STATUSES = ["cancelled", "rejected"] as const

/**
 * Загрузка заказов с фильтрами и пагинацией (service role).
 * Размер страницы задаётся в `@/lib/admin/orders-url` (`ORDERS_PAGE_SIZE`, 50).
 */
export async function getOrders(
  filters: OrdersUrlState,
): Promise<{ orders: OrderWithItems[]; total: number }> {
  const supabase = createServiceRoleClient()
  const bounds = ordersCreatedAtBounds(filters)
  const from = (filters.page - 1) * ORDERS_PAGE_SIZE
  const to = from + ORDERS_PAGE_SIZE - 1

  let q = supabase
    .from("orders")
    .select(ORDERS_ADMIN_LIST_SELECT, { count: "exact" })
    .order("created_at", { ascending: false })

  if (filters.brandId) {
    q = q.eq("brand_id", filters.brandId)
  }

  switch (filters.statusGroup) {
    case "active":
      q = q.in("status", [...ACTIVE_STATUSES])
      break
    case "done":
      q = q.eq("status", "done")
      break
    case "cancelled":
      q = q.in("status", [...CANCEL_STATUSES])
      break
    case "all":
    default:
      break
  }

  switch (filters.sourceChannel) {
    case "website":
      q = q.eq("source", "website").neq("delivery_mode", "aggregator")
      break
    case "pos":
      q = q.eq("source", "pos").neq("delivery_mode", "aggregator")
      break
    case "glovo":
      q = q.eq("delivery_mode", "aggregator")
      break
    case "all":
    default:
      break
  }

  if (bounds.gte) {
    q = q.gte("created_at", bounds.gte)
  }
  if (bounds.lte) {
    q = q.lte("created_at", bounds.lte)
  }
  if (filters.search) {
    const esc = escapeIlikePattern(filters.search)
    q = q.or(`user_phone.ilike.%${esc}%,user_name.ilike.%${esc}%`)
  }

  const { data, error, count } = await q.range(from, to)

  if (error) {
    console.error("[getOrders]", error.message)
    throw new Error(error.message)
  }

  return {
    orders: (data ?? []) as unknown as OrderWithItems[],
    total: count ?? 0,
  }
}
