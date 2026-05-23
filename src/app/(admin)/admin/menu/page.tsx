import { Suspense } from "react"
import { getAdminBrandId } from "@/lib/get-admin-brand-id"
import {
  buildMenuItemRecipeCostMap,
  buildProductRecipeCostContext,
  enrichProductRecipeCostContext,
  type ProductRecipeCostLine,
} from "@/lib/product-recipe-cost"
import { createClient } from "@/lib/supabase/server"
import type { MenuItem } from "@/types/database"
import { getToppingGroups } from "./actions"
import { MenuTable } from "./menu-table"

type MenuItemRow = MenuItem & {
  category: { id: string; name_ru: string; name_ro: string } | null
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
    const [recipeRes, ingRes, semiRes] = await Promise.all([
      supabase
        .from("product_recipes")
        .select(
          "menu_item_id, variant_id, ingredient_id, semi_finished_id, menu_item_ref_id, menu_item_ref_variant_id, quantity, quantity_gross",
        )
        .in("menu_item_id", itemIds),
      supabase
        .from("ingredients")
        .select("id, ingredient_stock(avg_cost)"),
      supabase
        .from("semi_finished")
        .select(
          "id, yield_qty, semi_finished_items!semi_finished_items_semi_finished_id_fkey(quantity, ingredient_id, semi_finished_ref_id)",
        ),
    ])

    const recipeLines = (recipeRes.data ?? []) as ProductRecipeCostLine[]
    const baseCtx = buildProductRecipeCostContext(
      (ingRes.data ?? []) as { id: string; ingredient_stock?: unknown }[],
      (semiRes.data ?? []) as Record<string, unknown>[],
    )
    const ctx = enrichProductRecipeCostContext(
      baseCtx,
      recipeLines,
      rows.map((r) => ({ id: r.id, has_sizes: Boolean(r.has_sizes) })),
    )
    costMap = buildMenuItemRecipeCostMap(recipeLines, ctx)
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
