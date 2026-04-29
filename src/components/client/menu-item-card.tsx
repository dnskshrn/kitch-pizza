"use client"

import { calcCompareAt } from "@/lib/discount"
import { useProductModalStore } from "@/lib/store/product-modal-store"
import type { MenuItem } from "@/types/database"
import Image from "next/image"
import { ItemBadge } from "./item-badge"

export type MenuItemCardProps = {
  brandSlug?: string
  item: MenuItem
  lang: "RU" | "RO"
}

function hasTheSpotCard(brandSlug: string): boolean {
  return brandSlug === "the-spot"
}

function formatLeiFromBani(bani: number, lang: "RU" | "RO"): string {
  const lei = bani / 100
  const formatted = lei.toLocaleString("ro-MD", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
  return lang === "RO" ? `${formatted} lei` : `${formatted} лей`
}

function getDisplayPriceBani(item: MenuItem): number | null {
  if (item.has_sizes) {
    const candidates = [item.price, item.size_s_price, item.size_l_price].filter(
      (v): v is number => typeof v === "number",
    )
    if (candidates.length === 0) return null
    return Math.min(...candidates)
  }
  if (item.price == null) return null
  return item.price
}

function hasActiveDiscount(item: MenuItem): boolean {
  const d = item.discount_percent
  return d != null && d > 0 && d < 100
}

export type MenuItemPriceLabels = {
  priceMain: string | null
  priceCompare: string | null
}

/** Общая логика цен для карточки и мобильной строки (как на десктопе). */
export function getMenuItemPriceLabels(
  item: MenuItem,
  lang: "RU" | "RO",
): MenuItemPriceLabels {
  const priceBani = getDisplayPriceBani(item)
  const discount = hasActiveDiscount(item) ? item.discount_percent! : null

  const priceLabelNoDiscount =
    priceBani != null
      ? item.has_sizes
        ? lang === "RO"
          ? `de la ${formatLeiFromBani(priceBani, lang)}`
          : `от ${formatLeiFromBani(priceBani, lang)}`
        : formatLeiFromBani(priceBani, lang)
      : null

  let priceMain: string | null = null
  let priceCompare: string | null = null

  if (priceBani != null && discount != null) {
    const compareBani = calcCompareAt(priceBani, discount)
    priceCompare = formatLeiFromBani(compareBani, lang)
    if (item.has_sizes) {
      priceMain =
        lang === "RO"
          ? `de la ${formatLeiFromBani(priceBani, lang)}`
          : `от ${formatLeiFromBani(priceBani, lang)}`
    } else {
      priceMain = formatLeiFromBani(priceBani, lang)
    }
  } else {
    priceMain = priceLabelNoDiscount
  }

  return { priceMain, priceCompare }
}

function MenuItemPriceBlock({
  priceMain,
  priceCompare,
  className,
}: MenuItemPriceLabels & { className?: string }) {
  return (
    <p
      className={
        className ??
        "flex min-w-0 flex-1 flex-wrap items-baseline gap-x-1.5 text-sm font-medium tabular-nums leading-tight"
      }
    >
      {priceMain ? <span>{priceMain}</span> : null}
      {priceCompare ? (
        <span className="mr-1 text-xs text-gray-400 line-through">
          {priceCompare}
        </span>
      ) : null}
    </p>
  )
}

const CHOOSE_BTN_CLASS =
  "inline-flex shrink-0 cursor-pointer items-center rounded-full bg-[#ECFFA1] font-semibold text-[#5F7600] transition-all duration-200 hover:bg-[#d4f000] active:scale-[0.97]"

function cardAriaLabel(
  name: string,
  priceMain: string | null,
  lang: "RU" | "RO",
): string {
  const action = lang === "RO" ? "Alege produsul" : "Выбрать товар"
  if (priceMain) return `${name}. ${priceMain}. ${action}`
  return `${name}. ${action}`
}

export function MenuItemCard({
  brandSlug = "kitch-pizza",
  item,
  lang,
}: MenuItemCardProps) {
  const openProductModal = useProductModalStore((s) => s.open)

  const name = lang === "RO" ? item.name_ro : item.name_ru
  const description =
    lang === "RO" ? item.description_ro : item.description_ru

  const { priceMain, priceCompare } = getMenuItemPriceLabels(item, lang)
  const aria = cardAriaLabel(name, priceMain, lang)

  const openModal = () => openProductModal(item)
  const isTheSpot = hasTheSpotCard(brandSlug)
  const isLosos = brandSlug === "losos"

  return (
    <div className="h-full md:flex md:flex-col">
      {/* Mobile: вся строка — одна кнопка */}
      {isLosos ? (
        <button
          type="button"
          onClick={openModal}
          aria-label={aria}
          className="group flex w-full flex-col overflow-hidden rounded-[18px] bg-white text-left md:hidden"
        >
          <div className="relative aspect-[1.08] w-full overflow-hidden bg-white">
            {item.image_url ? (
              <Image
                src={item.image_url}
                alt=""
                fill
                className="object-contain p-4 transition-transform duration-300 ease-out group-hover:scale-[1.03]"
                sizes="50vw"
              />
            ) : null}
            {item.tag ? (
              <span className="absolute left-4 top-4 z-10 max-w-[78px] rounded-[10px] bg-[#ff5a2f] px-2.5 py-1.5 text-center text-[10px] font-bold leading-[0.98] text-white">
                {item.tag.toLowerCase() === "новинка" ? (
                  <>
                    новый
                    <br />
                    рецепт
                  </>
                ) : (
                  item.tag
                )}
              </span>
            ) : null}
          </div>
          <div className="flex min-h-[150px] w-full flex-col border-t border-[#f0f0f2] px-4 pb-4 pt-4">
            <h3 className="line-clamp-2 text-[21px] font-bold leading-[1.08] tracking-[-0.035em] text-[var(--color-text)]">
              {name}
            </h3>
            <div className="mt-auto flex items-end justify-between gap-3 pt-5">
              <div className="min-w-0">
                {priceCompare ? (
                  <p className="mb-1 text-[13px] font-normal leading-none text-[#8f8f95] line-through tabular-nums">
                    {priceCompare.replace("лей", "MDL")}
                  </p>
                ) : null}
                {priceMain ? (
                  <p className="text-[17px] font-bold leading-none tracking-[-0.02em] text-[var(--color-text)] tabular-nums">
                    {priceMain.replace("лей", "MDL")}
                  </p>
                ) : null}
              </div>
              <span
                className="flex h-[54px] w-[64px] shrink-0 items-center justify-center rounded-full bg-[#f4f4f6] text-[38px] font-light leading-none text-[#77777d] transition-colors duration-200 group-hover:bg-[var(--color-accent)] group-hover:text-white"
                aria-hidden
              >
                +
              </span>
            </div>
          </div>
        </button>
      ) : isTheSpot ? (
        <button
          type="button"
          onClick={openModal}
          aria-label={aria}
          className="group flex w-full flex-col gap-3 text-left md:hidden"
        >
          <div className="relative aspect-square w-full overflow-hidden rounded-[12px] bg-white">
            {item.image_url ? (
              <Image
                src={item.image_url}
                alt=""
                fill
                className="object-cover transition-transform duration-300 ease-out group-hover:scale-[1.03]"
                sizes="50vw"
              />
            ) : null}
          </div>
          <div className="min-w-0">
            <h3 className="line-clamp-2 text-[17px] font-bold leading-[1.12] text-[var(--color-text)]">
              {name}
            </h3>
            {description ? (
              <p className="mt-2 line-clamp-4 text-[13px] font-normal leading-[1.2] text-[var(--color-muted)]">
                {description}
              </p>
            ) : null}
            {priceMain ? (
              <div className="mt-3 inline-flex rounded-full bg-[var(--color-accent-soft)] px-3 py-2 text-[14px] font-bold leading-none text-[var(--color-accent-text)]">
                <MenuItemPriceBlock
                  priceMain={priceMain.replace("лей", "MDL")}
                  priceCompare={priceCompare}
                  className="flex min-w-0 items-baseline gap-x-1 tabular-nums"
                />
              </div>
            ) : null}
          </div>
        </button>
      ) : (
        <button
          type="button"
          onClick={openModal}
          aria-label={aria}
          className="group flex w-full gap-3 text-left md:hidden"
        >
          <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-[12px]">
            {item.image_url ? (
              <div className="absolute inset-0 transition-transform duration-300 ease-out will-change-transform group-hover:-translate-y-1.5">
                <Image
                  src={item.image_url}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="80px"
                />
              </div>
            ) : (
              <div
                className="flex h-full w-full items-center justify-center text-[10px] text-zinc-400"
                aria-hidden
              >
                {lang === "RO" ? "Fără foto" : "Нет фото"}
              </div>
            )}
          </div>
          <div className="flex min-h-20 min-w-0 flex-1 flex-col justify-between gap-2">
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-2">
                <h3 className="min-w-0 flex-1 truncate font-bold leading-tight">
                  {name}
                </h3>
                {item.tag ? (
                  <span className="shrink-0">
                    <ItemBadge tag={item.tag} size="compact" />
                  </span>
                ) : null}
              </div>
              {description ? (
                <p className="mt-0.5 line-clamp-2 text-sm font-normal leading-snug text-zinc-500">
                  {description}
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <MenuItemPriceBlock
                priceMain={priceMain}
                priceCompare={priceCompare}
                className="flex min-w-0 flex-wrap items-baseline gap-x-1 text-sm font-medium tabular-nums leading-tight"
              />
              <span
                className={`pointer-events-none px-3 py-1.5 text-xs ${CHOOSE_BTN_CLASS}`}
                aria-hidden
              >
                {lang === "RO" ? "Alege" : "Выбрать"}
              </span>
            </div>
          </div>
        </button>
      )}

      {/* Desktop: вся карточка — одна кнопка */}
      {isLosos ? (
        <button
          type="button"
          onClick={openModal}
          aria-label={aria}
          className="group hidden h-full w-full flex-col overflow-hidden rounded-[18px] bg-white text-left transition-transform duration-200 hover:-translate-y-0.5 md:flex"
        >
          <div className="relative aspect-[1.08] w-full overflow-hidden bg-white">
            {item.image_url ? (
              <Image
                src={item.image_url}
                alt=""
                fill
                className="object-contain p-5 transition-transform duration-300 ease-out group-hover:scale-[1.03]"
                sizes="(max-width: 1023px) 31vw, (max-width: 1279px) 30vw, 286px"
              />
            ) : (
              <div
                className="flex h-full w-full items-center justify-center text-xs text-[var(--color-muted)]"
                aria-hidden
              >
                {lang === "RO" ? "Fără foto" : "Нет фото"}
              </div>
            )}
            {item.tag ? (
              <span className="absolute left-7 top-7 z-10 max-w-[92px] rounded-[12px] bg-[#ff5a2f] px-3 py-2 text-center text-[14px] font-bold leading-[0.98] text-white">
                {item.tag.toLowerCase() === "новинка" ? (
                  <>
                    новый
                    <br />
                    рецепт
                  </>
                ) : (
                  item.tag
                )}
              </span>
            ) : null}
          </div>
          <div className="flex min-h-[188px] w-full flex-1 flex-col border-t border-[#f0f0f2] px-7 pb-7 pt-7">
            <h3 className="line-clamp-2 text-[24px] font-bold leading-[1.08] tracking-[-0.035em] text-[var(--color-text)] lg:text-[28px]">
              {name}
            </h3>
            <div className="mt-auto flex items-end justify-between gap-4 pt-6">
              <div className="min-w-0">
                {priceCompare ? (
                  <p className="mb-2 text-[16px] font-normal leading-none text-[#8f8f95] line-through tabular-nums">
                    {priceCompare.replace("лей", "MDL")}
                  </p>
                ) : null}
                {priceMain ? (
                  <p className="text-[22px] font-bold leading-none tracking-[-0.02em] text-[var(--color-text)] tabular-nums">
                    {priceMain.replace("лей", "MDL")}
                  </p>
                ) : null}
              </div>
              <span
                className="flex h-[64px] w-[78px] shrink-0 items-center justify-center rounded-full bg-[#f4f4f6] text-[46px] font-light leading-none text-[#77777d] transition-colors duration-200 group-hover:bg-[var(--color-accent)] group-hover:text-white"
                aria-hidden
              >
                +
              </span>
            </div>
          </div>
        </button>
      ) : isTheSpot ? (
        <button
          type="button"
          onClick={openModal}
          aria-label={aria}
          className="group hidden h-full w-full flex-col gap-3 text-left md:flex"
        >
          <div className="relative aspect-square w-full overflow-hidden rounded-[var(--radius-card)] bg-white">
            {item.image_url ? (
              <Image
                src={item.image_url}
                alt=""
                fill
                className="object-cover transition-transform duration-300 ease-out group-hover:scale-[1.03]"
                sizes="(max-width: 1023px) 31vw, (max-width: 1279px) 30vw, 286px"
              />
            ) : (
              <div
                className="flex h-full w-full items-center justify-center text-xs text-[var(--color-muted)]"
                aria-hidden
              >
                {lang === "RO" ? "Fără foto" : "Нет фото"}
              </div>
            )}
            {item.tag ? (
              <div className="pointer-events-none absolute right-3 top-3 z-10">
                <ItemBadge tag={item.tag} />
              </div>
            ) : null}
          </div>
          <div className="flex min-h-0 flex-1 flex-col">
            <h3 className="line-clamp-2 text-[18px] font-bold leading-[1.12] tracking-[-0.01em] text-[var(--color-text)] lg:text-[20px]">
              {name}
            </h3>
            {description ? (
              <p className="mt-2 line-clamp-3 text-[14px] leading-snug text-[var(--color-muted)]">
                {description}
              </p>
            ) : null}
            {priceMain ? (
              <div className="mt-3 inline-flex w-fit rounded-full bg-[var(--color-accent-soft)] px-3.5 py-2 text-[15px] font-bold leading-none text-[var(--color-accent-text)] transition-all duration-200 group-hover:bg-[var(--color-accent)] group-hover:text-white">
                <MenuItemPriceBlock
                  priceMain={priceMain.replace("лей", "MDL")}
                  priceCompare={priceCompare}
                  className="flex min-w-0 items-baseline gap-x-1 tabular-nums"
                />
              </div>
            ) : null}
          </div>
        </button>
      ) : (
        <button
          type="button"
          onClick={openModal}
          aria-label={aria}
          className="group hidden h-full w-full flex-col gap-3 text-left md:flex"
        >
          <div className="relative aspect-square w-full overflow-hidden">
            {item.image_url ? (
              <>
                <div className="absolute inset-0 transition-transform duration-300 ease-out will-change-transform group-hover:-translate-y-2">
                  <Image
                    src={item.image_url}
                    alt=""
                    fill
                    className="object-contain"
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
                  />
                </div>
                <div className="pointer-events-none absolute right-2 top-2 z-10">
                  <ItemBadge tag={item.tag} />
                </div>
              </>
            ) : (
              <div
                className="flex h-full w-full items-center justify-center text-xs text-muted-foreground"
                aria-hidden
              >
                {lang === "RO" ? "Fără foto" : "Нет фото"}
              </div>
            )}
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-1">
            <h3 className="font-bold leading-tight">{name}</h3>
            {description ? (
              <p className="line-clamp-3 text-sm text-zinc-500">{description}</p>
            ) : null}
            <div className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 pt-2">
              <MenuItemPriceBlock priceMain={priceMain} priceCompare={priceCompare} />
              <span
                className={`pointer-events-none px-4 py-2 text-sm ${CHOOSE_BTN_CLASS}`}
                aria-hidden
              >
                {lang === "RO" ? "Alege" : "Выбрать"}
              </span>
            </div>
          </div>
        </button>
      )}
    </div>
  )
}
