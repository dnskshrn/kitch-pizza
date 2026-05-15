import { Suspense } from "react"
import { getAdminBrandId } from "@/lib/get-admin-brand-id"
import { recipeIngredientStockStorageQty } from "@/lib/product-recipe-ingredient-qty"
import { createClient } from "@/lib/supabase/server"
import type { MenuItem } from "@/types/database"
import { getToppingGroups } from "./actions"
import { MenuTable } from "./menu-table"

type MenuItemRow = MenuItem & {
  category: { id: string; name_ru: string; name_ro: string } | null
}

type RecipeCostRow = {
  menu_item_id: string
  variant_id: string | null
  quantity: number
  quantity_gross?: number | null
  ingredients: unknown
}

function firstAvgCost(stock: unknown): number {
  if (stock == null) return 0
  if (Array.isArray(stock)) {
    const row = stock[0] as { avg_cost?: unknown } | undefined
    return Number(row?.avg_cost ?? 0) || 0
  }
  return Number((stock as { avg_cost?: unknown }).avg_cost ?? 0) || 0
}

function ingredientLineCostMdl(row: RecipeCostRow): number {
  const ingRaw = row.ingredients
  if (ingRaw == null) return 0
  const ing = Array.isArray(ingRaw) ? ingRaw[0] : ingRaw
  if (!ing || typeof ing !== "object") return 0
  const stock = (ing as { ingredient_stock?: unknown }).ingredient_stock
  const avgCost = firstAvgCost(stock)
  if (!avgCost) return 0
  const qty = recipeIngredientStockStorageQty({
    quantity: Number(row.quantity) || 0,
    quantity_gross: row.quantity_gross ?? null,
  })
  return qty * avgCost
}

function buildTheoreticalCostMap(
  recipeRows: RecipeCostRow[] | null,
): Record<string, number> {
  type Bucket = { base: number; byVariant: Map<string, number> }
  const byItem = new Map<string, Bucket>()

  for (const row of recipeRows ?? []) {
    const line = ingredientLineCostMdl(row)
    if (line <= 0) continue
    const itemId = row.menu_item_id
    let bucket = byItem.get(itemId)
    if (!bucket) {
      bucket = { base: 0, byVariant: new Map() }
      byItem.set(itemId, bucket)
    }
    if (row.variant_id == null) {
      bucket.base += line
    } else {
      const vid = row.variant_id
      bucket.byVariant.set(vid, (bucket.byVariant.get(vid) ?? 0) + line)
    }
  }

  const out: Record<string, number> = {}
  for (const [itemId, bucket] of byItem) {
    if (bucket.base > 0) {
      out[itemId] = bucket.base
    } else if (bucket.byVariant.size > 0) {
      out[itemId] = Math.min(...bucket.byVariant.values())
    }
  }
  return out
}

export default async function AdminMenuPage() {
  const brandId = await getAdminBrandId()
  const supabase = await createClient()

  const [{ data: items, error: itemsError }, { data: categories, error: catError }, toppingGroups] =
    await Promise.all([
      supabase
        .from("menu_items")
        .select(
          "*, category:menu_categories(id, name_ru, name_ro), variants:menu_item_variants(id, name_ru, sort_order, price)",
        )
        .eq("brand_id", brandId)
        .order("sort_order", { ascending: true }),
      supabase
        .from("menu_categories")
        .select("id, name_ru, name_ro")
        .eq("brand_id", brandId)
        .order("sort_order", { ascending: true }),
      getToppingGroups(),
    ])

  if (itemsError || catError) {
    return (
      <p className="text-destructive">
        Не удалось загрузить данные:{" "}
        {itemsError?.message ?? catError?.message}
      </p>
    )
  }

  const { data: recipeCoverage } = await supabase
    .from("product_recipes")
    .select("menu_item_id")

  const coveredItemIds = Array.from(
    new Set(
      (recipeCoverage ?? [])
        .map((r) => r.menu_item_id)
        .filter((id): id is string => typeof id === "string" && id.length > 0),
    ),
  )

  const rows = (items ?? []) as MenuItemRow[]
  const cats = categories ?? []

  const itemIds = rows.map((r) => r.id)
  let costMap: Record<string, number> = {}

  if (itemIds.length > 0) {
    const { data: recipeCosts } = await supabase.from("product_recipes").select(`
        menu_item_id,
        variant_id,
        quantity,
        quantity_gross,
        ingredients(unit, ingredient_stock(avg_cost))
      `).in("menu_item_id", itemIds)

    const typed = (recipeCosts ?? []) as unknown as RecipeCostRow[]
    costMap = buildTheoreticalCostMap(typed)
  }

  return (
    <Suspense fallback={null}>
      <MenuTable
        brandId={brandId}
        items={rows}
        categories={cats}
        toppingGroups={toppingGroups}
        coveredItemIds={coveredItemIds}
        costMap={costMap}
      />
    </Suspense>
  )
}
