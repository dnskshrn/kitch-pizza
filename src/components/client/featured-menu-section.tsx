"use client"

import {
  getMenuItemPriceLabels,
  type MenuItemPriceLabels,
} from "@/components/client/menu-item-card"
import { useProductModalStore } from "@/lib/store/product-modal-store"
import type { MenuItem } from "@/types/database"
import { ChevronLeft, ChevronRight } from "lucide-react"
import Image from "next/image"
import { useEffect, useRef, useState } from "react"

const LANG_KEY = "lang"

type Lang = "RU" | "RO"

type FeaturedMenuSectionProps = {
  brandSlug?: string
  items: MenuItem[]
}

function readLang(): Lang {
  if (typeof window === "undefined") return "RU"
  return window.localStorage.getItem(LANG_KEY) === "RO" ? "RO" : "RU"
}

function normalizeMdl(label: string | null): string | null {
  return label?.replace("лей", "MDL").replace("lei", "MDL") ?? null
}

function PriceBlock({ priceMain, priceCompare }: MenuItemPriceLabels) {
  const main = normalizeMdl(priceMain)
  const compare = normalizeMdl(priceCompare)

  return (
    <div className="flex min-w-0 flex-col gap-1 tabular-nums">
      {compare ? (
        <span className="text-[12px] font-normal leading-none text-[rgb(36_36_36_/_60%)] line-through">
          {compare}
        </span>
      ) : null}
      {main ? (
        <span className="text-[14px] font-semibold leading-none text-[var(--color-text)]">
          {main}
        </span>
      ) : null}
    </div>
  )
}

function FeaturedMenuCard({ item, lang }: { item: MenuItem; lang: Lang }) {
  const openProductModal = useProductModalStore((state) => state.open)
  const name = lang === "RO" ? item.name_ro : item.name_ru
  const priceLabels = getMenuItemPriceLabels(item, lang)
  const ariaLabel = priceLabels.priceMain
    ? `${name}. ${priceLabels.priceMain}. Выбрать товар`
    : `${name}. Выбрать товар`

  return (
    <button
      type="button"
      onClick={() => openProductModal(item)}
      aria-label={ariaLabel}
      className="group flex min-h-[120px] w-[300px] shrink-0 items-stretch overflow-hidden rounded-[12px] bg-white text-left transition-transform duration-200 hover:-translate-y-0.5 md:w-[340px]"
    >
      <div className="relative min-h-[120px] w-[112px] shrink-0 self-stretch overflow-hidden bg-white md:w-[124px]">
        {item.image_url ? (
          <Image
            src={item.image_url}
            alt=""
            fill
            className="object-cover transition-transform duration-300 ease-out group-hover:scale-[1.03]"
            sizes="124px"
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center text-xs text-[var(--color-muted)]"
            aria-hidden
          >
            {lang === "RO" ? "Fără foto" : "Нет фото"}
          </div>
        )}
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 px-4 py-5 md:gap-4 md:py-6">
        <h3 className="truncate text-[17px] font-semibold leading-snug tracking-[-0.02em] text-[var(--color-text)] md:text-[18px] md:leading-snug">
          {name}
        </h3>
        <div className="mt-auto flex items-center justify-between gap-4">
          <PriceBlock {...priceLabels} />
          <span
            className="flex h-[43px] min-w-[54px] shrink-0 items-center justify-center rounded-full bg-[#f4f4f6] px-5 text-[26px] font-light leading-none text-[#808080] transition-colors duration-200 group-hover:bg-[var(--color-accent)] group-hover:text-white md:min-w-[64px] md:px-6"
            aria-hidden
          >
            +
          </span>
        </div>
      </div>
    </button>
  )
}

export function FeaturedMenuSection({
  brandSlug = "kitch-pizza",
  items,
}: FeaturedMenuSectionProps) {
  const [lang, setLang] = useState<Lang>("RU")
  const scrollerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    setLang(readLang())
  }, [])

  if (brandSlug !== "losos" || items.length === 0) return null

  function scrollByCard(direction: "prev" | "next") {
    const scroller = scrollerRef.current
    if (!scroller) return

    scroller.scrollBy({
      left: direction === "next" ? 360 : -360,
      behavior: "smooth",
    })
  }

  return (
    <section className="mt-9 space-y-6 md:mt-12 md:space-y-9">
      <div className="flex items-center justify-between gap-9">
        <h2 className="min-w-0 flex-1 text-[30px] font-semibold leading-none tracking-[-0.035em] text-[var(--color-text)] md:text-[32px]">
          {lang === "RO" ? "Nou si popular" : "Новое и популярное"}
        </h2>
        {items.length > 1 ? (
          <div className="flex shrink-0 items-center gap-3">
            <button
              type="button"
              onClick={() => scrollByCard("prev")}
              aria-label="Прокрутить назад"
              className="flex h-[46px] w-[46px] items-center justify-center rounded-full bg-white text-[var(--color-text)] transition-colors duration-200 hover:bg-[var(--color-accent)] hover:text-white"
            >
              <ChevronLeft className="h-5 w-5" strokeWidth={2} />
            </button>
            <button
              type="button"
              onClick={() => scrollByCard("next")}
              aria-label="Прокрутить вперед"
              className="flex h-[46px] w-[46px] items-center justify-center rounded-full bg-white text-[var(--color-text)] transition-colors duration-200 hover:bg-[var(--color-accent)] hover:text-white"
            >
              <ChevronRight className="h-5 w-5" strokeWidth={2} />
            </button>
          </div>
        ) : null}
      </div>
      <div
        ref={scrollerRef}
        className="-mx-4 overflow-x-auto scroll-smooth px-4 [scrollbar-width:none] xl:mx-0 xl:px-0 [&::-webkit-scrollbar]:hidden"
      >
        <div className="flex w-max gap-5">
          {items.map((item) => (
            <FeaturedMenuCard key={item.id} item={item} lang={lang} />
          ))}
        </div>
      </div>
    </section>
  )
}
