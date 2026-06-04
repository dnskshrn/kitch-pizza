"use server"

import { createClient } from "@/lib/supabase/server"
import { format, subDays, eachDayOfInterval, parseISO } from "date-fns"
import { ru } from "date-fns/locale"

const PAGE = 1000
/** PostgREST ограничивает длину `.in()` — батчим id заказов для популярных позиций. */
const ORDER_ID_BATCH = 300

export type DayStats = {
  date: string
  dateKey: string
  revenue: number
  orders: number
  avgCheck: number
  newCustomers: number
}

export type PopularItem = {
  menu_item_id: string
  name: string
  brand_id: string
  totalQty: number
}

export type AnalyticsSummary = {
  totalRevenue: number
  totalOrders: number
  avgCheck: number
  newCustomers: number
  prevTotalRevenue: number
  prevTotalOrders: number
  prevNewCustomers: number
}

export type AnalyticsFilters = {
  brandId?: string
  days: 7 | 14 | 30
}

export type AnalyticsResult = {
  dayStats: DayStats[]
  popularItems: PopularItem[]
  summary: AnalyticsSummary
}

type OrderRow = {
  id: string
  created_at: string
  total: number | null
  brand_id: string
  profile_id: string | null
}

type ProfileRow = {
  id: string
  created_at: string
}

type OrderItemRow = {
  menu_item_id: string | null
  quantity: number
  menu_items: { name_ru: string; brand_id: string } | { name_ru: string; brand_id: string }[]
}

function buildOrdersQuery(
  supabase: Awaited<ReturnType<typeof createClient>>,
  start: Date,
  end: Date,
  brandId?: string
) {
  return () => {
    let query = supabase
      .from("orders")
      .select("id, created_at, total, brand_id, profile_id")
      .eq("status", "done")
      .gte("created_at", start.toISOString())
      .lte("created_at", end.toISOString())
      .order("created_at", { ascending: true })

    if (brandId) {
      query = query.eq("brand_id", brandId)
    }

    return query
  }
}

function buildProfilesQuery(
  supabase: Awaited<ReturnType<typeof createClient>>,
  start: Date,
  end: Date
) {
  return () =>
    supabase
      .from("profiles")
      .select("id, created_at")
      .gte("created_at", start.toISOString())
      .lte("created_at", end.toISOString())
      .order("created_at", { ascending: true })
}

async function fetchAllRows<T>(
  buildQuery: () => {
    range: (
      from: number,
      to: number
    ) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>
  }
): Promise<T[]> {
  const rows: T[] = []
  let from = 0

  for (;;) {
    const { data, error } = await buildQuery().range(from, from + PAGE - 1)
    if (error) {
      throw new Error(error.message)
    }
    const batch = (data ?? []) as T[]
    rows.push(...batch)
    if (batch.length < PAGE) break
    from += PAGE
  }

  return rows
}

async function fetchOrderItemsForOrders(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orderIds: string[]
): Promise<OrderItemRow[]> {
  if (orderIds.length === 0) return []

  const rows: OrderItemRow[] = []

  for (let i = 0; i < orderIds.length; i += ORDER_ID_BATCH) {
    const batchIds = orderIds.slice(i, i + ORDER_ID_BATCH)
    const { data, error } = await supabase
      .from("order_items")
      .select("menu_item_id, quantity, menu_items!inner(name_ru, brand_id)")
      .in("order_id", batchIds)

    if (error) {
      throw new Error(error.message)
    }

    rows.push(...((data ?? []) as OrderItemRow[]))
  }

  return rows
}

function groupByDayKey<T extends { created_at: string }>(
  rows: T[]
): Map<string, T[]> {
  const map = new Map<string, T[]>()
  for (const row of rows) {
    const dayKey = format(parseISO(row.created_at), "yyyy-MM-dd")
    const bucket = map.get(dayKey)
    if (bucket) {
      bucket.push(row)
    } else {
      map.set(dayKey, [row])
    }
  }
  return map
}

export async function getAnalyticsData(
  filters: AnalyticsFilters
): Promise<AnalyticsResult> {
  const supabase = await createClient()
  const days = filters.days

  const endDate = new Date()
  endDate.setHours(23, 59, 59, 999)
  const startDate = subDays(endDate, days - 1)
  startDate.setHours(0, 0, 0, 0)
  const prevStart = subDays(startDate, days)
  prevStart.setHours(0, 0, 0, 0)
  const prevEnd = subDays(startDate, 1)
  prevEnd.setHours(23, 59, 59, 999)

  const [orders, prevOrders, profiles, prevProfiles] = await Promise.all([
    fetchAllRows<OrderRow>(
      buildOrdersQuery(supabase, startDate, endDate, filters.brandId)
    ),
    fetchAllRows<OrderRow>(
      buildOrdersQuery(supabase, prevStart, prevEnd, filters.brandId)
    ),
    fetchAllRows<ProfileRow>(buildProfilesQuery(supabase, startDate, endDate)),
    fetchAllRows<ProfileRow>(buildProfilesQuery(supabase, prevStart, prevEnd)),
  ])

  let popularItems: PopularItem[] = []

  if (orders.length > 0) {
    const orderIds = orders.map((o) => o.id)
    const orderItemsData = await fetchOrderItemsForOrders(supabase, orderIds)

    const itemsMap = new Map<
      string,
      { name: string; brand_id: string; totalQty: number }
    >()

    for (const row of orderItemsData) {
      if (!row.menu_item_id) continue
      const menuItem = Array.isArray(row.menu_items)
        ? row.menu_items[0]
        : row.menu_items
      if (!menuItem) continue

      const existing = itemsMap.get(row.menu_item_id)
      if (existing) {
        existing.totalQty += row.quantity
      } else {
        itemsMap.set(row.menu_item_id, {
          name: menuItem.name_ru,
          brand_id: menuItem.brand_id,
          totalQty: row.quantity,
        })
      }
    }

    popularItems = Array.from(itemsMap.entries())
      .map(([menu_item_id, v]) => ({
        menu_item_id,
        name: v.name,
        brand_id: v.brand_id,
        totalQty: v.totalQty,
      }))
      .sort((a, b) => b.totalQty - a.totalQty)
      .slice(0, 15)
  }

  const ordersByDay = groupByDayKey(orders)
  const profilesByDay = groupByDayKey(profiles)

  const allDays = eachDayOfInterval({ start: startDate, end: endDate })
  const dayStats: DayStats[] = allDays.map((day) => {
    const dayKey = format(day, "yyyy-MM-dd")
    const dayOrders = ordersByDay.get(dayKey) ?? []
    const dayProfiles = profilesByDay.get(dayKey) ?? []
    const revenue = dayOrders.reduce((s, o) => s + (o.total ?? 0), 0) / 100
    const ordersCount = dayOrders.length

    return {
      date: format(day, "d MMM", { locale: ru }),
      dateKey: dayKey,
      revenue,
      orders: ordersCount,
      avgCheck: ordersCount > 0 ? revenue / ordersCount : 0,
      newCustomers: dayProfiles.length,
    }
  })

  const totalRevenue = orders.reduce((s, o) => s + (o.total ?? 0), 0) / 100
  const totalOrders = orders.length
  const avgCheck = totalOrders > 0 ? totalRevenue / totalOrders : 0
  const newCustomers = profiles.length
  const prevTotalRevenue =
    prevOrders.reduce((s, o) => s + (o.total ?? 0), 0) / 100
  const prevTotalOrders = prevOrders.length
  const prevNewCustomers = prevProfiles.length

  const summary: AnalyticsSummary = {
    totalRevenue,
    totalOrders,
    avgCheck,
    newCustomers,
    prevTotalRevenue,
    prevTotalOrders,
    prevNewCustomers,
  }

  return { dayStats, popularItems, summary }
}
