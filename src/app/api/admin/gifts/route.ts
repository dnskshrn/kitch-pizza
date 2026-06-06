import { createServiceSupabaseClient } from "@/lib/supabase/server"
import type { CustomerGift } from "@/types/database"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

function customerGiftsTable(supabase: ReturnType<typeof createServiceSupabaseClient>) {
  return supabase.from("customer_gifts") as ReturnType<typeof supabase.from>
}

type PostBody = {
  profile_id?: string
  brand_id?: string
  menu_item_id?: string
  quantity?: unknown
  reason?: string
  created_by?: string
  source_feedback_id?: string
  source_order_id?: string
  expires_at?: string
}

export async function POST(request: Request) {
  let body: PostBody
  try {
    body = (await request.json()) as PostBody
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const profile_id =
    typeof body.profile_id === "string" ? body.profile_id.trim() : ""
  const brand_id =
    typeof body.brand_id === "string" ? body.brand_id.trim() : ""
  const menu_item_id =
    typeof body.menu_item_id === "string" ? body.menu_item_id.trim() : ""
  const reason = typeof body.reason === "string" ? body.reason.trim() : ""
  const created_by =
    typeof body.created_by === "string" ? body.created_by.trim() : ""
  const quantityRaw =
    typeof body.quantity === "number" ? body.quantity : Number(body.quantity)
  const quantity = Math.max(1, Math.floor(quantityRaw))

  if (!profile_id || !brand_id || !menu_item_id || !reason) {
    return NextResponse.json(
      { error: "profile_id, brand_id, menu_item_id and reason are required" },
      { status: 400 },
    )
  }
  if (!Number.isFinite(quantityRaw) || quantity < 1) {
    return NextResponse.json({ error: "Invalid quantity" }, { status: 400 })
  }

  const supabase = createServiceSupabaseClient()

  const { data: menuItem, error: menuError } = await supabase
    .from("menu_items")
    .select("name_ru")
    .eq("id", menu_item_id)
    .maybeSingle()

  if (menuError) {
    return NextResponse.json({ error: menuError.message }, { status: 500 })
  }
  if (!menuItem) {
    return NextResponse.json({ error: "menu_item not found" }, { status: 404 })
  }

  const item_name =
    typeof (menuItem as { name_ru?: string }).name_ru === "string"
      ? (menuItem as { name_ru: string }).name_ru.trim()
      : ""
  if (!item_name) {
    return NextResponse.json({ error: "menu_item name missing" }, { status: 400 })
  }

  const insertRow: Record<string, unknown> = {
    profile_id,
    brand_id,
    menu_item_id,
    item_name,
    quantity,
    reason,
    created_by,
    status: "pending",
  }

  if (typeof body.source_feedback_id === "string" && body.source_feedback_id.trim()) {
    insertRow.source_feedback_id = body.source_feedback_id.trim()
  }
  if (typeof body.source_order_id === "string" && body.source_order_id.trim()) {
    insertRow.source_order_id = body.source_order_id.trim()
  }
  if (typeof body.expires_at === "string" && body.expires_at.trim()) {
    insertRow.expires_at = body.expires_at.trim()
  }

  const { data, error } = await customerGiftsTable(supabase)
    .insert(insertRow)
    .select("*")
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data as CustomerGift)
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const profile_id = searchParams.get("profile_id")?.trim() ?? ""
  const brand_id = searchParams.get("brand_id")?.trim() ?? ""
  const status = searchParams.get("status")?.trim() ?? "pending"

  if (!profile_id || !brand_id) {
    return NextResponse.json(
      { error: "profile_id and brand_id are required" },
      { status: 400 },
    )
  }

  const supabase = createServiceSupabaseClient()

  let query = customerGiftsTable(supabase)
    .select("*, menu_items(name_ru)")
    .eq("profile_id", profile_id)
    .eq("brand_id", brand_id)

  if (status) {
    query = query.eq("status", status)
  }

  const { data, error } = await query.order("created_at", { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data ?? [])
}
