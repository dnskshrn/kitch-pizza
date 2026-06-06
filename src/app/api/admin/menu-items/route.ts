import { createServiceSupabaseClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const brand_id = searchParams.get("brand_id")?.trim() ?? ""

  if (!brand_id) {
    return NextResponse.json({ error: "brand_id is required" }, { status: 400 })
  }

  const supabase = createServiceSupabaseClient()
  const { data, error } = await supabase
    .from("menu_items")
    .select("id, name_ru")
    .eq("brand_id", brand_id)
    .eq("is_active", true)
    .order("name_ru", { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data ?? [])
}
