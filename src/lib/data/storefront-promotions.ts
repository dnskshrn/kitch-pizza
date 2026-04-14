import { createClient } from "@/lib/supabase/server"
import type { StorefrontPromotion } from "@/types/database"

/** Акции для витрины: только активные, по sort_order. */
export async function getStorefrontPromotions(): Promise<StorefrontPromotion[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("promotions")
    .select("id, image_url_ru, image_url_ro")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })

  if (error) {
    console.error("getStorefrontPromotions:", error.message)
    return []
  }

  return (data ?? []) as StorefrontPromotion[]
}
