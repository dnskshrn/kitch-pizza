"use server"

import { getAdminBrandId } from "@/lib/get-admin-brand-id"
import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export type CondimentMenuItemPayload = {
  category_id: string
  name_ru: string
  name_ro: string
  description_ru: string
  description_ro: string
  image_url: string
  has_sizes: boolean
  weight_grams: number | null
  size_s_weight: number | null
  size_l_weight: number | null
  price: number | null
  size_s_label: string | null
  size_l_label: string | null
  size_s_price: number | null
  size_l_price: number | null
  is_active: boolean
  sort_order: number
  discount_percent: number | null
  tag: string | null
  is_default_condiment: boolean
  condiment_default_qty: number
}

export async function ensureCondimentCategory(): Promise<string> {
  const brandId = await getAdminBrandId()
  const supabase = await createClient()

  const { data: existing, error: selErr } = await (
    supabase.from("menu_categories") as any
  )
    .select("id")
    .eq("brand_id", brandId)
    .eq("is_condiment", true)
    .limit(1)
    .maybeSingle()

  if (selErr) throw new Error(selErr.message)
  const existingId = existing as { id: string } | null
  if (existingId?.id) return existingId.id

  const { data: inserted, error: insErr } = await (
    supabase.from("menu_categories") as any
  )
    .insert({
      brand_id: brandId,
      name_ru: "Кондименты",
      name_ro: "Condimente",
      slug: "condiments",
      is_condiment: true,
      sort_order: 999,
      is_active: true,
    })
    .select("id")
    .single()

  if (insErr || !inserted) throw new Error(insErr?.message ?? "insert failed")
  revalidatePath("/admin/condiments")
  revalidatePath("/admin/categories")
  return (inserted as { id: string }).id
}

export async function setCondimentMenuItemToppingGroups(
  menuItemId: string,
  groupIds: string[],
): Promise<void> {
  const supabase = await createClient()
  const { error: delErr } = await supabase
    .from("menu_item_topping_groups")
    .delete()
    .eq("menu_item_id", menuItemId)
  if (delErr) throw new Error(delErr.message)
  if (groupIds.length > 0) {
    const rows = groupIds.map((topping_group_id) => ({
      menu_item_id: menuItemId,
      topping_group_id,
    }))
    const { error: insErr } = await supabase
      .from("menu_item_topping_groups")
      .insert(rows)
    if (insErr) throw new Error(insErr.message)
  }
  revalidatePath("/admin/condiments")
}

export async function createCondimentMenuItem(
  data: CondimentMenuItemPayload,
): Promise<string> {
  const brandId = await getAdminBrandId()
  const supabase = await createClient()
  const { data: row, error } = await (supabase.from("menu_items") as any)
    .insert({
      brand_id: brandId,
      category_id: data.category_id,
      name_ru: data.name_ru,
      name_ro: data.name_ro,
      description_ru: data.description_ru.trim() || null,
      description_ro: data.description_ro.trim() || null,
      image_url: data.image_url.trim() || null,
      has_sizes: data.has_sizes,
      weight_grams: data.weight_grams,
      size_s_weight: data.size_s_weight,
      size_l_weight: data.size_l_weight,
      price: data.price,
      size_s_label: data.size_s_label,
      size_l_label: data.size_l_label,
      size_s_price: data.size_s_price,
      size_l_price: data.size_l_price,
      is_active: data.is_active,
      sort_order: data.sort_order,
      discount_percent: data.discount_percent,
      tag: data.tag,
      is_default_condiment: data.is_default_condiment,
      condiment_default_qty: data.condiment_default_qty,
      included_items: null,
    })
    .select("id")
    .single()
  if (error) throw new Error(error.message)
  revalidatePath("/admin/condiments")
  revalidatePath("/")
  return row.id as string
}

export async function updateCondimentMenuItem(
  id: string,
  data: CondimentMenuItemPayload,
  included_items: unknown | null,
) {
  const brandId = await getAdminBrandId()
  const supabase = await createClient()
  const { error } = await (supabase.from("menu_items") as any)
    .update({
      category_id: data.category_id,
      name_ru: data.name_ru,
      name_ro: data.name_ro,
      description_ru: data.description_ru.trim() || null,
      description_ro: data.description_ro.trim() || null,
      image_url: data.image_url.trim() || null,
      has_sizes: data.has_sizes,
      weight_grams: data.weight_grams,
      size_s_weight: data.size_s_weight,
      size_l_weight: data.size_l_weight,
      price: data.price,
      size_s_label: data.size_s_label,
      size_l_label: data.size_l_label,
      size_s_price: data.size_s_price,
      size_l_price: data.size_l_price,
      is_active: data.is_active,
      sort_order: data.sort_order,
      discount_percent: data.discount_percent,
      tag: data.tag,
      is_default_condiment: data.is_default_condiment,
      condiment_default_qty: data.condiment_default_qty,
      included_items: included_items ?? null,
    })
    .eq("id", id)
    .eq("brand_id", brandId)
  if (error) throw new Error(error.message)
  revalidatePath("/admin/condiments")
  revalidatePath("/")
}

export async function deleteCondimentMenuItem(id: string) {
  const brandId = await getAdminBrandId()
  const supabase = await createClient()
  const { error } = await supabase
    .from("menu_items")
    .delete()
    .eq("id", id)
    .eq("brand_id", brandId)
  if (error) throw new Error(error.message)
  revalidatePath("/admin/condiments")
  revalidatePath("/")
}
