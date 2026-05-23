"use client"

import {
  InventorySearchCombobox,
  type InventorySearchComboboxOption,
} from "../inventory-search-combobox"

export type IngredientComboboxIngredient = InventorySearchComboboxOption

type IngredientComboboxProps = {
  value: string
  onChange: (id: string) => void
  ingredients: IngredientComboboxIngredient[]
}

export function IngredientCombobox({
  value,
  onChange,
  ingredients,
}: IngredientComboboxProps) {
  return (
    <InventorySearchCombobox
      value={value}
      onChange={onChange}
      options={ingredients}
      placeholder="Ингредиент"
      searchPlaceholder="Поиск ингредиента…"
    />
  )
}
