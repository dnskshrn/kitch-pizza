"use server"

import { getAdminBrandId } from "@/lib/get-admin-brand-id"
import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

function toSlug(str: string) {
  return str
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\p{L}\p{N}-]+/gu, "")
    .replace(/-+/g, "-")
}

export async function createCategory(data: {
  name_ru: string
  name_ro: string
  slug: string
  sort_order: number
  is_active: boolean
  image_url: string | null
  show_in_upsell: boolean
}) {
  const brandId = await getAdminBrandId()
  const supabase = await createClient()
  const slug = (data.slug || toSlug(data.name_ru)).trim() || "category"
  const { error } = await supabase.from("menu_categories").insert({
    brand_id: brandId,
    name_ru: data.name_ru,
    name_ro: data.name_ro,
    sort_order: data.sort_order,
    is_active: data.is_active,
    slug,
    image_url: data.image_url?.trim() || null,
    show_in_upsell: data.show_in_upsell,
  })
  if (error) throw new Error(error.message)
  revalidatePath("/admin/categories")
}

export async function updateCategory(
  id: string,
  data: {
    name_ru: string
    name_ro: string
    slug: string
    sort_order: number
    is_active: boolean
    image_url: string | null
    show_in_upsell: boolean
  }
) {
  const brandId = await getAdminBrandId()
  const supabase = await createClient()
  const { error } = await supabase
    .from("menu_categories")
    .update({
      name_ru: data.name_ru,
      name_ro: data.name_ro,
      slug: data.slug,
      sort_order: data.sort_order,
      is_active: data.is_active,
      image_url: data.image_url?.trim() || null,
      show_in_upsell: data.show_in_upsell,
    })
    .eq("id", id)
    .eq("brand_id", brandId)
  if (error) throw new Error(error.message)
  revalidatePath("/admin/categories")
}

export async function deleteCategory(id: string) {
  const brandId = await getAdminBrandId()
  const supabase = await createClient()
  const { error } = await supabase
    .from("menu_categories")
    .delete()
    .eq("id", id)
    .eq("brand_id", brandId)
  if (error) throw new Error(error.message)
  revalidatePath("/admin/categories")
}
