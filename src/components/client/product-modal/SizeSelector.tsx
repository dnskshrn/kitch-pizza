"use client"

import type { Lang } from "@/lib/i18n/storefront"
import type { MenuItemVariant } from "@/types/database"
import { cn } from "@/lib/utils"

/** Исторический тип для строк корзины до вариантов. */
export type PizzaSize = "l" | "s"

export function pickVariantLabel(
  variant: MenuItemVariant,
  lang: Lang,
): string {
  if (lang === "RO") {
    return variant.name_ro?.trim() || variant.name_ru.trim()
  }
  return variant.name_ru.trim() || variant.name_ro?.trim() || ""
}

export type VariantSelectorProps = {
  variants: MenuItemVariant[]
  selectedVariantId: string | null
  onVariantChange: (variantId: string) => void
  lang: Lang
}

export function VariantSelector({
  variants,
  selectedVariantId,
  onVariantChange,
  lang,
}: VariantSelectorProps) {
  if (variants.length === 0) return null

  return (
    <div className="storefront-modal-field flex w-full flex-wrap gap-2 rounded-[12px] p-1 transition-all duration-200">
      {variants.map((v) => {
        const label = pickVariantLabel(v, lang)
        const sel = selectedVariantId === v.id
        return (
          <button
            key={v.id}
            type="button"
            onClick={() => onVariantChange(v.id)}
            className={cn(
              "min-h-11 min-w-0 flex-1 cursor-pointer rounded-full px-2 py-2 text-center text-[15px] transition-all duration-200 md:text-[16px]",
              sel
                ? "storefront-modal-mode-active font-bold shadow-sm hover:shadow-md"
                : "font-medium text-[rgba(36,36,36,0.5)] hover:bg-white/50 hover:text-[#242424]",
            )}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}
