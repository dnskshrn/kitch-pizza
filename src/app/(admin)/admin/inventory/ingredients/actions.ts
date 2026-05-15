"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export type IngredientPayload = {
  name: string
  unit: "g" | "ml" | "pcs"
  /** FK на `ingredient_categories`; null — без категории */
  category_id: string | null
  /** 0–100, один знак после запятой допустим */
  waste_percent: number
}

export async function createIngredient(payload: IngredientPayload) {
  const supabase = await createClient()

  const { data: row, error } = await supabase
    .from("ingredients")
    .insert({
      name: payload.name.trim(),
      unit: payload.unit,
      category_id: payload.category_id,
      waste_percent: payload.waste_percent,
    })
    .select("id")
    .single()

  if (error) throw new Error(error.message)

  const ts = new Date().toISOString()
  const { error: stockError } = await supabase.from("ingredient_stock").insert({
    ingredient_id: row.id,
    quantity: 0,
    avg_cost: 0,
    updated_at: ts,
  })

  if (stockError) throw new Error(stockError.message)
  revalidatePath("/admin/inventory/ingredients")
}

export async function updateIngredient(id: string, payload: IngredientPayload) {
  const supabase = await createClient()

  const { error } = await supabase
    .from("ingredients")
    .update({
      name: payload.name.trim(),
      unit: payload.unit,
      category_id: payload.category_id,
      waste_percent: payload.waste_percent,
    })
    .eq("id", id)

  if (error) throw new Error(error.message)

  revalidatePath("/admin/inventory/ingredients")
}
