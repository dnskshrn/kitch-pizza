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

export type ToppingRecipeLinePayload = {
  ingredient_id: string | null
  semi_finished_id: string | null
  quantity: number
  quantity_gross: number | null
}

export async function createTopping(data: {
  group_id: string
  name_ru: string
  name_ro: string
  price: number
  sort_order: number
  is_active: boolean
  image_url: string | null
  recipe_lines: ToppingRecipeLinePayload[]
}) {
  const brandId = await getAdminBrandId()
  const supabase = await createClient()
  const { error } = await (supabase as any).rpc("save_topping_with_recipes", {
    p_is_create: true,
    p_topping_id: null,
    p_brand_id: brandId,
    p_group_id: data.group_id,
    p_name_ru: data.name_ru.trim(),
    p_name_ro: data.name_ro.trim(),
    p_price: data.price,
    p_sort_order: data.sort_order,
    p_is_active: data.is_active,
    p_image_url: data.image_url,
    p_recipe_lines: data.recipe_lines,
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

  const { data: newTopping, error } = await supabase
    .from("toppings")
    .insert({
      brand_id: brandId,
      group_id: data.group_id,
      name_ru: topping.name_ru,
      name_ro: topping.name_ro,
      price: topping.price,
      sort_order: topping.sort_order,
      is_active: topping.is_active,
      image_url: topping.image_url,
    })
    .select("id")
    .single()

  if (error) throw new Error(error.message)

  const { data: srcLines, error: srcLinesErr } = await (
    supabase.from("topping_recipes") as any
  )
    .select("ingredient_id, semi_finished_id, quantity, quantity_gross")
    .eq("topping_id", data.topping_id)

  if (srcLinesErr) throw new Error(srcLinesErr.message)

  const rows = (srcLines ?? []) as {
    ingredient_id: string | null
    semi_finished_id: string | null
    quantity: number
    quantity_gross: number | null
  }[]

  if (rows.length > 0) {
    const { error: insRecErr } = await (supabase.from("topping_recipes") as any).insert(
      rows.map((l) => ({
        topping_id: newTopping.id,
        ingredient_id: l.ingredient_id,
        semi_finished_id: l.semi_finished_id,
        quantity: l.quantity,
        quantity_gross: l.quantity_gross,
      })),
    )
    if (insRecErr) throw new Error(insRecErr.message)
  }

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
    recipe_lines: ToppingRecipeLinePayload[]
  }
) {
  const brandId = await getAdminBrandId()
  const supabase = await createClient()
  const { error } = await (supabase as any).rpc("save_topping_with_recipes", {
    p_is_create: false,
    p_topping_id: id,
    p_brand_id: brandId,
    p_group_id: data.group_id,
    p_name_ru: data.name_ru.trim(),
    p_name_ro: data.name_ro.trim(),
    p_price: data.price,
    p_sort_order: data.sort_order,
    p_is_active: data.is_active,
    p_image_url: data.image_url,
    p_recipe_lines: data.recipe_lines,
  })
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
