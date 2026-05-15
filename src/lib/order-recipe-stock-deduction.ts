import { recipeIngredientStockStorageQty } from "@/lib/product-recipe-ingredient-qty"

/** Строка `product_recipes` для расчёта списания со склада. */
export type RecipeRowForDeduction = {
  menu_item_id: string
  variant_id: string | null
  ingredient_id: string | null
  semi_finished_id: string | null
  menu_item_ref_id: string | null
  menu_item_ref_variant_id: string | null
  quantity: number
  quantity_gross: number | null
}

export type SemiFinishedForDeduction = {
  id: string
  yield_qty: number
  items: { ingredient_id: string; quantity: number }[]
}

export type OrderLineForDeduction = {
  menu_item_id: string
  variant_id: string | null
  quantity: number
}

export function recipeGroupKey(
  menuItemId: string,
  variantId: string | null,
): string {
  return `${menuItemId}\u0000${variantId ?? ""}`
}

export function buildRecipesByMenuVariant(
  rows: RecipeRowForDeduction[],
): Map<string, RecipeRowForDeduction[]> {
  const m = new Map<string, RecipeRowForDeduction[]>()
  for (const r of rows) {
    const k = recipeGroupKey(r.menu_item_id, r.variant_id)
    const arr = m.get(k)
    if (arr) arr.push(r)
    else m.set(k, [r])
  }
  return m
}

/**
 * Обходит строки рецепта (ингредиент / пф / ссылка на другую позицию).
 * Для `menu_item_ref_id` количество родительской строки не умножается — это только ссылка.
 * Вложенные комбо (ссылка внутри уже развёрнутого комбо) запрещены: одна ступень рекурсии.
 */
export function accumulateIngredientsFromRecipeLines(
  lines: RecipeRowForDeduction[],
  portionsMultiplier: number,
  recipesByMenuVariant: Map<string, RecipeRowForDeduction[]>,
  semiById: Map<string, SemiFinishedForDeduction>,
  depth: number,
  out: Map<string, number>,
  errors: string[],
): void {
  for (const line of lines) {
    if (line.menu_item_ref_id) {
      if (depth >= 1) {
        errors.push("nested_combo_not_allowed")
        continue
      }
      const childKey = recipeGroupKey(
        line.menu_item_ref_id,
        line.menu_item_ref_variant_id,
      )
      const childLines = recipesByMenuVariant.get(childKey) ?? []
      if (childLines.length === 0) {
        errors.push(`missing_child_recipe:${line.menu_item_ref_id}`)
        continue
      }
      accumulateIngredientsFromRecipeLines(
        childLines,
        portionsMultiplier,
        recipesByMenuVariant,
        semiById,
        depth + 1,
        out,
        errors,
      )
      continue
    }

    if (line.ingredient_id) {
      const q =
        recipeIngredientStockStorageQty({
          quantity: Number(line.quantity) || 0,
          quantity_gross: line.quantity_gross,
        }) * portionsMultiplier
      const id = line.ingredient_id
      out.set(id, (out.get(id) ?? 0) + q)
      continue
    }

    if (line.semi_finished_id) {
      const semi = semiById.get(line.semi_finished_id)
      if (!semi || !(semi.yield_qty > 0)) {
        errors.push(`bad_semi:${line.semi_finished_id}`)
        continue
      }
      const recipeQty = recipeIngredientStockStorageQty({
        quantity: Number(line.quantity) || 0,
        quantity_gross: line.quantity_gross,
      })
      const factor = recipeQty / semi.yield_qty
      for (const it of semi.items) {
        const add = it.quantity * factor * portionsMultiplier
        const iid = it.ingredient_id
        out.set(iid, (out.get(iid) ?? 0) + add)
      }
    }
  }
}

export function computeIngredientTotalsForOrder(input: {
  orderLines: OrderLineForDeduction[]
  recipes: RecipeRowForDeduction[]
  semiFinished: SemiFinishedForDeduction[]
}): { totals: Map<string, number>; errors: string[] } {
  const recipesByMenuVariant = buildRecipesByMenuVariant(input.recipes)
  const semiById = new Map(input.semiFinished.map((s) => [s.id, s]))
  const out = new Map<string, number>()
  const errors: string[] = []

  for (const ol of input.orderLines) {
    const k = recipeGroupKey(ol.menu_item_id, ol.variant_id)
    const lines = recipesByMenuVariant.get(k) ?? []
    const mult = ol.quantity
    if (lines.length === 0) {
      errors.push(`no_recipe:${ol.menu_item_id}`)
      continue
    }
    accumulateIngredientsFromRecipeLines(
      lines,
      mult,
      recipesByMenuVariant,
      semiById,
      0,
      out,
      errors,
    )
  }

  return { totals: out, errors }
}
