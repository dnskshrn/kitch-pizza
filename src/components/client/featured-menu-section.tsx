"use client"

import {
  getMenuItemPriceLabels,
  type MenuItemPriceLabels,
} from "@/components/client/menu-item-card"
import { pickLocalizedName } from "@/lib/i18n/storefront"
import { useLanguage } from "@/lib/store/language-store"
import { useProductModalStore } from "@/lib/store/product-modal-store"
import type { MenuItem } from "@/types/database"
import { ChevronLeft, ChevronRight } from "lucide-react"
import Image from "next/image"
import { useId } from "react"
import { Navigation } from "swiper/modules"
import { Swiper, SwiperSlide } from "swiper/react"
import "swiper/css"
import "swiper/css/navigation"

type FeaturedMenuSectionProps = {
  brandSlug?: string
  items: MenuItem[]
}

function hasBoutiqueFeaturedMenu(brandSlug: string): boolean {
  return brandSlug === "the-spot" || brandSlug === "losos"
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

function FeaturedMenuCard({ item }: { item: MenuItem }) {
  const openProductModal = useProductModalStore((state) => state.open)
  const { lang, t } = useLanguage()
  const name = pickLocalizedName(item, lang)
  const priceLabels = getMenuItemPriceLabels(item, lang)
  const ariaLabel = priceLabels.priceMain
    ? `${name}. ${priceLabels.priceMain}. ${t.menu.chooseProduct}`
    : `${name}. ${t.menu.chooseProduct}`

  return (
    <button
      type="button"
      onClick={() => openProductModal(item)}
      aria-label={ariaLabel}
      className="group flex h-full min-h-0 w-full items-stretch overflow-hidden rounded-[12px] bg-white text-left transition-transform duration-200 hover:-translate-y-0.5"
    >
      <div className="relative w-[min(108px,34%)] shrink-0 self-stretch overflow-hidden bg-white md:w-[120px]">
        {item.image_url ? (
          <Image
            src={item.image_url}
            alt=""
            fill
            className="object-cover transition-transform duration-300 ease-out group-hover:scale-[1.03]"
            sizes="(max-width: 768px) 120px, 128px"
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center text-xs text-[var(--color-muted)]"
            aria-hidden
          >
            {t.common.noPhoto}
          </div>
        )}
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 px-3 py-4 md:gap-4 md:px-4 md:py-6">
        <h3 className="break-words text-[16px] font-semibold leading-snug tracking-[-0.02em] text-[var(--color-text)] md:text-[18px] md:leading-snug">
          {name}
        </h3>
        <div className="mt-auto flex items-center justify-between gap-3 md:gap-4">
          <PriceBlock {...priceLabels} />
          <span
            className="flex h-10 min-w-[48px] shrink-0 items-center justify-center rounded-full bg-[var(--color-bg)] px-4 text-[22px] font-light leading-none text-[#808080] transition-colors duration-200 group-hover:bg-[var(--color-accent)] group-hover:text-white md:h-[43px] md:min-w-[54px] md:px-5 md:text-[26px]"
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
  const { t } = useLanguage()
  const navigationId = useId()
  const prevSelector = `[data-featured-prev="${navigationId}"]`
  const nextSelector = `[data-featured-next="${navigationId}"]`

  if (!hasBoutiqueFeaturedMenu(brandSlug) || items.length === 0) return null

  return (
    <section className="@container mt-9 w-full min-w-0 space-y-6 md:mt-12 md:space-y-9">
      <div className="flex items-center justify-between gap-4 md:gap-9">
        <h2 className="min-w-0 flex-1 text-[30px] font-semibold leading-none tracking-[-0.035em] text-[var(--color-text)] md:text-[32px]">
          {t.menu.featuredTitle}
        </h2>
        {items.length > 1 ? (
          <div className="flex shrink-0 items-center gap-2 md:gap-3">
            <button
              type="button"
              data-featured-prev={navigationId}
              aria-label={t.menu.featuredPrev}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-[var(--color-text)] transition-colors duration-200 hover:bg-[var(--color-accent)] hover:text-white md:h-[46px] md:w-[46px] [&.swiper-button-disabled]:pointer-events-none [&.swiper-button-disabled]:opacity-40"
            >
              <ChevronLeft className="h-5 w-5" strokeWidth={2} />
            </button>
            <button
              type="button"
              data-featured-next={navigationId}
              aria-label={t.menu.featuredNext}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-[var(--color-text)] transition-colors duration-200 hover:bg-[var(--color-accent)] hover:text-white md:h-[46px] md:w-[46px] [&.swiper-button-disabled]:pointer-events-none [&.swiper-button-disabled]:opacity-40"
            >
              <ChevronRight className="h-5 w-5" strokeWidth={2} />
            </button>
          </div>
        ) : null}
      </div>
      <Swiper
        modules={[Navigation]}
        slidesPerView={1.12}
        spaceBetween={16}
        slidesOffsetAfter={16}
        watchOverflow
        navigation={
          items.length > 1
            ? {
                prevEl: prevSelector,
                nextEl: nextSelector,
              }
            : false
        }
        breakpoints={{
          768: {
            slidesPerView: 2.5,
            spaceBetween: 20,
            slidesOffsetAfter: 20,
          },
          1280: {
            slidesPerView: 3.05,
            spaceBetween: 20,
            slidesOffsetAfter: 20,
          },
        }}
        className="w-full min-w-0"
      >
        {items.map((item) => (
          <SwiperSlide key={item.id} className="h-auto">
            <FeaturedMenuCard item={item} />
          </SwiperSlide>
        ))}
      </Swiper>
    </section>
  )
}
