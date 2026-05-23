import type { SemiFinished, SemiFinishedItem } from "@/types/database"

export type IngredientSelectOption = {
  id: string
  name: string
  unit: "g" | "ml" | "pcs"
}

export type SemiFinishedSelectOption = {
  id: string
  name: string
  yield_unit: "g" | "ml" | "pcs"
  yield_qty: number
}

export type SemiFinishedItemRow = Omit<SemiFinishedItem, "ingredient_id"> & {
  ingredient_id: string | null
  semi_finished_ref_id: string | null
}

export type SemiFinishedWithItems = SemiFinished & {
  semi_finished_items: Array<
    SemiFinishedItemRow & {
      ingredients: { name: string; unit: "g" | "ml" | "pcs" } | null
      semi_finished_ref: {
        name: string
        yield_unit: "g" | "ml" | "pcs"
      } | null
    }
  >
}

export type SemiFinishedListRow = SemiFinishedWithItems & {
  /** Себестоимость всего выхода (MDL), null если нет данных по ценам */
  costMdl: number | null
}
