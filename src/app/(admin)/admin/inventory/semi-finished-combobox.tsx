"use client"

import {
  InventorySearchCombobox,
  type InventorySearchComboboxOption,
} from "./inventory-search-combobox"

export type SemiFinishedComboboxOption = InventorySearchComboboxOption

type SemiFinishedComboboxProps = {
  value: string
  onChange: (id: string) => void
  semiFinished: SemiFinishedComboboxOption[]
}

export function SemiFinishedCombobox({
  value,
  onChange,
  semiFinished,
}: SemiFinishedComboboxProps) {
  return (
    <InventorySearchCombobox
      value={value}
      onChange={onChange}
      options={semiFinished}
      placeholder="Полуфабрикат"
      searchPlaceholder="Поиск полуфабриката…"
    />
  )
}
