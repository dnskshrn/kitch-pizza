import type { OrderItemTopping } from "@/types/database"

/** Строка `topping_recipes` с join на `toppings` для сопоставления с JSONB заказа. */
export type ToppingRecipeLookupRow = {
  topping_id: string
  topping?: { name_ru: string; name_ro: string } | null
}

/**
 * Сопоставление топпинга из `order_items.toppings` со строкой рецепта:
 * сначала по UUID (новые заказы), иначе по snapshot-имени RU/RO (legacy).
 */
export function orderItemToppingMatchesRecipeRow(
  orderTopping: Pick<OrderItemTopping, "id" | "name">,
  recipeRow: ToppingRecipeLookupRow,
): boolean {
  const toppingMeta = recipeRow.topping
  if (orderTopping.id && orderTopping.id === recipeRow.topping_id) {
    return true
  }
  const snapshotName = orderTopping.name.trim()
  if (!snapshotName || !toppingMeta) return false
  return (
    toppingMeta.name_ru === snapshotName || toppingMeta.name_ro === snapshotName
  )
}

export function findToppingRecipeRowForOrderItem(
  orderTopping: Pick<OrderItemTopping, "id" | "name">,
  recipeRows: ToppingRecipeLookupRow[],
): ToppingRecipeLookupRow | undefined {
  return recipeRows.find((row) =>
    orderItemToppingMatchesRecipeRow(orderTopping, row),
  )
}
