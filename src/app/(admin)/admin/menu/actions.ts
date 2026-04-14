"use server"

import { createClient } from "@/lib/supabase/server"
import type { ToppingGroup } from "@/types/database"
import { revalidatePath } from "next/cache"

export async function getToppingGroups(): Promise<ToppingGroup[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("topping_groups")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as ToppingGroup[]
}

export async function getMenuItemToppingGroups(
  menuItemId: string
): Promise<string[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("menu_item_topping_groups")
    .select("topping_group_id")
    .eq("menu_item_id", menuItemId)
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => row.topping_group_id as string)
}

export async function setMenuItemToppingGroups(
  menuItemId: string,
  groupIds: string[]
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
  revalidatePath("/admin/menu")
}

export async function createMenuItem(data: {
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
}): Promise<string> {
  const supabase = await createClient()
  const { data: row, error } = await supabase
    .from("menu_items")
    .insert({
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
    })
    .select("id")
    .single()
  if (error) throw new Error(error.message)
  revalidatePath("/admin/menu")
  revalidatePath("/")
  return row.id as string
}

export async function updateMenuItem(
  id: string,
  data: {
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
  }
) {
  const supabase = await createClient()
  const { error } = await supabase
    .from("menu_items")
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
    })
    .eq("id", id)
  if (error) throw new Error(error.message)
  revalidatePath("/admin/menu")
  revalidatePath("/")
}

export async function deleteMenuItem(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from("menu_items").delete().eq("id", id)
  if (error) throw new Error(error.message)
  revalidatePath("/admin/menu")
  revalidatePath("/")
}
