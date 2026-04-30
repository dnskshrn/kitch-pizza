"use client"

import { pickLocalizedName } from "@/lib/i18n/storefront"
import { useLanguage } from "@/lib/store/language-store"
import type { CategoryWithItems } from "@/types/database"
import { MenuItemCard } from "./menu-item-card"

function menuCategorySectionId(slug: string): string {
  return `menu-category-${slug}`
}

function hasBoutiqueMenu(brandSlug: string): boolean {
  return brandSlug === "the-spot" || brandSlug === "losos"
}

export type MenuSectionProps = {
  brandSlug?: string
  data: CategoryWithItems[]
}

export function MenuSection({
  brandSlug = "kitch-pizza",
  data,
}: MenuSectionProps) {
  const { lang } = useLanguage()
  const hasLososStyleCards = brandSlug === "losos" || brandSlug === "the-spot"
  const isBoutiqueMenu = hasBoutiqueMenu(brandSlug)

  if (data.length === 0) return null

  return (
    <section
      id="menu"
      className={
        hasLososStyleCards
          ? "mt-7 space-y-7 md:mt-9 md:space-y-9"
          : isBoutiqueMenu
            ? "mt-8 space-y-8 md:mt-10 md:space-y-10"
            : "mt-10 space-y-10"
      }
    >
      {data.map(({ category, items }) => {
        const title = pickLocalizedName(category, lang)
        return (
          <div
            key={category.id}
            id={menuCategorySectionId(category.slug)}
            className={
              isBoutiqueMenu
                ? "scroll-mt-[150px] md:scroll-mt-[170px]"
                : "scroll-mt-[96px] md:scroll-mt-[112px]"
            }
          >
            <h2
              className={
                hasLososStyleCards
                  ? "mb-4 text-[28px] font-bold leading-none tracking-[-0.04em] text-[var(--color-text)] md:mb-5 md:text-[32px] lg:text-[36px]"
                  : isBoutiqueMenu
                    ? "mb-5 text-[28px] font-bold leading-none tracking-tight text-[var(--color-text)] md:mb-6 md:text-[32px] lg:text-[36px]"
                    : "mb-4 text-[28px] font-bold tracking-tight md:text-[32px] lg:text-[36px]"
              }
            >
              {title}
            </h2>
            <div
              className={
                hasLososStyleCards
                  ? "grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-5 xl:grid-cols-4"
                  : isBoutiqueMenu
                    ? "grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 md:gap-x-5 md:gap-y-10 xl:grid-cols-4"
                    : "client-menu-grid"
              }
            >
              {items.map((item) => (
                <div
                  key={item.id}
                  className={
                    isBoutiqueMenu
                      ? "min-w-0"
                      : "client-menu-card border-b border-[#f0f0f0] pb-4 last:border-b-0 md:border-b-0 md:pb-0"
                  }
                >
                  <MenuItemCard brandSlug={brandSlug} item={item} lang={lang} />
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </section>
  )
}
