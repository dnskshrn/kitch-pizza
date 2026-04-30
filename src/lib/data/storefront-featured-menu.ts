import { getBrandId } from "@/lib/get-brand-id"
import { createClient } from "@/lib/supabase/server"
import type { MenuItem } from "@/types/database"

type FeaturedMenuRow = {
  menu_item: MenuItem | null
}

/** Брендовая карусель «Новое и популярное» для витрины. */
export async function getStorefrontFeaturedMenuItems(): Promise<MenuItem[]> {
  const brandId = await getBrandId()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("featured_menu_items")
    .select("menu_item:menu_items!inner(*)")
    .eq("brand_id", brandId)
    .eq("menu_item.brand_id", brandId)
    .eq("menu_item.is_active", true)
    .order("sort_order", { ascending: true })

  if (error) {
    console.error("getStorefrontFeaturedMenuItems:", error.message)
    return []
  }

  return ((data ?? []) as unknown as FeaturedMenuRow[])
    .map((row) => row.menu_item)
    .filter((item): item is MenuItem => Boolean(item))
}
