"use server"

import { getAdminBrandId } from "@/lib/get-admin-brand-id"
import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

const revalidateToppings = () => revalidatePath("/admin/toppings")

export async function createToppingGroup(data: {
  name_ru: string
  name_ro: string
  sort_order: number
  is_active: boolean
}) {
  const brandId = await getAdminBrandId()
  const supabase = await createClient()
  const { error } = await supabase.from("topping_groups").insert({
    brand_id: brandId,
    name_ru: data.name_ru.trim(),
    name_ro: data.name_ro.trim(),
    sort_order: data.sort_order,
    is_active: data.is_active,
  })
  if (error) throw new Error(error.message)
  revalidateToppings()
}

export async function updateToppingGroup(
  id: string,
  data: {
    name_ru: string
    name_ro: string
    sort_order: number
    is_active: boolean
  }
) {
  const brandId = await getAdminBrandId()
  const supabase = await createClient()
  const { error } = await supabase
    .from("topping_groups")
    .update({
      name_ru: data.name_ru.trim(),
      name_ro: data.name_ro.trim(),
      sort_order: data.sort_order,
      is_active: data.is_active,
    })
    .eq("id", id)
    .eq("brand_id", brandId)
  if (error) throw new Error(error.message)
  revalidateToppings()
}

export async function deleteToppingGroup(id: string) {
  const brandId = await getAdminBrandId()
  const supabase = await createClient()
  const { error: linkErr } = await supabase
    .from("menu_item_topping_groups")
    .delete()
    .eq("topping_group_id", id)
  if (linkErr) throw new Error(linkErr.message)
  const { error: topErr } = await supabase
    .from("toppings")
    .delete()
    .eq("group_id", id)
    .eq("brand_id", brandId)
  if (topErr) throw new Error(topErr.message)
  const { error } = await supabase
    .from("topping_groups")
    .delete()
    .eq("id", id)
    .eq("brand_id", brandId)
  if (error) throw new Error(error.message)
  revalidateToppings()
}

export async function createTopping(data: {
  group_id: string
  name_ru: string
  name_ro: string
  price: number
  sort_order: number
  is_active: boolean
  image_url: string | null
}) {
  const brandId = await getAdminBrandId()
  const supabase = await createClient()
  const { error } = await supabase.from("toppings").insert({
    brand_id: brandId,
    group_id: data.group_id,
    name_ru: data.name_ru.trim(),
    name_ro: data.name_ro.trim(),
    price: data.price,
    sort_order: data.sort_order,
    is_active: data.is_active,
    image_url: data.image_url,
  })
  if (error) throw new Error(error.message)
  revalidateToppings()
}

export async function updateTopping(
  id: string,
  data: {
    group_id: string
    name_ru: string
    name_ro: string
    price: number
    sort_order: number
    is_active: boolean
    image_url: string | null
  }
) {
  const brandId = await getAdminBrandId()
  const supabase = await createClient()
  const { error } = await supabase
    .from("toppings")
    .update({
      group_id: data.group_id,
      name_ru: data.name_ru.trim(),
      name_ro: data.name_ro.trim(),
      price: data.price,
      sort_order: data.sort_order,
      is_active: data.is_active,
      image_url: data.image_url,
    })
    .eq("id", id)
    .eq("brand_id", brandId)
  if (error) throw new Error(error.message)
  revalidateToppings()
}

export async function deleteTopping(id: string) {
  const brandId = await getAdminBrandId()
  const supabase = await createClient()
  const { error } = await supabase
    .from("toppings")
    .delete()
    .eq("id", id)
    .eq("brand_id", brandId)
  if (error) throw new Error(error.message)
  revalidateToppings()
}
