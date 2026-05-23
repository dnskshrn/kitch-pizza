/** avg_cost из relation ingredient_stock (MDL за ед. хранения: г / мл / шт). */
export function parseIngredientAvgCostStorage(stock: unknown): number | null {
  if (stock == null) return null
  const row = Array.isArray(stock)
    ? (stock[0] as { avg_cost?: unknown } | undefined)
    : (stock as { avg_cost?: unknown })
  if (!row || row.avg_cost == null) return null
  const v = Number(row.avg_cost)
  return Number.isFinite(v) && v > 0 ? v : null
}
