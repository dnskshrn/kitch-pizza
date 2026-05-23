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
  /** MDL за ед. хранения (г / мл / шт); null если состав не оценён. */
  cost_per_storage_unit: number | null
}
