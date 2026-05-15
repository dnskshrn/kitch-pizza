"use server"

import { createServiceSupabaseClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export type IngredientCategory = {
  id: string
  name: string
  sort_order: number
}

export async function getIngredientCategories(): Promise<
  { data: IngredientCategory[] } | { error: string }
> {
  const supabase = createServiceSupabaseClient()
  const { data, error } = await supabase
    .from("ingredient_categories")
    .select("id, name, sort_order")
    .order("sort_order", { ascending: true })

  if (error) return { error: error.message }
  return { data: (data ?? []) as IngredientCategory[] }
}

export async function createIngredientCategory(
  name: string,
  sort_order: number
): Promise<{ error?: string }> {
  const trimmed = (name ?? "").trim()
  if (!trimmed) return { error: "Укажите название" }
  const order = Number(sort_order)
  if (!Number.isFinite(order)) return { error: "Некорректный порядок сортировки" }

  const supabase = createServiceSupabaseClient()
  const { error } = await supabase.from("ingredient_categories").insert({
    name: trimmed,
    sort_order: Math.trunc(order),
  })

  if (error) return { error: error.message }
  revalidatePath("/admin/inventory/ingredient-categories")
  return {}
}

export async function updateIngredientCategory(
  id: string,
  name: string,
  sort_order: number
): Promise<{ error?: string }> {
  const trimmed = (name ?? "").trim()
  if (!trimmed) return { error: "Укажите название" }
  const order = Number(sort_order)
  if (!Number.isFinite(order)) return { error: "Некорректный порядок сортировки" }

  const supabase = createServiceSupabaseClient()
  const { error } = await supabase
    .from("ingredient_categories")
    .update({ name: trimmed, sort_order: Math.trunc(order) })
    .eq("id", id)

  if (error) return { error: error.message }
  revalidatePath("/admin/inventory/ingredient-categories")
  return {}
}

export async function deleteIngredientCategory(
  id: string
): Promise<{ error?: string }> {
  const supabase = createServiceSupabaseClient()

  const { error: clearError } = await supabase
    .from("ingredients")
    .update({ category_id: null })
    .eq("category_id", id)

  if (clearError) return { error: clearError.message }

  const { error } = await supabase
    .from("ingredient_categories")
    .delete()
    .eq("id", id)

  if (error) return { error: error.message }
  revalidatePath("/admin/inventory/ingredient-categories")
  revalidatePath("/admin/inventory/ingredients")
  return {}
}
