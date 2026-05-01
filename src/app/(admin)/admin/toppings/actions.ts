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
  /** null — без ограничения; иначе максимум выбранных топпингов из группы. */
  max_selections: number | null
}) {
  const brandId = await getAdminBrandId()
  const supabase = await createClient()
  const { error } = await supabase.from("topping_groups").insert({
    brand_id: brandId,
    name_ru: data.name_ru.trim(),
    name_ro: data.name_ro.trim(),
    sort_order: data.sort_order,
    is_active: data.is_active,
    max_selections: data.max_selections,
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
    max_selections: number | null
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
      max_selections: data.max_selections,
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

export async function copyToppingToGroup(data: {
  topping_id: string
  group_id: string
}) {
  const brandId = await getAdminBrandId()
  const supabase = await createClient()

  const { data: topping, error: readError } = await supabase
    .from("toppings")
    .select("name_ru, name_ro, price, sort_order, is_active, image_url")
    .eq("id", data.topping_id)
    .eq("brand_id", brandId)
    .maybeSingle()

  if (readError) throw new Error(readError.message)
  if (!topping) throw new Error("Топпинг не найден")

  const { data: group, error: groupError } = await supabase
    .from("topping_groups")
    .select("id")
    .eq("id", data.group_id)
    .eq("brand_id", brandId)
    .maybeSingle()

  if (groupError) throw new Error(groupError.message)
  if (!group) throw new Error("Группа топпингов не найдена")

  const { data: existing, error: existingError } = await supabase
    .from("toppings")
    .select("id")
    .eq("brand_id", brandId)
    .eq("group_id", data.group_id)
    .eq("name_ru", topping.name_ru)
    .eq("name_ro", topping.name_ro)
    .eq("price", topping.price)
    .maybeSingle()

  if (existingError) throw new Error(existingError.message)
  if (existing) throw new Error("Такой топпинг уже есть в выбранной группе")

  const { error } = await supabase.from("toppings").insert({
    brand_id: brandId,
    group_id: data.group_id,
    name_ru: topping.name_ru,
    name_ro: topping.name_ro,
    price: topping.price,
    sort_order: topping.sort_order,
    is_active: topping.is_active,
    image_url: topping.image_url,
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
