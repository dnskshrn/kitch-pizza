"use server"

import { createClient } from "@/lib/supabase/server"
import { format, subDays, eachDayOfInterval, parseISO } from "date-fns"
import { ru } from "date-fns/locale"

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
  let query = supabase
    .from("orders")
    .select("id, created_at, total, brand_id, profile_id")
    .eq("status", "done")
    .gte("created_at", start.toISOString())
    .lte("created_at", end.toISOString())

  if (brandId) {
    query = query.eq("brand_id", brandId)
  }

  return query
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

  const [{ data: ordersData }, { data: prevOrdersData }, { data: profilesData }, { data: prevProfilesData }] =
    await Promise.all([
      buildOrdersQuery(supabase, startDate, endDate, filters.brandId),
      buildOrdersQuery(supabase, prevStart, prevEnd, filters.brandId),
      supabase
        .from("profiles")
        .select("id, created_at")
        .gte("created_at", startDate.toISOString())
        .lte("created_at", endDate.toISOString()),
      supabase
        .from("profiles")
        .select("id, created_at")
        .gte("created_at", prevStart.toISOString())
        .lte("created_at", prevEnd.toISOString()),
    ])

  const orders = (ordersData ?? []) as OrderRow[]
  const prevOrders = (prevOrdersData ?? []) as OrderRow[]
  const profiles = (profilesData ?? []) as ProfileRow[]
  const prevProfiles = (prevProfilesData ?? []) as ProfileRow[]

  let popularItems: PopularItem[] = []

  if (orders.length > 0) {
    const orderIds = orders.map((o) => o.id)
    const { data: orderItemsData } = await supabase
      .from("order_items")
      .select("menu_item_id, quantity, menu_items!inner(name_ru, brand_id)")
      .in("order_id", orderIds)

    const itemsMap = new Map<
      string,
      { name: string; brand_id: string; totalQty: number }
    >()

    for (const row of (orderItemsData ?? []) as OrderItemRow[]) {
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

  const allDays = eachDayOfInterval({ start: startDate, end: endDate })
  const dayStats: DayStats[] = allDays.map((day) => {
    const dayKey = format(day, "yyyy-MM-dd")
    const dayOrders = orders.filter(
      (o) => format(parseISO(o.created_at), "yyyy-MM-dd") === dayKey
    )
    const dayProfiles = profiles.filter(
      (p) => format(parseISO(p.created_at), "yyyy-MM-dd") === dayKey
    )
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
