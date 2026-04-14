"use client"

import { useWindowWidth } from "@/hooks/use-window-width"
import type { StorefrontPromotion } from "@/types/database"
import { ChevronLeft, ChevronRight } from "lucide-react"
import Image from "next/image"
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"

const GAP_PX = 12
const SWIPE_THRESHOLD_PX = 50
const DOT_ACTIVE = "#8DC63F"

const LANG_KEY = "lang"

type Lang = "RU" | "RO"

function readLang(): Lang {
  if (typeof window === "undefined") return "RU"
  return window.localStorage.getItem(LANG_KEY) === "RO" ? "RO" : "RU"
}

function promotionImageUrl(p: StorefrontPromotion, lang: Lang): string | null {
  return lang === "RO" ? p.image_url_ro : p.image_url_ru
}

function cardWidthExpr(windowWidth: number): string {
  if (windowWidth < 760) return "100%"
  if (windowWidth < 1200) return "calc((100% - 12px * 2) / 2.5)"
  return "calc((100% - 12px * 3) / 3.5)"
}

export type PromotionsSliderProps = {
  promotions: StorefrontPromotion[]
}

export function PromotionsSlider({ promotions }: PromotionsSliderProps) {
  const windowWidth = useWindowWidth()
  const scrollRef = useRef<HTMLDivElement>(null)
  const touchStartX = useRef<number | null>(null)

  const [lang, setLang] = useState<Lang>("RU")
  const [activeIndex, setActiveIndex] = useState(0)

  const isMobile = windowWidth < 760
  const showArrows = windowWidth >= 760

  const cardWidth = useMemo(
    () => cardWidthExpr(windowWidth),
    [windowWidth],
  )

  useEffect(() => {
    setLang(readLang())
  }, [])

  const getStride = useCallback((): number => {
    const el = scrollRef.current
    const first = el?.firstElementChild as HTMLElement | undefined
    if (!first) return 0
    return first.offsetWidth + GAP_PX
  }, [])

  const updateActiveFromScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el || promotions.length === 0) return
    const stride = getStride()
    if (stride <= 0) return
    const idx = Math.round(el.scrollLeft / stride)
    setActiveIndex(Math.min(Math.max(0, idx), promotions.length - 1))
  }, [getStride, promotions.length])

  const scrollPrev = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const stride = getStride()
    if (stride <= 0) return
    const next = Math.max(0, el.scrollLeft - stride)
    el.scrollTo({ left: next, behavior: "smooth" })
  }, [getStride])

  const scrollNext = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const stride = getStride()
    if (stride <= 0) return
    const max = el.scrollWidth - el.clientWidth
    const next = Math.min(el.scrollLeft + stride, max)
    el.scrollTo({ left: next, behavior: "smooth" })
  }, [getStride])

  const scrollToIndex = useCallback(
    (index: number) => {
      const el = scrollRef.current
      if (!el || promotions.length === 0) return
      const stride = getStride()
      if (stride <= 0) return
      const maxIndex = promotions.length - 1
      const i = Math.min(Math.max(0, index), maxIndex)
      el.scrollTo({ left: i * stride, behavior: "smooth" })
    },
    [getStride, promotions.length],
  )

  const onTouchStart = (e: React.TouchEvent) => {
    if (!isMobile) return
    touchStartX.current = e.touches[0]?.clientX ?? null
  }

  const onTouchEnd = (e: React.TouchEvent) => {
    if (!isMobile) return
    const start = touchStartX.current
    touchStartX.current = null
    if (start == null) return
    const end = e.changedTouches[0]?.clientX
    if (end == null) return
    const dx = start - end
    if (Math.abs(dx) < SWIPE_THRESHOLD_PX) return
    if (dx > 0) scrollNext()
    else scrollPrev()
  }

  if (promotions.length === 0) {
    return null
  }

  return (
    <section className="w-full" aria-label="Акции">
      <div className="relative w-full overflow-hidden">
        {showArrows && (
          <>
            <button
              type="button"
              aria-label="Предыдущая акция"
              className="absolute top-1/2 left-0 z-10 flex h-11 w-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-white transition-all duration-200 hover:opacity-90 active:scale-[0.96]"
              onClick={scrollPrev}
            >
              <ChevronLeft className="h-6 w-6 text-neutral-700" strokeWidth={2} />
            </button>
            <button
              type="button"
              aria-label="Следующая акция"
              className="absolute top-1/2 right-0 z-10 flex h-11 w-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-white transition-all duration-200 hover:opacity-90 active:scale-[0.96]"
              onClick={scrollNext}
            >
              <ChevronRight className="h-6 w-6 text-neutral-700" strokeWidth={2} />
            </button>
          </>
        )}

        <div
          ref={scrollRef}
          className="flex gap-3 overflow-x-auto scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          style={{ scrollBehavior: "smooth" }}
          onScroll={isMobile ? updateActiveFromScroll : undefined}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          {promotions.map((p) => {
            const src = promotionImageUrl(p, lang)
            const alt = lang === "RO" ? "Promoție" : "Акция"
            return (
              <article
                key={p.id}
                className="relative shrink-0 overflow-hidden rounded-2xl bg-transparent"
                style={{
                  width: cardWidth,
                  aspectRatio: "4 / 3",
                }}
              >
                {src ? (
                  <Image
                    src={src}
                    alt={alt}
                    fill
                    className="object-cover"
                    sizes="(max-width: 759px) 100vw, (max-width: 1199px) 45vw, 34vw"
                  />
                ) : (
                  <div
                    className="absolute inset-0 flex items-center justify-center rounded-2xl border border-dashed border-zinc-300 text-xs text-zinc-400"
                    aria-hidden
                  >
                    {lang === "RO" ? "Fără imagine" : "Нет изображения"}
                  </div>
                )}
              </article>
            )
          })}
        </div>
      </div>

      {isMobile && promotions.length > 1 && (
        <div
          className="mt-3 flex justify-center gap-2"
          role="tablist"
          aria-label="Навигация по акциям"
        >
          {promotions.map((p, i) => (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={i === activeIndex}
              aria-label={`Слайд ${i + 1}`}
              className="h-2 w-2 cursor-pointer rounded-full transition-all duration-200"
              style={{
                borderWidth: 1,
                borderStyle: "solid",
                borderColor: i === activeIndex ? DOT_ACTIVE : "#9ca3af",
                backgroundColor: i === activeIndex ? DOT_ACTIVE : "transparent",
              }}
              onClick={() => scrollToIndex(i)}
            />
          ))}
        </div>
      )}
    </section>
  )
}
