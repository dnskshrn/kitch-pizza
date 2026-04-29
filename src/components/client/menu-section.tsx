"use client"

import type { CategoryWithItems } from "@/types/database"
import { useEffect, useState } from "react"
import { MenuItemCard } from "./menu-item-card"

const LANG_KEY = "lang"

type Lang = "RU" | "RO"

function readLang(): Lang {
  if (typeof window === "undefined") return "RU"
  return window.localStorage.getItem(LANG_KEY) === "RO" ? "RO" : "RU"
}

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
  const [lang, setLang] = useState<Lang>("RU")
  const isLosos = brandSlug === "losos"
  const isBoutiqueMenu = hasBoutiqueMenu(brandSlug)

  useEffect(() => {
    setLang(readLang())
  }, [])

  if (data.length === 0) return null

  return (
    <section
      id="menu"
      className={
        isLosos
          ? "mt-7 space-y-7 md:mt-9 md:space-y-9"
          : isBoutiqueMenu
            ? "mt-8 space-y-8 md:mt-10 md:space-y-10"
            : "mt-10 space-y-10"
      }
    >
      {data.map(({ category, items }) => {
        const title = lang === "RO" ? category.name_ro : category.name_ru
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
                isLosos
                  ? "mb-4 text-[30px] font-bold leading-none tracking-[-0.04em] text-[var(--color-text)] md:mb-5 md:text-[38px] lg:text-[44px]"
                  : isBoutiqueMenu
                    ? "mb-5 text-[28px] font-bold leading-none tracking-tight text-[var(--color-text)] md:mb-6 md:text-[32px] lg:text-[36px]"
                    : "mb-4 text-xl font-bold tracking-tight md:text-2xl"
              }
            >
              {title}
            </h2>
            <div
              className={
                isLosos
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
