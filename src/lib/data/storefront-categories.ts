import { getBrandId } from "@/lib/get-brand-id"
import { createClient } from "@/lib/supabase/server"
import type { Category } from "@/types/database"

/** Категории витрины: только активные, по sort_order. */
export async function getStorefrontCategories(): Promise<Category[]> {
  const brandId = await getBrandId()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("menu_categories")
    .select("*")
    .eq("brand_id", brandId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })

  if (error) {
    console.error("getStorefrontCategories:", error.message)
    return []
  }

  return (data ?? []) as Category[]
}
