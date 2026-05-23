"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export type SemiFinishedPayload = {
  name: string
  yield_qty: number
  yield_unit: "g" | "ml" | "pcs"
}

export type SemiFinishedItemInput = {
  ingredient_id: string | null
  semi_finished_ref_id: string | null
  quantity: number
}

function itemRefKey(row: SemiFinishedItemInput): string | null {
  const ing = (row.ingredient_id ?? "").trim()
  const semi = (row.semi_finished_ref_id ?? "").trim()
  if (ing && semi) return null
  if (ing) return `ing:${ing}`
  if (semi) return `semi:${semi}`
  return null
}

function assertValidItems(items: SemiFinishedItemInput[]) {
  if (items.length === 0) {
    throw new Error("Добавьте хотя бы один компонент состава")
  }

  const keys: string[] = []
  for (const row of items) {
    const key = itemRefKey(row)
    if (!key) {
      throw new Error("У каждой строки должен быть выбран ингредиент или полуфабрикат")
    }
    keys.push(key)
  }

  const unique = new Set(keys)
  if (unique.size !== keys.length) {
    throw new Error("Один и тот же компонент указан дважды")
  }

  for (const row of items) {
    if (!Number.isFinite(row.quantity) || row.quantity <= 0) {
      throw new Error("Укажите положительное количество для каждой строки")
    }
  }
}

export async function createSemiFinished(
  payload: SemiFinishedPayload,
  items: SemiFinishedItemInput[]
) {
  const cleaned = items.filter((i) => itemRefKey(i) != null)
  assertValidItems(cleaned)
  const supabase = await createClient()

  const { data: row, error } = await supabase
    .from("semi_finished")
    .insert({
      name: payload.name.trim(),
      yield_qty: payload.yield_qty,
      yield_unit: payload.yield_unit,
    })
    .select("id")
    .single()

  if (error) throw new Error(error.message)

  const rows = cleaned.map((i) => ({
    semi_finished_id: row.id,
    ingredient_id: (i.ingredient_id ?? "").trim() || null,
    semi_finished_ref_id: (i.semi_finished_ref_id ?? "").trim() || null,
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
  const cleaned = items.filter((i) => itemRefKey(i) != null)
  assertValidItems(cleaned)
  const supabase = await createClient()

  const { error: upError } = await supabase
    .from("semi_finished")
    .update({
      name: payload.name.trim(),
      yield_qty: payload.yield_qty,
      yield_unit: payload.yield_unit,
    })
    .eq("id", id)

  if (upError) throw new Error(upError.message)

  const { error: delError } = await supabase
    .from("semi_finished_items")
    .delete()
    .eq("semi_finished_id", id)

  if (delError) throw new Error(delError.message)

  const rows = cleaned.map((i) => ({
    semi_finished_id: id,
    ingredient_id: (i.ingredient_id ?? "").trim() || null,
    semi_finished_ref_id: (i.semi_finished_ref_id ?? "").trim() || null,
    quantity: i.quantity,
  }))

  const { error: insError } = await supabase
    .from("semi_finished_items")
    .insert(rows)

  if (insError) throw new Error(insError.message)
  revalidatePath("/admin/inventory/semi-finished")
}

export async function deleteSemiFinished(id: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from("semi_finished")
    .delete()
    .eq("id", id)

  if (error) throw new Error(error.message)
  revalidatePath("/admin/inventory/semi-finished")
}
