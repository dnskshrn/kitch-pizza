"use client"

import { formatStorefrontExcludedCategoryList } from "@/lib/i18n/storefront"
import { useLanguage } from "@/lib/store/language-store"
import { Info } from "lucide-react"

type ExcludedCategoryLabel = {
  id: string
  name_ru: string
  name_ro: string
}

type StorefrontDiscountExcludedNoticeProps = {
  categories: ExcludedCategoryLabel[]
  mode: "zero" | "partial"
}

export function StorefrontDiscountExcludedNotice({
  categories,
  mode,
}: StorefrontDiscountExcludedNoticeProps) {
  const { lang, t } = useLanguage()
  if (categories.length === 0) return null
  const names = categories.map((c) =>
    lang === "RU" ? c.name_ru : c.name_ro,
  )
  const list = formatStorefrontExcludedCategoryList(names, lang)
  const text =
    mode === "zero"
      ? t.cart.discountDoesNotApplyTo(list)
      : t.cart.discountNotAppliedTo(list)

  return (
    <div className="mt-1 flex items-start gap-1.5 text-xs text-[#808080]">
      <Info
        className="mt-0.5 size-3.5 shrink-0 opacity-80"
        strokeWidth={2}
        aria-hidden
      />
      <span>{text}</span>
    </div>
  )
}
