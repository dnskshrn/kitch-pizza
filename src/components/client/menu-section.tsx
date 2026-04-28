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

export type MenuSectionProps = {
  brandSlug?: string
  data: CategoryWithItems[]
}

export function MenuSection({
  brandSlug = "kitch-pizza",
  data,
}: MenuSectionProps) {
  const [lang, setLang] = useState<Lang>("RU")

  useEffect(() => {
    setLang(readLang())
  }, [])

  if (data.length === 0) return null

  return (
    <section
      id="menu"
      className={
        brandSlug === "the-spot"
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
              brandSlug === "the-spot"
                ? "scroll-mt-[150px] md:scroll-mt-[170px]"
                : "scroll-mt-[96px] md:scroll-mt-[112px]"
            }
          >
            <h2
              className={
                brandSlug === "the-spot"
                  ? "mb-5 text-[28px] font-bold leading-none tracking-tight text-[var(--color-text)] md:mb-6 md:text-[32px] lg:text-[36px]"
                  : "mb-4 text-xl font-bold tracking-tight md:text-2xl"
              }
            >
              {title}
            </h2>
            <div
              className={
                brandSlug === "the-spot"
                  ? "grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 md:gap-x-5 md:gap-y-10 xl:grid-cols-4"
                  : "client-menu-grid"
              }
            >
              {items.map((item) => (
                <div
                  key={item.id}
                  className={
                    brandSlug === "the-spot"
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
