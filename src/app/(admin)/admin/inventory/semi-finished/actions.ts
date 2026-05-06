"use server"

import { getAdminBrandId } from "@/lib/get-admin-brand-id"
import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export type SemiFinishedPayload = {
  name: string
  yield_qty: number
  yield_unit: "g" | "ml" | "pcs"
}

export type SemiFinishedItemInput = {
  ingredient_id: string
  quantity: number
}

function assertValidItems(items: SemiFinishedItemInput[]) {
  const ids = items.map((i) => i.ingredient_id).filter(Boolean)
  if (ids.length === 0) {
    throw new Error("Добавьте хотя бы один ингредиент")
  }
  const unique = new Set(ids)
  if (unique.size !== ids.length) {
    throw new Error("Один и тот же ингредиент указан дважды")
  }
  for (const row of items) {
    if (!Number.isFinite(row.quantity) || row.quantity <= 0) {
      throw new Error("Укажите положительное количество для каждого ингредиента")
    }
  }
}

export async function createSemiFinished(
  payload: SemiFinishedPayload,
  items: SemiFinishedItemInput[]
) {
  const cleaned = items.filter((i) => i.ingredient_id.trim() !== "")
  assertValidItems(cleaned)
  const brandId = await getAdminBrandId()
  const supabase = await createClient()

  const { data: row, error } = await supabase
    .from("semi_finished")
    .insert({
      brand_id: brandId,
      name: payload.name.trim(),
      yield_qty: payload.yield_qty,
      yield_unit: payload.yield_unit,
    })
    .select("id")
    .single()

  if (error) throw new Error(error.message)

  const rows = cleaned.map((i) => ({
    semi_finished_id: row.id,
    ingredient_id: i.ingredient_id,
    quantity: i.quantity,
  }))

  const { error: itemsError } = await supabase
    .from("semi_finished_items")
    .insert(rows)

  if (itemsError) throw new Error(itemsError.message)
  revalidatePath("/admin/inventory/semi-finished")
}

export async function updateSemiFinished(
  id: string,
  payload: SemiFinishedPayload,
  items: SemiFinishedItemInput[]
) {
  const cleaned = items.filter((i) => i.ingredient_id.trim() !== "")
  assertValidItems(cleaned)
  const brandId = await getAdminBrandId()
  const supabase = await createClient()

  const { error: upError } = await supabase
    .from("semi_finished")
    .update({
      name: payload.name.trim(),
      yield_qty: payload.yield_qty,
      yield_unit: payload.yield_unit,
    })
    .eq("id", id)
    .eq("brand_id", brandId)

  if (upError) throw new Error(upError.message)

  const { error: delError } = await supabase
    .from("semi_finished_items")
    .delete()
    .eq("semi_finished_id", id)

  if (delError) throw new Error(delError.message)

  const rows = cleaned.map((i) => ({
    semi_finished_id: id,
    ingredient_id: i.ingredient_id,
    quantity: i.quantity,
  }))

  const { error: insError } = await supabase
    .from("semi_finished_items")
    .insert(rows)

  if (insError) throw new Error(insError.message)
  revalidatePath("/admin/inventory/semi-finished")
}

export async function deleteSemiFinished(id: string) {
  const brandId = await getAdminBrandId()
  const supabase = await createClient()
  const { error } = await supabase
    .from("semi_finished")
    .delete()
    .eq("id", id)
    .eq("brand_id", brandId)

  if (error) throw new Error(error.message)
  revalidatePath("/admin/inventory/semi-finished")
}
