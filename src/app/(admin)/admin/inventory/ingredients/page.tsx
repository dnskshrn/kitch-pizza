import { getAdminBrandId } from "@/lib/get-admin-brand-id"
import { createClient } from "@/lib/supabase/server"
import type { IngredientStock, IngredientWithStock } from "@/types/database"
import { IngredientsTable } from "./ingredients-table"

function normalizeIngredientStock(
  row: Record<string, unknown>
): IngredientWithStock {
  const raw = row.ingredient_stock as
    | IngredientStock
    | IngredientStock[]
    | null
    | undefined
  const rawStock = Array.isArray(raw) ? raw[0] ?? null : raw ?? null
  const stock: IngredientStock | null = rawStock
    ? {
        ingredient_id: String(rawStock.ingredient_id),
        quantity: Number(rawStock.quantity),
        updated_at: String(rawStock.updated_at),
        avg_cost: (() => {
          const v = Number((rawStock as { avg_cost?: unknown }).avg_cost)
          return Number.isFinite(v) ? v : 0
        })(),
      }
    : null

  return {
    id: String(row.id),
    brand_id: String(row.brand_id),
    name: String(row.name),
    unit: row.unit as IngredientWithStock["unit"],
    created_at: String(row.created_at),
    ingredient_stock: stock,
  }
}

export default async function AdminIngredientsPage() {
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
        Не удалось загрузить ингредиенты: {error.message}
      </p>
    )
  }

  const ingredients = (data ?? []).map((r) =>
    normalizeIngredientStock(r as Record<string, unknown>)
  )

  return <IngredientsTable ingredients={ingredients} />
}
