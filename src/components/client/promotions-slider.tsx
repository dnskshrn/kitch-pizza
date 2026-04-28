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
const AUTOSLIDE_INTERVAL_MS = 5000

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

function theSpotCardWidthExpr(windowWidth: number): string {
  if (windowWidth < 760) return "100%"
  if (windowWidth < 1024) return "calc((100% - 20px) / 2)"
  return "calc((100% - 40px) / 3)"
}

export type PromotionsSliderProps = {
  brandSlug?: string
  promotions: StorefrontPromotion[]
}

export function PromotionsSlider({
  brandSlug = "kitch-pizza",
  promotions,
}: PromotionsSliderProps) {
  const windowWidth = useWindowWidth()
  const scrollRef = useRef<HTMLDivElement>(null)
  const touchStartX = useRef<number | null>(null)
  const touchStartIndex = useRef(0)
  const activeIndexRef = useRef(0)
  const autoslideTimeoutRef = useRef<number | null>(null)

  const [lang, setLang] = useState<Lang>("RU")
  const [activeIndex, setActiveIndex] = useState(0)

  const isMobile = windowWidth < 760
  const showArrows = promotions.length > 1

  const isTheSpot = brandSlug === "the-spot"
  const sectionClassName = isTheSpot ? "mb-5 w-full md:mb-5" : "w-full"
  const theSpotMobileCardHeight =
    isTheSpot && isMobile ? "clamp(180px, calc(56.25vw - 18px), 220px)" : undefined

  const cardWidth = useMemo(
    () => (isTheSpot ? theSpotCardWidthExpr(windowWidth) : cardWidthExpr(windowWidth)),
    [isTheSpot, windowWidth],
  )

  useEffect(() => {
    setLang(readLang())
  }, [])

  useEffect(() => {
    activeIndexRef.current = activeIndex
  }, [activeIndex])

  const clearAutoslideTimeout = useCallback(() => {
    if (autoslideTimeoutRef.current === null) return
    window.clearTimeout(autoslideTimeoutRef.current)
    autoslideTimeoutRef.current = null
  }, [])

  const getStride = useCallback((): number => {
    const el = scrollRef.current
    const first = el?.firstElementChild as HTMLElement | undefined
    if (!first) return 0
    const gap = isTheSpot && windowWidth >= 760 ? 20 : GAP_PX
    return first.offsetWidth + gap
  }, [isTheSpot, windowWidth])

  const getMaxIndex = useCallback((): number => {
    const el = scrollRef.current
    const stride = getStride()
    if (!el || stride <= 0 || promotions.length === 0) return 0
    const maxScrollLeft = Math.max(0, el.scrollWidth - el.clientWidth)
    return Math.min(promotions.length - 1, Math.round(maxScrollLeft / stride))
  }, [getStride, promotions.length])

  const updateActiveFromScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el || promotions.length === 0) return
    const stride = getStride()
    if (stride <= 0) return
    const idx = Math.round(el.scrollLeft / stride)
    setActiveIndex(Math.min(Math.max(0, idx), getMaxIndex()))
  }, [getMaxIndex, getStride, promotions.length])

  const scrollToIndex = useCallback(
    (index: number, behavior: ScrollBehavior = "smooth") => {
      const el = scrollRef.current
      if (!el || promotions.length === 0) return
      const stride = getStride()
      if (stride <= 0) return
      const maxIndex = getMaxIndex()
      const i = index < 0 ? maxIndex : index > maxIndex ? 0 : index
      setActiveIndex(i)
      el.scrollTo({ left: i * stride, behavior })
    },
    [getMaxIndex, getStride, promotions.length],
  )

  const scheduleAutoslide = useCallback(() => {
    clearAutoslideTimeout()
    if (promotions.length <= 1) return

    autoslideTimeoutRef.current = window.setTimeout(() => {
      const maxIndex = getMaxIndex()
      const nextIndex = activeIndexRef.current >= maxIndex ? 0 : activeIndexRef.current + 1
      scrollToIndex(nextIndex)
    }, AUTOSLIDE_INTERVAL_MS)
  }, [
    clearAutoslideTimeout,
    getMaxIndex,
    promotions.length,
    scrollToIndex,
  ])

  const scrollPrev = useCallback(() => {
    scheduleAutoslide()
    scrollToIndex(activeIndex - 1)
  }, [activeIndex, scheduleAutoslide, scrollToIndex])

  const scrollNext = useCallback(() => {
    scheduleAutoslide()
    scrollToIndex(activeIndex + 1)
  }, [activeIndex, scheduleAutoslide, scrollToIndex])

  useEffect(() => {
    scheduleAutoslide()
    return clearAutoslideTimeout
  }, [activeIndex, clearAutoslideTimeout, scheduleAutoslide])

  const onTouchStart = (e: React.TouchEvent) => {
    if (!isTheSpot && !isMobile) return
    scheduleAutoslide()
    touchStartX.current = e.touches[0]?.clientX ?? null
    touchStartIndex.current = activeIndex
  }

  const onTouchEnd = (e: React.TouchEvent) => {
    if (!isTheSpot && !isMobile) return
    const start = touchStartX.current
    touchStartX.current = null
    if (start == null) return
    const end = e.changedTouches[0]?.clientX
    if (end == null) return
    const dx = start - end
    if (Math.abs(dx) < SWIPE_THRESHOLD_PX) {
      scrollToIndex(touchStartIndex.current)
      return
    }
    scrollToIndex(touchStartIndex.current + (dx > 0 ? 1 : -1))
  }

  if (isTheSpot && promotions.length === 0) {
    return (
      <section id="promotions" className={sectionClassName} aria-label="Акции">
        <div className="flex gap-4 overflow-x-auto py-2 md:gap-5 md:overflow-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div
            className="aspect-[16/9] w-full shrink-0 rounded-[var(--radius-card)] bg-white md:flex-1"
            style={{ height: theSpotMobileCardHeight }}
          />
          <div
            className="aspect-[16/9] w-full shrink-0 rounded-[var(--radius-card)] bg-white md:flex-1"
            style={{ height: theSpotMobileCardHeight }}
          />
          <div className="hidden rounded-[var(--radius-card)] bg-white md:block md:flex-1 md:aspect-[16/9]" />
        </div>
      </section>
    )
  }

  if (promotions.length === 0) {
    return null
  }

  return (
    <section id="promotions" className={sectionClassName} aria-label="Акции">
      <div className="relative isolate w-full overflow-hidden">
        {showArrows && (
          <>
            <button
              type="button"
              aria-label="Предыдущая акция"
              className="absolute top-1/2 left-3 z-10 flex h-10 w-10 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-white transition-all duration-200 hover:opacity-90 active:scale-[0.96] md:left-4 md:h-11 md:w-11"
              onClick={scrollPrev}
            >
              <ChevronLeft className="h-5 w-5 text-neutral-700 md:h-6 md:w-6" strokeWidth={2} />
            </button>
            <button
              type="button"
              aria-label="Следующая акция"
              className="absolute top-1/2 right-3 z-10 flex h-10 w-10 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-white transition-all duration-200 hover:opacity-90 active:scale-[0.96] md:right-4 md:h-11 md:w-11"
              onClick={scrollNext}
            >
              <ChevronRight className="h-5 w-5 text-neutral-700 md:h-6 md:w-6" strokeWidth={2} />
            </button>
          </>
        )}

        <div
          ref={scrollRef}
          className="relative z-0 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth overscroll-x-contain md:gap-5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          style={{ scrollBehavior: "smooth" }}
          onScroll={updateActiveFromScroll}
          onWheel={scheduleAutoslide}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          {promotions.map((p) => {
            const src = promotionImageUrl(p, lang)
            const alt = lang === "RO" ? "Promoție" : "Акция"
            return (
              <article
                key={p.id}
                className={
                  isTheSpot
                    ? "relative z-0 shrink-0 snap-start overflow-hidden rounded-[var(--radius-card)] bg-white"
                    : "relative shrink-0 snap-start overflow-hidden rounded-2xl bg-transparent"
                }
                style={{
                  flexBasis: cardWidth,
                  width: cardWidth,
                  height: theSpotMobileCardHeight,
                  aspectRatio: "16 / 9",
                }}
              >
                {src ? (
                  <Image
                    src={src}
                    alt={alt}
                    fill
                    className="z-0 object-cover"
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
    </section>
  )
}
