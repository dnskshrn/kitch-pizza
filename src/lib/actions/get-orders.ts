"use server"

import {
  ORDERS_PAGE_SIZE,
  escapeIlikePattern,
  ordersCreatedAtBounds,
  type OrdersUrlState,
} from "@/lib/admin/orders-url"
import { getAdminBrandId } from "@/lib/get-admin-brand-id"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import type { OrderWithItems } from "@/types/database"

/**
 * Загрузка заказов с фильтрами и пагинацией (service role).
 * Размер страницы задаётся в `@/lib/admin/orders-url` (`ORDERS_PAGE_SIZE`, 50).
 */
export async function getOrders(
  filters: OrdersUrlState,
): Promise<{ orders: OrderWithItems[]; total: number }> {
  const brandId = await getAdminBrandId()
  const supabase = createServiceRoleClient()
  const bounds = ordersCreatedAtBounds(filters)
  const from = (filters.page - 1) * ORDERS_PAGE_SIZE
  const to = from + ORDERS_PAGE_SIZE - 1

  let q = supabase
    .from("orders")
    .select("*, order_items(*)", { count: "exact" })
    .eq("brand_id", brandId)
    .order("created_at", { ascending: false })

  if (filters.status) {
    q = q.eq("status", filters.status)
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
    orders: (data ?? []) as OrderWithItems[],
    total: count ?? 0,
  }
}
