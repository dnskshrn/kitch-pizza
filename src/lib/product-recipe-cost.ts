import { parseIngredientAvgCostStorage } from "@/lib/ingredient-avg-cost"
import { recipeIngredientStockStorageQty } from "@/lib/product-recipe-ingredient-qty"
import {
  buildSemiFinishedCatalogMap,
  semiCostPerStorageUnitMdl,
  type SemiFinishedCostNode,
} from "@/lib/semi-finished-cost"

export type ProductRecipeCostLine = {
  menu_item_id: string
  variant_id: string | null
  ingredient_id?: string | null
  semi_finished_id?: string | null
  menu_item_ref_id?: string | null
  menu_item_ref_variant_id?: string | null
  quantity: number
  quantity_gross?: number | null
  /** Опциональный embed; иначе берётся из `ingredientCostById`. */
  ingredients?: unknown
}

export type MenuItemRecipeMeta = {
  has_sizes: boolean
}

export type ProductRecipeCostContext = {
  ingredientCostById: Map<string, number>
  semiCostPerUnitById: Map<string, number>
  /** Все строки product_recipes по menu_item_id (для комбо). */
  recipesByMenuItemId?: Map<string, ProductRecipeCostLine[]>
  menuItemMetaById?: Map<string, MenuItemRecipeMeta>
}

function normalizeEmbedArray<T>(raw: unknown): T[] {
  if (raw == null) return []
  if (Array.isArray(raw)) return raw as T[]
  return [raw as T]
}

/** Ключ рецепта: menu_item_id + variant (null = base / без варианта). */
export function menuItemRecipeBucketKey(
  menuItemId: string,
  variantId: string | null,
): string {
  return `${menuItemId}\u0000${variantId ?? ""}`
}

/** avg_cost из embed `ingredients(ingredient_stock(avg_cost))`. */
export function ingredientAvgCostFromEmbed(ingredients: unknown): number {
  if (ingredients == null) return 0
  const ing = Array.isArray(ingredients) ? ingredients[0] : ingredients
  if (!ing || typeof ing !== "object") return 0
  const stock = (ing as { ingredient_stock?: unknown }).ingredient_stock
  return parseIngredientAvgCostStorage(stock) ?? 0
}

export function buildIngredientCostById(
  rows: { id: string; ingredient_stock?: unknown }[],
): Map<string, number> {
  const map = new Map<string, number>()
  for (const row of rows) {
    const avg = parseIngredientAvgCostStorage(row.ingredient_stock)
    if (avg != null && avg > 0) {
      map.set(row.id, avg)
    }
  }
  return map
}

export function buildSemiCostPerUnitById(
  semiRows: Record<string, unknown>[],
  ingredientCostById: Map<string, number>,
): Map<string, number> {
  const catalogNodes: SemiFinishedCostNode[] = semiRows.map((raw) => {
    const items = normalizeEmbedArray<{
      quantity: unknown
      ingredient_id: string | null
      semi_finished_ref_id: string | null
    }>(raw.semi_finished_items)
    return {
      id: String(raw.id),
      yield_qty: Number(raw.yield_qty) || 0,
      semi_finished_items: items.map((item) => ({
        quantity: Number(item.quantity) || 0,
        ingredient_id: item.ingredient_id ?? null,
        semi_finished_ref_id: item.semi_finished_ref_id ?? null,
      })),
    }
  })
  const catalog = buildSemiFinishedCatalogMap(catalogNodes)
  const out = new Map<string, number>()
  for (const node of catalogNodes) {
    const cpu = semiCostPerStorageUnitMdl(
      node.id,
      catalog,
      ingredientCostById,
    )
    if (cpu != null && cpu > 0) {
      out.set(node.id, cpu)
    }
  }
  return out
}

export function buildProductRecipeCostContext(
  ingredientRows: { id: string; ingredient_stock?: unknown }[],
  semiRows: Record<string, unknown>[],
): ProductRecipeCostContext {
  const ingredientCostById = buildIngredientCostById(ingredientRows)
  return {
    ingredientCostById,
    semiCostPerUnitById: buildSemiCostPerUnitById(semiRows, ingredientCostById),
  }
}

export function buildRecipesByMenuItemId(
  recipeRows: ProductRecipeCostLine[],
): Map<string, ProductRecipeCostLine[]> {
  const map = new Map<string, ProductRecipeCostLine[]>()
  for (const row of recipeRows) {
    const list = map.get(row.menu_item_id) ?? []
    list.push(row)
    map.set(row.menu_item_id, list)
  }
  return map
}

export function enrichProductRecipeCostContext(
  base: ProductRecipeCostContext,
  recipeRows: ProductRecipeCostLine[],
  menuItems: { id: string; has_sizes: boolean }[],
): ProductRecipeCostContext {
  return {
    ...base,
    recipesByMenuItemId: buildRecipesByMenuItemId(recipeRows),
    menuItemMetaById: new Map(
      menuItems.map((m) => [m.id, { has_sizes: Boolean(m.has_sizes) }]),
    ),
  }
}

function filterRecipeLinesByVariant(
  lines: ProductRecipeCostLine[],
  variantFilter: string | null,
): ProductRecipeCostLine[] {
  return lines.filter((line) =>
    variantFilter === null
      ? line.variant_id == null
      : line.variant_id === variantFilter,
  )
}

/** Вариант рецепта referenced блюда для строки комбо (как в RecipeEditorModal). */
export function resolveMenuRefRecipeVariantFilter(
  menuItemRefId: string,
  menuItemRefVariantId: string | null | undefined,
  menuItemMetaById: Map<string, MenuItemRecipeMeta>,
): string | null {
  const meta = menuItemMetaById.get(menuItemRefId)
  if (!meta?.has_sizes) return null
  return menuItemRefVariantId ?? null
}

/**
 * Себестоимость рецепта referenced блюда: только ингредиенты и п/ф
 * (вложенные комбо в его рецепте не суммируются — как в модалке).
 */
export function computeMaterialRecipeCostMdl(
  lines: ProductRecipeCostLine[],
  ctx: ProductRecipeCostContext,
): number {
  let sum = 0
  for (const line of lines) {
    if (line.menu_item_ref_id) continue
    sum += productRecipeLineCostMdl(line, ctx)
  }
  return sum
}

export function computeReferencedMenuItemRecipeCostMdl(
  menuItemRefId: string,
  menuItemRefVariantId: string | null | undefined,
  ctx: ProductRecipeCostContext,
): number {
  const allLines = ctx.recipesByMenuItemId?.get(menuItemRefId)
  if (!allLines?.length) return 0

  const variantFilter =
    ctx.menuItemMetaById != null
      ? resolveMenuRefRecipeVariantFilter(
          menuItemRefId,
          menuItemRefVariantId,
          ctx.menuItemMetaById,
        )
      : (menuItemRefVariantId ?? null)

  const lines = filterRecipeLinesByVariant(allLines, variantFilter)
  return computeMaterialRecipeCostMdl(lines, ctx)
}

/** Себестоимость одной строки product_recipes (MDL). */
export function productRecipeLineCostMdl(
  row: Pick<
    ProductRecipeCostLine,
    | "ingredient_id"
    | "semi_finished_id"
    | "menu_item_ref_id"
    | "menu_item_ref_variant_id"
    | "quantity"
    | "quantity_gross"
    | "ingredients"
  >,
  ctx: ProductRecipeCostContext,
): number {
  const menuRefId = row.menu_item_ref_id
  if (menuRefId) {
    return computeReferencedMenuItemRecipeCostMdl(
      menuRefId,
      row.menu_item_ref_variant_id,
      ctx,
    )
  }

  const gross = recipeIngredientStockStorageQty({
    quantity: Number(row.quantity) || 0,
    quantity_gross: row.quantity_gross ?? null,
  })
  if (!(gross > 0)) return 0

  const ingId = row.ingredient_id
  if (ingId) {
    let avgCost = ctx.ingredientCostById.get(ingId) ?? 0
    if (!avgCost && row.ingredients != null) {
      avgCost = ingredientAvgCostFromEmbed(row.ingredients)
    }
    return avgCost > 0 ? gross * avgCost : 0
  }

  const semiId = row.semi_finished_id
  if (semiId) {
    const cpu = ctx.semiCostPerUnitById.get(semiId)
    return cpu != null && cpu > 0 ? gross * cpu : 0
  }

  return 0
}

/**
 * Себестоимость рецепта по позиции меню для списка:
 * base-рецепт (variant_id IS NULL) или минимум по вариантам.
 */
export function buildMenuItemRecipeCostMap(
  recipeRows: ProductRecipeCostLine[],
  ctx: ProductRecipeCostContext,
): Record<string, number> {
  type Bucket = { base: number; byVariant: Map<string, number> }
  const byItem = new Map<string, Bucket>()

  for (const row of recipeRows) {
    const line = productRecipeLineCostMdl(row, ctx)
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
