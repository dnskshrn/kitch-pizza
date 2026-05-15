import type { StorageUnit } from "@/lib/inventory-units"

export type RecipeCompositionIngredient = {
  id: string
  name: string
  unit: StorageUnit
  avg_cost: number
  waste_percent: number
}

export type RecipeCompositionSemi = {
  id: string
  name: string
  yield_qty: number
  yield_unit: StorageUnit
}
