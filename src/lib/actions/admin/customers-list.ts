"use server"

import { createServiceSupabaseClient } from "@/lib/supabase/server"
import {
  CUSTOMERS_PAGE_SIZE,
  type CustomerFilters,
  type CustomerRow,
} from "@/types/customers"

/** Сырой ответ RPC `get_customers_list` (bigint → string в JS). */
type CustomerListRpcRow = {
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
  total_count: string
}

function mapRow(r: CustomerListRpcRow): CustomerRow {
  return {
    id: r.id,
    phone: r.phone,
    name: r.name,
    created_at: r.created_at,
    orders_count: r.orders_count ?? "0",
    total_spent_bani: r.total_spent_bani ?? "0",
    last_order_at: r.last_order_at,
    poster_orders_count: r.poster_orders_count,
    poster_last_order_at: r.poster_last_order_at,
    bonus_balance: r.bonus_balance ?? 0,
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

  const rows = (data ?? []) as CustomerListRpcRow[]
  if (rows.length === 0) {
    return { data: [], totalCount: 0 }
  }

  const totalCount = Number(rows[0]?.total_count ?? 0)
  return {
    data: rows.map(mapRow),
    totalCount,
  }
}
