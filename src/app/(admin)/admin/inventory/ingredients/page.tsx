import { createClient } from "@/lib/supabase/server"
import type { IngredientStock, IngredientWithStock } from "@/types/database"
import type { IngredientCategory } from "@/lib/actions/inventory/ingredient-categories"
import { IngredientsTable } from "./ingredients-table"

export const dynamic = "force-dynamic"

const INGREDIENT_SERVER_FILTER_THRESHOLD = 500

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

  const wasteRaw = Number((row as { waste_percent?: unknown }).waste_percent)
  const waste_percent = Number.isFinite(wasteRaw) ? wasteRaw : 0

  const catRaw = (row as { category_id?: unknown }).category_id
  const category_id =
    typeof catRaw === "string" && catRaw.length > 0 ? catRaw : null

  return {
    id: String(row.id),
    brand_id: String(row.brand_id),
    name: String(row.name),
    unit: row.unit as IngredientWithStock["unit"],
    category_id,
    waste_percent,
    created_at: String(row.created_at),
    ingredient_stock: stock,
  }
}

function parseCategoryParam(
  raw: string | undefined,
  validIds: Set<string>
): "all" | "none" | string {
  if (raw === undefined || raw === "" || raw === "all") return "all"
  if (raw === "none") return "none"
  if (validIds.has(raw)) return raw
  return "all"
}

export default async function AdminIngredientsPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>
}) {
  const supabase = await createClient()

  const categoryRaw = searchParams.category
  const categoryParam =
    typeof categoryRaw === "string" ? categoryRaw : undefined

  const { count, error: countError } = await supabase
    .from("ingredients")
    .select("id", { count: "exact", head: true })

  if (countError) {
    return (
      <p className="text-destructive">
        Не удалось посчитать ингредиенты: {countError.message}
      </p>
    )
  }

  const useServerCategoryFilter =
    (count ?? 0) >= INGREDIENT_SERVER_FILTER_THRESHOLD

  let categoryTabsForLookup: IngredientCategory[] = []
  if (useServerCategoryFilter) {
    const { data: cats, error: catErr } = await supabase
      .from("ingredient_categories")
      .select("id, name, sort_order")
      .order("sort_order", { ascending: true })

    if (catErr) {
      return (
        <p className="text-destructive">
          Не удалось загрузить категории: {catErr.message}
        </p>
      )
    }
    categoryTabsForLookup = (cats ?? []) as IngredientCategory[]
  }

  const validCategoryIds = new Set(categoryTabsForLookup.map((c) => c.id))
  const categoryFilterApplied = useServerCategoryFilter
    ? parseCategoryParam(categoryParam, validCategoryIds)
    : "all"

  let query = supabase
    .from("ingredients")
    .select(
      `
      *,
      ingredient_stock(*),
      ingredient_categories ( id, name, sort_order )
    `
    )
    .order("name")

  if (useServerCategoryFilter) {
    if (categoryFilterApplied === "none") {
      query = query.is("category_id", null)
    } else if (categoryFilterApplied !== "all") {
      query = query.eq("category_id", categoryFilterApplied)
    }
  }

  const { data, error } = await query

  if (error) {
    return (
      <p className="text-destructive">
        Не удалось загрузить ингредиенты: {error.message}
      </p>
    )
  }

  const rows = (data ?? []) as Record<string, unknown>[]
  const ingredients = rows.map((r) => normalizeIngredientStock(r))

  let categoryTabs: IngredientCategory[]
  if (useServerCategoryFilter) {
    categoryTabs = categoryTabsForLookup
  } else {
    const map = new Map<string, IngredientCategory>()
    for (const r of rows) {
      const ic = r.ingredient_categories
      const cat = Array.isArray(ic) ? ic[0] : ic
      if (
        cat &&
        typeof cat === "object" &&
        cat !== null &&
        "id" in cat &&
        "name" in cat
      ) {
        const c = cat as {
          id: string
          name: string
          sort_order: number
        }
        map.set(String(c.id), {
          id: String(c.id),
          name: String(c.name),
          sort_order: Number.isFinite(Number(c.sort_order))
            ? Number(c.sort_order)
            : 0,
        })
      }
    }
    categoryTabs = [...map.values()].sort(
      (a, b) =>
        a.sort_order - b.sort_order || a.name.localeCompare(b.name, "ro")
    )
  }

  return (
    <IngredientsTable
      key={
        useServerCategoryFilter ? (categoryParam ?? "all") : "client-filter"
      }
      ingredients={ingredients}
      categoryTabs={categoryTabs}
      serverSideCategoryFilter={useServerCategoryFilter}
    />
  )
}
