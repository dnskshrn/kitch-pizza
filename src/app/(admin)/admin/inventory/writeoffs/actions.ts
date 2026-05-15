"use server"

import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

export type CreateWriteoffItemInput = {
  ingredient_id: string
  /** Количество в единицах хранения БД (г / мл / шт) */
  quantity: number
}

export type CreateWriteoffInput = {
  /** YYYY-MM-DD */
  date: string
  reason: string
  note: string | null
  items: CreateWriteoffItemInput[]
}

const VALID_REASONS = new Set([
  "waste",
  "spoilage",
  "tasting",
  "staff_meal",
  "other",
])

export async function createWriteoff(payload: CreateWriteoffInput) {
  const supabase = createServiceRoleClient()

  const dateStr = (payload.date ?? "").trim()
  if (!dateStr) {
    throw new Error("Укажите дату")
  }

  const reason = (payload.reason ?? "").trim()
  if (!reason || !VALID_REASONS.has(reason)) {
    throw new Error("Выберите причину списания")
  }

  const noteRaw = payload.note != null ? String(payload.note).trim() : ""
  const note = noteRaw !== "" ? noteRaw : null

  const itemsRaw = payload.items ?? []
  if (itemsRaw.length === 0) {
    throw new Error("Добавьте хотя бы одну позицию")
  }

  const normalized: { ingredient_id: string; quantity: number }[] = []
  for (const row of itemsRaw) {
    const ingredientId = (row.ingredient_id ?? "").trim()
    const qty = Number(row.quantity)
    if (!ingredientId) continue
    if (!Number.isFinite(qty) || qty <= 0) {
      throw new Error("Количество должно быть больше нуля в каждой заполненной строке")
    }
    normalized.push({ ingredient_id: ingredientId, quantity: qty })
  }

  if (normalized.length === 0) {
    throw new Error("Добавьте хотя бы одну позицию с ингредиентом")
  }

  const ingredientIds = [...new Set(normalized.map((n) => n.ingredient_id))]

  const { data: ingRows, error: ingError } = await supabase
    .from("ingredients")
    .select("id")
    .in("id", ingredientIds)

  if (ingError) throw new Error(ingError.message)
  if (!ingRows || ingRows.length !== ingredientIds.length) {
    throw new Error("Один или несколько ингредиентов не найдены")
  }

  const { data: stockRows, error: stockErr } = await supabase
    .from("ingredient_stock")
    .select("ingredient_id, quantity, avg_cost")
    .in("ingredient_id", ingredientIds)

  if (stockErr) throw new Error(stockErr.message)
  if (!stockRows || stockRows.length !== ingredientIds.length) {
    throw new Error("Нет данных об остатках для одного или нескольких ингредиентов")
  }

  const stockMap = new Map<
    string,
    { quantity: number; avg_cost: number }
  >()
  for (const s of stockRows) {
    stockMap.set(s.ingredient_id, {
      quantity: Number(s.quantity),
      avg_cost: Number(s.avg_cost ?? 0),
    })
  }

  const needByIngredient = new Map<string, number>()
  for (const n of normalized) {
    needByIngredient.set(
      n.ingredient_id,
      (needByIngredient.get(n.ingredient_id) ?? 0) + n.quantity
    )
  }

  for (const [ingId, need] of needByIngredient) {
    const st = stockMap.get(ingId)
    if (!st) throw new Error("Нет данных об остатке")
    if (st.quantity < need) {
      throw new Error("Недостаточно остатка для одного из ингредиентов")
    }
  }

  const { data: writeoffRow, error: woError } = await supabase
    .from("stock_writeoffs")
    .insert({
      date: dateStr,
      reason,
      note,
      brand_id: null,
    })
    .select("id")
    .single()

  if (woError || !writeoffRow) {
    if (woError) throw new Error(woError.message)
    throw new Error("Не удалось создать списание")
  }

  const writeoffId = writeoffRow.id

  const itemRows = normalized.map((n) => {
    const st = stockMap.get(n.ingredient_id)
    if (!st) throw new Error("Нет данных об остатке")
    return {
      writeoff_id: writeoffId,
      ingredient_id: n.ingredient_id,
      quantity: n.quantity,
      cost_per_unit: st.avg_cost,
    }
  })

  const { error: itemsError } = await supabase
    .from("stock_writeoff_items")
    .insert(itemRows)

  if (itemsError) {
    await supabase.from("stock_writeoffs").delete().eq("id", writeoffId)
    throw new Error(itemsError.message)
  }

  const ts = new Date().toISOString()

  for (const n of normalized) {
    const st = stockMap.get(n.ingredient_id)
    if (!st) throw new Error("Нет данных об остатке")

    const newQty = st.quantity - n.quantity
    st.quantity = newQty

    const { error: stockUpError } = await supabase
      .from("ingredient_stock")
      .update({
        quantity: newQty,
        updated_at: ts,
      })
      .eq("ingredient_id", n.ingredient_id)

    if (stockUpError) throw new Error(stockUpError.message)

    const { error: ledgerError } = await supabase.from("stock_ledger").insert({
      ingredient_id: n.ingredient_id,
      movement_type: "writeoff",
      reference_id: writeoffId,
      reference_type: "stock_writeoff",
      quantity_delta: -n.quantity,
      cost_per_unit: st.avg_cost,
      note: null,
    })

    if (ledgerError) throw new Error(ledgerError.message)
  }

  revalidatePath("/admin/inventory/writeoffs")
  revalidatePath("/admin/inventory/stock")
  revalidatePath("/admin/inventory/ingredients")
  revalidatePath("/admin/finance/ledger")

  redirect("/admin/inventory/writeoffs")
}
