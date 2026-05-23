import { createClient } from "@/lib/supabase/server"
import { parseIngredientAvgCostStorage } from "@/lib/ingredient-avg-cost"
import {
  buildSemiFinishedCatalogMap,
  computeSemiInputCostMdl,
} from "@/lib/semi-finished-cost"
import type { SemiFinishedItemRow } from "./types"
import type { IngredientSelectOption, SemiFinishedListRow, SemiFinishedWithItems } from "./types"
import { SemiFinishedTable } from "./semi-finished-table"

function normalizeSemiFinished(row: Record<string, unknown>): SemiFinishedWithItems {
  const raw = row.semi_finished_items
  const list = !raw ? [] : Array.isArray(raw) ? raw : [raw]
  const items = list.map((item) => {
    const i = item as Record<string, unknown>
    const ing = i.ingredients
    const ingredients = Array.isArray(ing)
      ? (ing[0] as { name: string; unit: "g" | "ml" | "pcs" } | null) ??
        null
      : (ing as { name: string; unit: "g" | "ml" | "pcs" } | null) ?? null
    const semiRef = i.semi_finished_ref
    const semi_finished_ref = Array.isArray(semiRef)
      ? (semiRef[0] as { name: string; yield_unit: "g" | "ml" | "pcs" } | null) ??
        null
      : (semiRef as { name: string; yield_unit: "g" | "ml" | "pcs" } | null) ??
        null
    const copy = { ...i }
    delete copy.ingredients
    delete copy.semi_finished_ref
    return {
      ...(copy as SemiFinishedItemRow),
      ingredients,
      semi_finished_ref,
    }
  })

  const copy = { ...row }
  delete copy.semi_finished_items
  return {
    ...(copy as Omit<SemiFinishedWithItems, "semi_finished_items">),
    semi_finished_items: items,
  }
}

export default async function AdminSemiFinishedPage() {
  const supabase = await createClient()

  const [semiRes, ingRes] = await Promise.all([
    supabase
      .from("semi_finished")
      .select(
        "*, semi_finished_items!semi_finished_items_semi_finished_id_fkey(*, ingredients(name, unit, ingredient_stock(avg_cost)), semi_finished_ref:semi_finished!semi_finished_items_semi_finished_ref_id_fkey(name, yield_unit))"
      )
      .order("name"),
    supabase
      .from("ingredients")
      .select("id, name, unit, ingredient_stock(avg_cost)")
      .order("name"),
  ])

  if (semiRes.error) {
    return (
      <p className="text-destructive">
        Не удалось загрузить полуфабрикаты: {semiRes.error.message}
      </p>
    )
  }

  if (ingRes.error) {
    return (
      <p className="text-destructive">
        Не удалось загрузить ингредиенты: {ingRes.error.message}
      </p>
    )
  }

  const rowsBase = (semiRes.data ?? []).map((r) =>
    normalizeSemiFinished(r as Record<string, unknown>)
  )

  const ingredientCostById: Record<string, number> = {}
  const ingredientOptions: IngredientSelectOption[] = []
  for (const raw of ingRes.data ?? []) {
    const ing = raw as {
      id: string
      name: string
      unit: "g" | "ml" | "pcs"
      ingredient_stock: unknown
    }
    ingredientOptions.push({ id: ing.id, name: ing.name, unit: ing.unit })
    const avg = parseIngredientAvgCostStorage(ing.ingredient_stock)
    if (avg != null) {
      ingredientCostById[ing.id] = avg
    }
  }

  const catalog = buildSemiFinishedCatalogMap(rowsBase)
  const ingredientCostMap = new Map(Object.entries(ingredientCostById))
  const rows: SemiFinishedListRow[] = rowsBase.map((row) => {
    const inputCost = computeSemiInputCostMdl(
      row.id,
      catalog,
      ingredientCostMap
    )
    return { ...row, costMdl: inputCost > 0 ? inputCost : null }
  })

  return (
    <SemiFinishedTable
      rows={rows}
      ingredientOptions={ingredientOptions}
      ingredientCostById={ingredientCostById}
    />
  )
}
