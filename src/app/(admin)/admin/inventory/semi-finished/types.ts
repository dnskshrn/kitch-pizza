import type { SemiFinished, SemiFinishedItem } from "@/types/database"

export type IngredientSelectOption = {
  id: string
  name: string
  unit: "g" | "ml" | "pcs"
}

export type SemiFinishedWithItems = SemiFinished & {
  semi_finished_items: Array<
    SemiFinishedItem & {
      ingredients: { name: string; unit: "g" | "ml" | "pcs" } | null
    }
  >
}
