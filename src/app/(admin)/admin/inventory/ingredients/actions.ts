"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export type IngredientPayload = {
  name: string
  unit: "g" | "ml" | "pcs"
}

export async function createIngredient(payload: IngredientPayload) {
  const supabase = await createClient()

  const { data: row, error } = await supabase
    .from("ingredients")
    .insert({
      name: payload.name.trim(),
      unit: payload.unit,
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
    })
    .eq("id", id)

  if (error) throw new Error(error.message)

  revalidatePath("/admin/inventory/ingredients")
}
