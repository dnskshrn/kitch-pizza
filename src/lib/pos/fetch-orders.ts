import { normalizePosBrandSlug } from "@/brands/index"
import { createClient } from "@/lib/supabase/client"
import type { PosOrder, PosOrderSource, PosOrderStatus } from "@/types/pos"

/** Колонки `orders` + вложения для списка/карточек POS (без несуществующих полей). */
const ORDERS_POS_SELECT =
  "id, order_number, user_phone, user_name, status, total, delivery_address, comment, tg_message_id, created_at, delivery_mode, payment_method, change_from, delivery_fee, promo_code, discount, scheduled_time, updated_at, brand_id, operator_id, source, profile_id, cancel_reason, address_entrance, address_floor, address_apartment, address_intercom, brands(slug), order_items(count)"

/** Активные заказы левой колонки POS (без завершённых, отмен и отказов сайта). */
export const MAIN_POS_ORDER_STATUSES: readonly PosOrderStatus[] = [
  "draft",
  "new",
  "in_progress",
  "delivering",
] as const

type BrandsEmbed = { slug: string } | { slug: string }[] | null

type OrderItemsCountEmbed = { count: number }[] | null

export type OrderRow = {
  id: string
  order_number: number
  brand_id: string | null
  operator_id: string | null
  source: PosOrderSource | null
  status: PosOrderStatus
  user_name: string | null
  user_phone: string | null
  delivery_mode: "delivery" | "pickup"
  delivery_address: string | null
  payment_method: "cash" | "card"
  change_from: number | null
  promo_code: string | null
  total: number
  delivery_fee: number
  discount: number
  comment: string | null
  created_at: string
  updated_at: string
  brands: BrandsEmbed
  order_items: OrderItemsCountEmbed
  cancel_reason?: string | null
  address_entrance?: string | null
  address_floor?: string | null
  address_apartment?: string | null
  address_intercom?: string | null
}

function brandSlugFromRow(row: OrderRow): string {
  const b = row.brands
  if (b == null) return ""
  if (Array.isArray(b)) {
    if (b.length === 0) return ""
    const raw = b[0]?.slug
    return typeof raw === "string" ? raw.trim() : ""
  }
  const raw = b.slug
  return typeof raw === "string" ? raw.trim() : ""
}

async function fetchBrandSlugsByIds(
  brandIds: string[],
): Promise<Map<string, string>> {
  if (brandIds.length === 0) return new Map()
  const supabase = createClient()
  const { data, error } = await supabase
    .from("brands")
    .select("id, slug")
    .in("id", brandIds)

  if (error) {
    console.error("[fetchBrandSlugsByIds]", error.message)
    return new Map()
  }
  return new Map(
    (data ?? []).map((r: { id: string; slug: string }) => [
      r.id,
      typeof r.slug === "string" ? r.slug.trim() : "",
    ]),
  )
}

function collectBrandIdsNeedingSlug(rows: OrderRow[]): string[] {
  const ids = new Set<string>()
  for (const row of rows) {
    if (!row.brand_id) continue
    if (!brandSlugFromRow(row)) ids.add(row.brand_id)
  }
  return [...ids]
}

async function rowsToPosOrders(rows: OrderRow[]): Promise<PosOrder[]> {
  const slugById = await fetchBrandSlugsByIds(collectBrandIdsNeedingSlug(rows))
  return rows.map((row) => {
    const fromEmbed = brandSlugFromRow(row)
    const fromTable =
      row.brand_id != null ? (slugById.get(row.brand_id) ?? "") : ""
    const merged = fromEmbed || fromTable
    return mapOrderRowToPosOrder(row, merged)
  })
}

function itemCountFromRow(row: OrderRow): number {
  const items = row.order_items
  if (!items?.length) return 0
  const n = items[0]?.count
  return typeof n === "number" ? n : 0
}

function parseSource(v: unknown): PosOrderSource {
  return v === "pos" ? "pos" : "website"
}

/**
 * Маппинг строки заказа для POS.
 * @param resolvedSlug — уже собранный slug (embed или запрос к `brands`); иначе только из join.
 */
export function mapOrderRowToPosOrder(row: OrderRow, resolvedSlug?: string): PosOrder {
  const raw =
    resolvedSlug !== undefined ? resolvedSlug : brandSlugFromRow(row)
  const brand_slug = normalizePosBrandSlug(raw)

  return {
    id: row.id,
    order_number: row.order_number,
    brand_id: row.brand_id,
    brand_slug,
    operator_id: row.operator_id,
    source: parseSource(row.source),
    status: row.status,
    user_name: row.user_name,
    user_phone: row.user_phone,
    delivery_mode: row.delivery_mode,
    delivery_address: row.delivery_address,
    payment_method: row.payment_method ?? "cash",
    change_from: row.change_from ?? null,
    promo_code: row.promo_code ?? null,
    total: row.total,
    delivery_fee: row.delivery_fee,
    discount: row.discount,
    comment: row.comment,
    created_at: row.created_at,
    updated_at: row.updated_at,
    item_count: itemCountFromRow(row),
    cancel_reason: row.cancel_reason ?? null,
    address_entrance: row.address_entrance ?? null,
    address_floor: row.address_floor ?? null,
    address_apartment: row.address_apartment ?? null,
    address_intercom: row.address_intercom ?? null,
  }
}

export const mapOrder = mapOrderRowToPosOrder

export async function fetchPosOrders(): Promise<PosOrder[]> {
  const supabase = createClient()
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from("orders")
    .select(ORDERS_POS_SELECT)
    .gte("created_at", since)
    .in("status", [...MAIN_POS_ORDER_STATUSES])
    .order("created_at", { ascending: false })
    .limit(100)

  if (error) {
    console.error("[fetchPosOrders]", error.message)
    return []
  }

  const rows = (data as OrderRow[] | null) ?? []
  return rowsToPosOrders(rows)
}

/** Последние доставленные заказы для листа POS «Выданные». */
export async function fetchCompletedPosOrders(): Promise<PosOrder[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from("orders")
    .select(ORDERS_POS_SELECT)
    .eq("status", "done")
    .order("updated_at", { ascending: false })
    .limit(50)

  if (error) {
    console.error("[fetchCompletedPosOrders]", error.message)
    return []
  }

  const rows = (data as OrderRow[] | null) ?? []
  return rowsToPosOrders(rows)
}

export async function fetchPosOrderById(id: string): Promise<PosOrder | null> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from("orders")
    .select(ORDERS_POS_SELECT)
    .eq("id", id)
    .maybeSingle()

  if (error) {
    console.error("[fetchPosOrderById]", error.message)
    return null
  }

  if (!data) return null
  const row = data as OrderRow
  const rows = await rowsToPosOrders([row])
  return rows[0] ?? null
}
