import { startOfUtcTodayIso } from "@/lib/admin/orders-url"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import type { DeliveryMode, OrderStatus } from "@/types/database"

const PAGE = 1000

const EXCLUDED_FROM_TOTAL = new Set<OrderStatus>([
  "draft",
  "cancelled",
  "rejected",
])

type OrderMetricsRow = {
  status: OrderStatus
  total: number | null
  ready_at: string | null
  cooking_started_at: string | null
  paid_at: string | null
  courier_assigned_at: string | null
  delivery_mode: DeliveryMode
}

export type AdminOrdersTodayMetrics = {
  totalOrders: number
  revenueBani: number
  cancelledCount: number
  avgCookMin: number | null
  avgDeliveryMin: number | null
  /** Все заказы за период (любой статус), для доли отмен. */
  allOrdersCount: number
}

/**
 * Метрики за текущий календарный день по UTC (`created_at >=` начало суток UTC).
 * Опциональный фильтр по бренду — как в списке заказов.
 */
export async function getAdminOrdersTodayMetrics(
  brandId: string | null,
): Promise<AdminOrdersTodayMetrics> {
  const supabase = createServiceRoleClient()
  const startIso = startOfUtcTodayIso()

  const baseQuery = () => {
    let q = supabase
      .from("orders")
      .select(
        "status,total,ready_at,cooking_started_at,paid_at,courier_assigned_at,delivery_mode",
      )
      .gte("created_at", startIso)
    if (brandId) {
      q = q.eq("brand_id", brandId)
    }
    return q
  }

  const rows: OrderMetricsRow[] = []
  let from = 0
  for (;;) {
    const { data, error } = await baseQuery().range(from, from + PAGE - 1)
    if (error) {
      throw new Error(error.message)
    }
    const batch = (data ?? []) as OrderMetricsRow[]
    rows.push(...batch)
    if (batch.length < PAGE) break
    from += PAGE
  }

  const allOrdersCount = rows.length
  let totalOrders = 0
  let revenueBani = 0
  let cancelledCount = 0
  const cookMinutes: number[] = []
  const deliveryMinutes: number[] = []

  for (const r of rows) {
    if (!EXCLUDED_FROM_TOTAL.has(r.status)) {
      totalOrders += 1
    }
    if (r.status === "done") {
      revenueBani += r.total ?? 0
    }
    if (r.status === "cancelled" || r.status === "rejected") {
      cancelledCount += 1
    }
    if (r.ready_at && r.cooking_started_at) {
      const readyMs = new Date(r.ready_at).getTime()
      const cookMs = new Date(r.cooking_started_at).getTime()
      if (
        Number.isFinite(readyMs) &&
        Number.isFinite(cookMs) &&
        readyMs >= cookMs
      ) {
        cookMinutes.push((readyMs - cookMs) / 60000)
      }
    }
    if (
      r.delivery_mode === "delivery" &&
      r.paid_at &&
      r.courier_assigned_at
    ) {
      const paidMs = new Date(r.paid_at).getTime()
      const assignedMs = new Date(r.courier_assigned_at).getTime()
      if (
        Number.isFinite(paidMs) &&
        Number.isFinite(assignedMs) &&
        paidMs >= assignedMs
      ) {
        deliveryMinutes.push((paidMs - assignedMs) / 60000)
      }
    }
  }

  const avgCookMin =
    cookMinutes.length > 0
      ? cookMinutes.reduce((a, b) => a + b, 0) / cookMinutes.length
      : null
  const avgDeliveryMin =
    deliveryMinutes.length > 0
      ? deliveryMinutes.reduce((a, b) => a + b, 0) / deliveryMinutes.length
      : null

  return {
    totalOrders,
    revenueBani,
    cancelledCount,
    avgCookMin,
    avgDeliveryMin,
    allOrdersCount,
  }
}
