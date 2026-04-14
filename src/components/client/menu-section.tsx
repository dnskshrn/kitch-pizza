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

export type MenuSectionProps = {
  data: CategoryWithItems[]
}

export function MenuSection({ data }: MenuSectionProps) {
  const [lang, setLang] = useState<Lang>("RU")

  useEffect(() => {
    setLang(readLang())
  }, [])

  if (data.length === 0) return null

  return (
    <section className="mt-10 space-y-10">
      {data.map(({ category, items }) => {
        const title = lang === "RO" ? category.name_ro : category.name_ru
        return (
          <div key={category.id}>
            <h2 className="mb-4 text-xl font-bold tracking-tight md:text-2xl">
              {title}
            </h2>
            <div className="client-menu-grid">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="client-menu-card border-b border-[#f0f0f0] pb-4 last:border-b-0 md:border-b-0 md:pb-0"
                >
                  <MenuItemCard item={item} lang={lang} />
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </section>
  )
}
