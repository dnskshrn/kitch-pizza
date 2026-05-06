import { getAdminBrandId } from "@/lib/get-admin-brand-id"
import { createClient } from "@/lib/supabase/server"
import type { Ingredient, IngredientStock, IngredientWithStock } from "@/types/database"
import { displayUnit, toDisplayPrice } from "@/lib/inventory-units"
import { StockOverview, type StockOverviewRow } from "./stock-overview"

function costPerUnitLabel(row: IngredientWithStock): string {
  const st = row.ingredient_stock
  if (!st) return "—"
  const v = Number(st.avg_cost)
  if (!Number.isFinite(v) || v <= 0) return "—"
  const display = toDisplayPrice(v, row.unit)
  const num = new Intl.NumberFormat("ro-MD", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  }).format(display)
  return `${num} MDL/${displayUnit(row.unit)}`
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

function normalizeRow(raw: unknown): IngredientWithStock {
  const r = raw as Ingredient & { ingredient_stock: unknown }
  const stRaw = firstRelation<IngredientStock>(r.ingredient_stock)
  const st: IngredientStock | null = stRaw
    ? {
        ingredient_id: String(stRaw.ingredient_id),
        quantity: Number(stRaw.quantity),
        updated_at: String(stRaw.updated_at),
        avg_cost: (() => {
          const v = Number((stRaw as { avg_cost?: unknown }).avg_cost)
          return Number.isFinite(v) ? v : 0
        })(),
      }
    : null
  return {
    id: r.id,
    brand_id: r.brand_id,
    name: r.name,
    unit: r.unit,
    created_at: r.created_at,
    ingredient_stock: st,
  }
}

function maxStockUpdatedAt(rows: IngredientWithStock[]): string | null {
  let maxIso: string | null = null
  let maxMs = 0
  for (const row of rows) {
    const at = row.ingredient_stock?.updated_at
    if (!at) continue
    const ms = new Date(at).getTime()
    if (!Number.isFinite(ms)) continue
    if (ms > maxMs) {
      maxMs = ms
      maxIso = at
    }
  }
  return maxIso
}

export default async function AdminInventoryStockPage() {
  const brandId = await getAdminBrandId()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("ingredients")
    .select("*, ingredient_stock(*)")
    .eq("brand_id", brandId)
    .order("name")

  if (error) {
    return (
      <p className="text-destructive">
        Не удалось загрузить остатки: {error.message}
      </p>
    )
  }

  const rowsBase = (data ?? []).map(normalizeRow)
  const lastUpdatedGlobal = maxStockUpdatedAt(rowsBase)
  const rows: StockOverviewRow[] = rowsBase.map((r) => ({
    ...r,
    costPerUnitLabel: costPerUnitLabel(r),
  }))

  return <StockOverview rows={rows} lastUpdatedGlobal={lastUpdatedGlobal} />
}
