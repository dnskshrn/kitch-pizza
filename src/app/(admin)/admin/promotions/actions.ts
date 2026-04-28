"use server"

import { getAdminBrandId } from "@/lib/get-admin-brand-id"
import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export type PromotionInput = {
  image_url_ru: string | null
  image_url_ro: string | null
  sort_order: number
  is_active: boolean
}

export async function createPromotion(data: PromotionInput) {
  const brandId = await getAdminBrandId()
  const supabase = await createClient()
  const { error } = await supabase.from("promotions").insert({
    brand_id: brandId,
    image_url_ru: data.image_url_ru,
    image_url_ro: data.image_url_ro,
    sort_order: data.sort_order,
    is_active: data.is_active,
  })
  if (error) throw new Error(error.message)
  revalidatePath("/admin/promotions")
}

export async function updatePromotion(id: string, data: PromotionInput) {
  const brandId = await getAdminBrandId()
  const supabase = await createClient()
  const { error } = await supabase
    .from("promotions")
    .update({
      image_url_ru: data.image_url_ru,
      image_url_ro: data.image_url_ro,
      sort_order: data.sort_order,
      is_active: data.is_active,
    })
    .eq("id", id)
    .eq("brand_id", brandId)
  if (error) throw new Error(error.message)
  revalidatePath("/admin/promotions")
}

export async function deletePromotion(id: string) {
  const brandId = await getAdminBrandId()
  const supabase = await createClient()
  const { error } = await supabase
    .from("promotions")
    .delete()
    .eq("id", id)
    .eq("brand_id", brandId)
  if (error) throw new Error(error.message)
  revalidatePath("/admin/promotions")
}
