import { createClient } from "@/lib/supabase/client"
import type { PosOrder, PosOrderSource, PosOrderStatus } from "@/types/pos"

type BrandsEmbed = { slug: string } | { slug: string }[] | null

type OrderItemsCountEmbed = { count: number }[] | null

export type OrderRow = {
  id: string
  order_number: number
  brand_id: string
  operator_id: string | null
  source: PosOrderSource | null
  status: PosOrderStatus
  user_name: string | null
  user_phone: string
  delivery_mode: "delivery" | "pickup"
  delivery_address: string | null
  total: number
  delivery_fee: number
  discount: number
  comment: string | null
  created_at: string
  updated_at: string
  brands: BrandsEmbed
  order_items: OrderItemsCountEmbed
}

function brandSlugFromRow(row: OrderRow): string {
  const b = row.brands
  if (!b) return ""
  if (Array.isArray(b)) return b[0]?.slug ?? ""
  return b.slug ?? ""
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

/** Полный маппинг строки заказа (как при начальной загрузке) — для Realtime и повторных fetch. */
export function mapOrderRowToPosOrder(row: OrderRow): PosOrder {
  return {
    id: row.id,
    order_number: row.order_number,
    brand_id: row.brand_id,
    brand_slug: brandSlugFromRow(row),
    operator_id: row.operator_id,
    source: parseSource(row.source),
    status: row.status,
    user_name: row.user_name,
    user_phone: row.user_phone,
    delivery_mode: row.delivery_mode,
    delivery_address: row.delivery_address,
    total: row.total,
    delivery_fee: row.delivery_fee,
    discount: row.discount,
    comment: row.comment,
    created_at: row.created_at,
    updated_at: row.updated_at,
    item_count: itemCountFromRow(row),
  }
}

export const mapOrder = mapOrderRowToPosOrder

export async function fetchPosOrders(): Promise<PosOrder[]> {
  const supabase = createClient()
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from("orders")
    .select("*, brands(slug), order_items(count)")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(100)

  if (error) {
    console.error("[fetchPosOrders]", error.message)
    return []
  }

  return (data as OrderRow[] | null)?.map(mapOrderRowToPosOrder) ?? []
}

export async function fetchPosOrderById(id: string): Promise<PosOrder | null> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from("orders")
    .select("*, brands(slug), order_items(count)")
    .eq("id", id)
    .maybeSingle()

  if (error) {
    console.error("[fetchPosOrderById]", error.message)
    return null
  }

  if (!data) return null
  return mapOrderRowToPosOrder(data as OrderRow)
}
