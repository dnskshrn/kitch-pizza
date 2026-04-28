"use client"

import type { MenuItem } from "@/types/database"
import { cn } from "@/lib/utils"

export type PizzaSize = "l" | "s"

export type SizeSelectorProps = {
  selectedSize: PizzaSize
  onSizeChange: (size: PizzaSize) => void
  item: MenuItem
}

/** Подпись варианта для витрины; пусто в БД → «S» / «L». */
export function getItemSizeLabel(item: MenuItem, size: PizzaSize): string {
  const raw = size === "l" ? item.size_l_label : item.size_s_label
  const t = raw?.trim()
  return t && t.length > 0 ? t : size === "l" ? "L" : "S"
}

export function SizeSelector({ selectedSize, onSizeChange, item }: SizeSelectorProps) {
  const labelS = getItemSizeLabel(item, "s")
  const labelL = getItemSizeLabel(item, "l")

  return (
    <div className="storefront-modal-field flex w-full gap-1 rounded-full p-1 transition-all duration-200">
      <button
        type="button"
        onClick={() => onSizeChange("s")}
        className={cn(
          "flex-1 cursor-pointer rounded-full py-2 text-center text-[16px] transition-all duration-200",
          selectedSize === "s"
            ? "storefront-modal-mode-active font-bold shadow-sm hover:shadow-md"
            : "font-medium text-[rgba(36,36,36,0.5)] hover:bg-white/50 hover:text-[#242424]",
        )}
      >
        {labelS}
      </button>
      <button
        type="button"
        onClick={() => onSizeChange("l")}
        className={cn(
          "flex-1 cursor-pointer rounded-full py-2 text-center text-[16px] transition-all duration-200",
          selectedSize === "l"
            ? "storefront-modal-mode-active font-bold shadow-sm hover:shadow-md"
            : "font-medium text-[rgba(36,36,36,0.5)] hover:bg-white/50 hover:text-[#242424]",
        )}
      >
        {labelL}
      </button>
    </div>
  )
}
