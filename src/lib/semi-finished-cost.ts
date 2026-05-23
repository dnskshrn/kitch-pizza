export type SemiFinishedCostItem = {
  quantity: number
  ingredient_id: string | null
  semi_finished_ref_id: string | null
}

export type SemiFinishedCostNode = {
  id: string
  yield_qty: number
  semi_finished_items: SemiFinishedCostItem[]
}

/** Суммарная себестоимость входа (MDL) по составу п/ф. */
export function computeSemiInputCostMdl(
  semiId: string,
  catalog: Map<string, SemiFinishedCostNode>,
  ingredientCosts: Map<string, number>,
  visited = new Set<string>()
): number {
  if (visited.has(semiId)) return 0
  visited.add(semiId)

  const semi = catalog.get(semiId)
  if (!semi) return 0

  let total = 0
  for (const item of semi.semi_finished_items) {
    const qty = Number(item.quantity)
    if (!(qty > 0)) continue

    if (item.semi_finished_ref_id) {
      const nestedSemi = catalog.get(item.semi_finished_ref_id)
      const nestedTotal = computeSemiInputCostMdl(
        item.semi_finished_ref_id,
        catalog,
        ingredientCosts,
        visited
      )
      if (nestedSemi && nestedSemi.yield_qty > 0) {
        total += qty * (nestedTotal / nestedSemi.yield_qty)
      }
      continue
    }

    const ingId = item.ingredient_id
    if (!ingId) continue
    const avgCost = ingredientCosts.get(ingId)
    if (avgCost != null && avgCost > 0) {
      total += qty * avgCost
    }
  }

  return total
}

/** Себестоимость на единицу выхода (MDL за г/мл/шт в БД). */
export function semiCostPerStorageUnitMdl(
  semiId: string,
  catalog: Map<string, SemiFinishedCostNode>,
  ingredientCosts: Map<string, number>
): number | null {
  const semi = catalog.get(semiId)
  if (!semi || !(semi.yield_qty > 0)) return null
  const inputCost = computeSemiInputCostMdl(semiId, catalog, ingredientCosts)
  return inputCost / semi.yield_qty
}

export function buildSemiFinishedCatalogMap<T extends SemiFinishedCostNode>(
  rows: T[]
): Map<string, T> {
  return new Map(rows.map((r) => [r.id, r]))
}
