"use server"

import { createServiceSupabaseClient } from "@/lib/supabase/server"
import {
  CUSTOMERS_PAGE_SIZE,
  type CustomerFilters,
  type CustomerRow,
} from "@/types/customers"

type RpcRow = {
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

function mapRow(r: RpcRow): CustomerRow {
  return {
    id: r.id,
    phone: r.phone,
    name: r.name,
    created_at: r.created_at,
    site_orders_count: Number(r.site_orders_count ?? 0),
    site_total_spend: Number(r.site_total_spend ?? 0),
    site_last_order_at: r.site_last_order_at,
    poster_orders_count:
      r.poster_orders_count != null ? Number(r.poster_orders_count) : null,
    poster_last_order_at: r.poster_last_order_at,
    total_orders_count: Number(r.total_orders_count ?? 0),
    last_order_at: r.last_order_at,
    bonus_balance: Number(r.bonus_balance ?? 0),
    total_count: Number(r.total_count ?? 0),
  }
}

function regFromIso(dateStr: string): string | null {
  const t = dateStr.trim()
  if (!t) return null
  const d = new Date(`${t}T00:00:00`)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

function regToIso(dateStr: string): string | null {
  const t = dateStr.trim()
  if (!t) return null
  const d = new Date(`${t}T23:59:59.999`)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

export async function getCustomersList(
  filters: CustomerFilters,
  page: number,
): Promise<{ data: CustomerRow[]; totalCount: number; error?: string }> {
  const safePage = Number.isFinite(page) && page >= 1 ? page : 1
  const offset = (safePage - 1) * CUSTOMERS_PAGE_SIZE
  const search = filters.search.trim()

  let supabase: ReturnType<typeof createServiceSupabaseClient>
  try {
    supabase = createServiceSupabaseClient()
  } catch (e) {
    return {
      data: [],
      totalCount: 0,
      error: e instanceof Error ? e.message : "Ошибка конфигурации Supabase",
    }
  }

  const { data, error } = await supabase.rpc("get_customers_list", {
    p_search: search === "" ? null : search,
    p_reg_from: regFromIso(filters.regFrom),
    p_reg_to: regToIso(filters.regTo),
    p_min_orders: filters.minOrders,
    p_has_bonus: filters.hasBonus,
    p_active_days: filters.activeDays,
    p_sort_by: filters.sortBy,
    p_sort_dir: filters.sortDir,
    p_limit: CUSTOMERS_PAGE_SIZE,
    p_offset: offset,
  })

  if (error) {
    return { data: [], totalCount: 0, error: error.message }
  }

  const rows = (data ?? []) as RpcRow[]
  if (rows.length === 0) {
    return { data: [], totalCount: 0 }
  }

  const totalCount = rows[0]?.total_count ?? 0
  return {
    data: rows.map(mapRow),
    totalCount,
  }
}
