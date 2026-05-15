"use server"

import { createServiceSupabaseClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export async function updateAuditItem(
  itemId: string,
  actualQty: number | null
): Promise<void> {
  const supabase = createServiceSupabaseClient()

  const { data: item, error: itemErr } = await supabase
    .from("stock_audit_items")
    .select("audit_id")
    .eq("id", itemId)
    .maybeSingle()

  if (itemErr) throw new Error(itemErr.message)
  if (!item?.audit_id) throw new Error("Строка не найдена")

  const { data: audit, error: auditErr } = await supabase
    .from("stock_audits")
    .select("confirmed_at")
    .eq("id", item.audit_id)
    .maybeSingle()

  if (auditErr) throw new Error(auditErr.message)
  if (!audit) throw new Error("Инвентаризация не найдена")
  if (audit.confirmed_at != null) {
    throw new Error("Инвентаризация уже подтверждена")
  }

  if (actualQty !== null && !Number.isFinite(actualQty)) {
    throw new Error("Некорректное количество")
  }

  const { error: upErr } = await supabase
    .from("stock_audit_items")
    .update({ actual_qty: actualQty })
    .eq("id", itemId)

  if (upErr) throw new Error(upErr.message)

  revalidatePath("/admin/inventory/audits")
  revalidatePath(`/admin/inventory/audits/${item.audit_id}`)
}

export async function confirmAudit(auditId: string): Promise<void> {
  const supabase = createServiceSupabaseClient()

  const { data: audit, error: auditErr } = await supabase
    .from("stock_audits")
    .select("id, confirmed_at")
    .eq("id", auditId)
    .maybeSingle()

  if (auditErr) throw new Error(auditErr.message)
  if (!audit) throw new Error("Инвентаризация не найдена")
  if (audit.confirmed_at != null) {
    throw new Error("Инвентаризация уже подтверждена")
  }

  const { data: fetchedAuditItems, error: itemsErr } = await supabase
    .from("stock_audit_items")
    .select("id, ingredient_id, actual_qty, diff")
    .eq("audit_id", auditId)

  if (itemsErr) throw new Error(itemsErr.message)

  const items = fetchedAuditItems ?? []
  if (items.length === 0) {
    throw new Error("Нет позиций для подтверждения")
  }

  for (const item of items) {
    if (item.actual_qty === null || item.actual_qty === undefined) {
      throw new Error("Заполните факт по всем позициям")
    }
  }

  const { data: stockData } = await supabase
    .from("ingredient_stock")
    .select("ingredient_id, avg_cost")
    .in(
      "ingredient_id",
      items.map((i) => i.ingredient_id),
    )

  const avgCostMap = Object.fromEntries(
    stockData?.map((s) => [s.ingredient_id, s.avg_cost ?? 0]) ?? [],
  )

  const ts = new Date().toISOString()

  for (const item of items) {
    const actual = Number(item.actual_qty)
    if (!Number.isFinite(actual)) {
      throw new Error("Некорректное фактическое количество")
    }

    const costPerUnit = avgCostMap[item.ingredient_id] ?? 0
    const diffCost =
      item.diff != null ? item.diff * costPerUnit : null

    const { error: itemCostErr } = await supabase
      .from("stock_audit_items")
      .update({ cost_per_unit: costPerUnit, diff_cost: diffCost })
      .eq("id", item.id)

    if (itemCostErr) throw new Error(itemCostErr.message)

    const { error: stErr } = await supabase
      .from("ingredient_stock")
      .update({ quantity: actual, updated_at: ts })
      .eq("ingredient_id", item.ingredient_id)

    if (stErr) throw new Error(stErr.message)

    const diff =
      item.diff === null || item.diff === undefined || item.diff === ""
        ? null
        : Number(item.diff)

    if (diff === null || !Number.isFinite(diff) || diff === 0) {
      continue
    }

    const { error: ledgerErr } = await supabase.from("stock_ledger").insert({
      ingredient_id: item.ingredient_id,
      movement_type: "audit_adjustment",
      reference_id: auditId,
      reference_type: "stock_audit",
      quantity_delta: diff,
      cost_per_unit: costPerUnit,
      note: null,
    })

    if (ledgerErr) throw new Error(ledgerErr.message)
  }

  const { error: finErr } = await supabase
    .from("stock_audits")
    .update({ confirmed_at: ts })
    .eq("id", auditId)

  if (finErr) throw new Error(finErr.message)

  revalidatePath("/admin/inventory/audits")
  revalidatePath(`/admin/inventory/audits/${auditId}`)
}
