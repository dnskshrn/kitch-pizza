import { getStorefrontSession } from "@/lib/storefront-session"
import { createServiceSupabaseClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET() {
  const session = await getStorefrontSession()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = createServiceSupabaseClient()

  const { data: rows, error } = await supabase
    .from("orders")
    .select("id, order_number, created_at, total, status, brand_id")
    .eq("profile_id", session.profileId)
    .order("created_at", { ascending: false })
    .limit(10)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  type OrderRow = {
    id: string
    order_number: number
    created_at: string
    total: number
    status: string
    brand_id: string
  }

  const list = (rows ?? []) as OrderRow[]
  const brandIds = [...new Set(list.map((r) => r.brand_id).filter(Boolean))]

  const slugById: Record<string, string> = {}
  if (brandIds.length > 0) {
    const { data: brands } = await supabase
      .from("brands")
      .select("id, slug")
      .in("id", brandIds)

    for (const b of brands ?? []) {
      if (b && typeof b.id === "string" && typeof b.slug === "string") {
        slugById[b.id] = b.slug
      }
    }
  }

  const orders = list.map((r) => ({
    id: r.id,
    order_number: r.order_number,
    created_at: r.created_at,
    total: r.total,
    status: r.status,
    brand_id: r.brand_id,
    brand_slug: slugById[r.brand_id] ?? null,
  }))

  return NextResponse.json({ orders })
}
