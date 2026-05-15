/**
 * Количество ингредиента в единицах хранения (г / мл / шт),
 * списываемое со склада: приоритет `quantity_gross` (брутто), иначе `quantity` (legacy / нетто).
 */
export function recipeIngredientStockStorageQty(recipeLine: {
  quantity: number
  quantity_gross?: number | null
}): number {
  const g = recipeLine.quantity_gross
  const gross = g !== null && g !== undefined ? Number(g) : NaN
  if (Number.isFinite(gross)) return gross
  const net = Number(recipeLine.quantity)
  return Number.isFinite(net) ? net : 0
}
