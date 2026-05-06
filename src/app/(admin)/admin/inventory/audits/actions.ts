"use server"

import { getAdminBrandId } from "@/lib/get-admin-brand-id"
import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import type { Ingredient, StockAudit, StockAuditItem } from "@/types/database"

export type AuditDetailItem = StockAuditItem & {
  ingredient: { name: string; unit: Ingredient["unit"] }
}

export type AuditDetail = {
  audit: StockAudit
  items: AuditDetailItem[]
}

function firstRelation<T extends Record<string, unknown>>(rel: unknown): T | null {
  if (rel == null) return null
  if (Array.isArray(rel)) {
    const x = rel[0]
    return x != null && typeof x === "object" ? (x as T) : null
  }
  if (typeof rel === "object") return rel as T
  return null
}

async function loadAuditDetail(
  supabase: Awaited<ReturnType<typeof createClient>>,
  brandId: string,
  auditId: string
): Promise<AuditDetail> {
  const { data, error } = await supabase
    .from("stock_audits")
    .select(
      `
      id,
      brand_id,
      note,
      confirmed_at,
      created_at,
      stock_audit_items (
        id,
        audit_id,
        ingredient_id,
        expected_qty,
        actual_qty,
        diff,
        ingredients ( name, unit )
      )
    `
    )
    .eq("id", auditId)
    .eq("brand_id", brandId)
    .single()

  if (error) throw new Error(error.message)
  if (!data) throw new Error("Инвентаризация не найдена")

  type Row = {
    id: string
    brand_id: string
    note: string | null
    confirmed_at: string | null
    created_at: string
    stock_audit_items: Array<{
      id: string
      audit_id: string
      ingredient_id: string
      expected_qty: number | string
      actual_qty: number | string | null
      diff: number | string | null
      ingredients: unknown
    }> | null
  }

  const row = data as Row
  const items: AuditDetailItem[] = (row.stock_audit_items ?? []).map((it) => {
    const ing = firstRelation<{ name: string; unit: string }>(it.ingredients)
    return {
      id: it.id,
      audit_id: it.audit_id,
      ingredient_id: it.ingredient_id,
      expected_qty: Number(it.expected_qty),
      actual_qty:
        it.actual_qty === null || it.actual_qty === ""
          ? null
          : Number(it.actual_qty),
      diff:
        it.diff === null || it.diff === ""
          ? null
          : Number(it.diff),
      ingredient: {
        name: ing?.name ?? "—",
        unit: (ing?.unit ?? "g") as Ingredient["unit"],
      },
    }
  })

  return {
    audit: {
      id: row.id,
      brand_id: row.brand_id,
      note: row.note,
      confirmed_at: row.confirmed_at,
      created_at: row.created_at,
    },
    items,
  }
}

export async function createAudit(): Promise<AuditDetail> {
  const brandId = await getAdminBrandId()
  const supabase = await createClient()

  const { data: auditRow, error: auditError } = await supabase
    .from("stock_audits")
    .insert({
      brand_id: brandId,
      note: null,
      confirmed_at: null,
    })
    .select("id")
    .single()

  if (auditError) throw new Error(auditError.message)
  if (!auditRow?.id) throw new Error("Не удалось создать инвентаризацию")

  const auditId = auditRow.id

  const { data: ingredients, error: ingError } = await supabase
    .from("ingredients")
    .select("id, ingredient_stock(quantity)")
    .eq("brand_id", brandId)
    .order("name")

  if (ingError) {
    await supabase.from("stock_audits").delete().eq("id", auditId)
    throw new Error(ingError.message)
  }

  const rows = (ingredients ?? []).map((ing: unknown) => {
    const r = ing as {
      id: string
      ingredient_stock: unknown
    }
    const st = firstRelation<{ quantity: number | string }>(r.ingredient_stock)
    const q = st != null ? Number(st.quantity) : 0
    return {
      audit_id: auditId,
      ingredient_id: r.id,
      expected_qty: q,
    }
  })

  if (rows.length > 0) {
    const { error: itemsError } = await supabase
      .from("stock_audit_items")
      .insert(rows)

    if (itemsError) {
      await supabase.from("stock_audits").delete().eq("id", auditId)
      throw new Error(itemsError.message)
    }
  }

  revalidatePath("/admin/inventory/audits")
  return loadAuditDetail(supabase, brandId, auditId)
}

export async function getAuditDetail(auditId: string): Promise<AuditDetail> {
  const brandId = await getAdminBrandId()
  const supabase = await createClient()
  return loadAuditDetail(supabase, brandId, auditId)
}

export async function updateAuditItemActualQty(
  itemId: string,
  actualQty: number | null
): Promise<{ actual_qty: number | null; diff: number | null }> {
  const brandId = await getAdminBrandId()
  const supabase = await createClient()

  const { data: item, error: itemErr } = await supabase
    .from("stock_audit_items")
    .select("audit_id")
    .eq("id", itemId)
    .maybeSingle()

  if (itemErr) throw new Error(itemErr.message)
  if (!item?.audit_id) throw new Error("Строка не найдена")

  const { data: audit, error: auditErr } = await supabase
    .from("stock_audits")
    .select("brand_id, confirmed_at")
    .eq("id", item.audit_id)
    .maybeSingle()

  if (auditErr) throw new Error(auditErr.message)
  if (!audit || audit.brand_id !== brandId) {
    throw new Error("Нет доступа к инвентаризации")
  }
  if (audit.confirmed_at != null) {
    throw new Error("Инвентаризация уже подтверждена")
  }

  if (actualQty !== null && !Number.isFinite(actualQty)) {
    throw new Error("Некорректное количество")
  }

  const { data: updated, error: upErr } = await supabase
    .from("stock_audit_items")
    .update({ actual_qty: actualQty })
    .eq("id", itemId)
    .select("actual_qty, diff")
    .single()

  if (upErr) throw new Error(upErr.message)
  if (!updated) throw new Error("Не удалось сохранить строку")

  revalidatePath("/admin/inventory/audits")

  const aq =
    updated?.actual_qty === null || updated?.actual_qty === undefined
      ? null
      : Number(updated.actual_qty)
  const d =
    updated?.diff === null || updated?.diff === undefined || updated?.diff === ""
      ? null
      : Number(updated.diff)

  return { actual_qty: aq, diff: d }
}

export async function confirmAudit(auditId: string) {
  const brandId = await getAdminBrandId()
  const supabase = await createClient()

  const { data: audit, error: auditErr } = await supabase
    .from("stock_audits")
    .select("id, confirmed_at")
    .eq("id", auditId)
    .eq("brand_id", brandId)
    .maybeSingle()

  if (auditErr) throw new Error(auditErr.message)
  if (!audit) throw new Error("Инвентаризация не найдена")
  if (audit.confirmed_at != null) {
    throw new Error("Инвентаризация уже подтверждена")
  }

  const { data: items, error: itemsErr } = await supabase
    .from("stock_audit_items")
    .select("id, ingredient_id, actual_qty")
    .eq("audit_id", auditId)

  if (itemsErr) throw new Error(itemsErr.message)
  const list = items ?? []

  if (list.length === 0) {
    throw new Error("Нет позиций для подтверждения")
  }

  for (const row of list) {
    if (row.actual_qty === null || row.actual_qty === undefined) {
      throw new Error("Заполните факт по всем позициям")
    }
  }

  const ts = new Date().toISOString()

  for (const row of list) {
    const actual = Number(row.actual_qty)
    if (!Number.isFinite(actual)) {
      throw new Error("Некорректное фактическое количество")
    }

    const { error: stErr } = await supabase
      .from("ingredient_stock")
      .update({ quantity: actual, updated_at: ts })
      .eq("ingredient_id", row.ingredient_id)

    if (stErr) throw new Error(stErr.message)
  }

  const { error: finErr } = await supabase
    .from("stock_audits")
    .update({ confirmed_at: ts })
    .eq("id", auditId)
    .eq("brand_id", brandId)

  if (finErr) throw new Error(finErr.message)

  revalidatePath("/admin/inventory/audits")
  revalidatePath("/admin/inventory/ingredients")
}
