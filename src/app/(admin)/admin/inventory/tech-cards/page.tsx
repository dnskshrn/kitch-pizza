import { getAdminBrandId } from "@/lib/get-admin-brand-id"
import { createClient } from "@/lib/supabase/server"
import {
  TechCardsTable,
  type TechCardTableRow,
} from "./tech-cards-table"
import type { IngredientOption, SemiFinishedOption } from "./tech-card-dialog"

type RecipeRef = { id: string; variant_id: string | null }

function normalizeArray<T>(raw: unknown): T[] {
  if (raw == null) return []
  if (Array.isArray(raw)) return raw as T[]
  return [raw as T]
}

function countForVariant(
  recipes: RecipeRef[],
  variantId: string | null
): number {
  return recipes.filter((r) => {
    if (variantId == null) return r.variant_id == null
    return r.variant_id === variantId
  }).length
}

type MenuItemFetched = {
  id: string
  name_ru: string
  has_sizes: boolean
  menu_item_variants: unknown
  product_recipes: unknown
}

function buildTechCardRows(items: MenuItemFetched[]): TechCardTableRow[] {
  const out: TechCardTableRow[] = []
  for (const item of items) {
    const variants = normalizeArray<{ id: string; name_ru: string }>(
      item.menu_item_variants
    )
    const recipes = normalizeArray<RecipeRef>(item.product_recipes)

    if (item.has_sizes) {
      for (const v of variants) {
        out.push({
          key: `${item.id}-${v.id}`,
          menuItemId: item.id,
          variantId: v.id,
          itemName: item.name_ru,
          variantLabel: v.name_ru,
          recipeCount: countForVariant(recipes, v.id),
        })
      }
    } else {
      out.push({
        key: `${item.id}-base`,
        menuItemId: item.id,
        variantId: null,
        itemName: item.name_ru,
        variantLabel: null,
        recipeCount: countForVariant(recipes, null),
      })
    }
  }
  return out
}

export default async function AdminTechCardsPage() {
  const brandId = await getAdminBrandId()
  const supabase = await createClient()

  const [itemsRes, ingRes, semiRes] = await Promise.all([
    supabase
      .from("menu_items")
      .select(
        "id, name_ru, has_sizes, menu_item_variants(id, name_ru), product_recipes(id, variant_id)"
      )
      .eq("brand_id", brandId)
      .eq("is_active", true)
      .order("name_ru"),
    supabase
      .from("ingredients")
      .select("id, name, unit")
      .eq("brand_id", brandId)
      .order("name"),
    supabase
      .from("semi_finished")
      .select("id, name, yield_unit")
      .eq("brand_id", brandId)
      .order("name"),
  ])

  if (itemsRes.error) {
    return (
      <p className="text-destructive">
        Не удалось загрузить меню: {itemsRes.error.message}
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
  if (semiRes.error) {
    return (
      <p className="text-destructive">
        Не удалось загрузить полуфабрикаты: {semiRes.error.message}
      </p>
    )
  }

  const items = (itemsRes.data ?? []) as MenuItemFetched[]
  const tableRows = buildTechCardRows(items)

  const ingredientOptions = (ingRes.data ?? []) as IngredientOption[]
  const semiFinishedOptions = (semiRes.data ?? []) as SemiFinishedOption[]

  return (
    <TechCardsTable
      rows={tableRows}
      ingredientOptions={ingredientOptions}
      semiFinishedOptions={semiFinishedOptions}
    />
  )
}
