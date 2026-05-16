import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { createClient } from "@/lib/supabase/server"
import { recipeIngredientStockStorageQty } from "@/lib/product-recipe-ingredient-qty"

import {
  TechCardsOverviewTable,
  type TechCardsOverviewRow,
} from "./tech-cards-table"

function normalizeArray<T>(raw: unknown): T[] {
  if (raw == null) return []
  if (Array.isArray(raw)) return raw as T[]
  return [raw as T]
}

function firstRelation(rel: unknown): Record<string, unknown> | null {
  if (rel == null) return null
  if (Array.isArray(rel)) {
    const x = rel[0]
    return x != null && typeof x === "object" ? (x as Record<string, unknown>) : null
  }
  if (typeof rel === "object") return rel as Record<string, unknown>
  return null
}

function avgCostFromRecipeLine(
  line: Record<string, unknown>,
): number | null {
  const ing = firstRelation(line.ingredients)
  if (!ing) return null
  const st = firstRelation(ing.ingredient_stock)
  const raw = st?.avg_cost
  if (raw === null || raw === undefined || raw === "") return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

function buildOverviewRow(raw: Record<string, unknown>): TechCardsOverviewRow | null {
  const id = String(raw.id ?? "")
  const nameRu = String(raw.name_ru ?? "").trim()
  if (!id || !nameRu) return null

  const recipes = normalizeArray<Record<string, unknown>>(raw.product_recipes)
  if (recipes.length === 0) return null

  let sumMdl = 0
  let pricedIngredientLines = 0

  for (const line of recipes) {
    if (line.semi_finished_id != null) continue

    const ingId = line.ingredient_id
    if (ingId == null || ingId === "") continue

    const cost = avgCostFromRecipeLine(line)
    if (cost === null) continue

    const q = recipeIngredientStockStorageQty({
      quantity: Number(line.quantity),
      quantity_gross: (line.quantity_gross as number | null | undefined) ?? null,
    })
    if (!Number.isFinite(q)) continue

    sumMdl += q * cost
    pricedIngredientLines += 1
  }

  return {
    id,
    name_ru: nameRu,
    componentCount: recipes.length,
    costLabel:
      pricedIngredientLines > 0 ? `${sumMdl.toFixed(2)} MDL` : null,
  }
}

export default async function AdminTechCardsPage() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("menu_items")
    .select(`
      id, name_ru,
      product_recipes!product_recipes_menu_item_id_fkey(
        id,
        ingredient_id,
        semi_finished_id,
        quantity,
        quantity_gross,
        ingredients(
          name,
          unit,
          ingredient_stock(avg_cost)
        )
      )
    `)
    .not("product_recipes", "is", null)
    .order("name_ru")

  if (error) {
    return (
      <p className="text-destructive">
        Не удалось загрузить техкарты: {error.message}
      </p>
    )
  }

  const rows: TechCardsOverviewRow[] = (data ?? []).flatMap((row) => {
    const mapped = buildOverviewRow(row as Record<string, unknown>)
    return mapped ? [mapped] : []
  })

  return (
    <div className="space-y-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <span className="text-muted-foreground">Склад</span>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Техкарты</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <h1 className="text-2xl font-semibold">Техкарты</h1>

      <TechCardsOverviewTable rows={rows} />
    </div>
  )
}
