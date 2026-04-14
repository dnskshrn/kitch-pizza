"use client"

import { ClientContainer } from "@/components/client/client-container"
import { BRAND_ACCENT } from "@/lib/client-brand"
import { selectCartItemCount, useCartStore } from "@/lib/store/cart-store"
import type { Category } from "@/types/database"
import { cn } from "@/lib/utils"
import Image from "next/image"
import Link from "next/link"
import { ShoppingBasket } from "lucide-react"
import { type ReactNode, useEffect, useRef, useState } from "react"

const LANG_KEY = "lang"

type Lang = "RU" | "RO"

function readLang(): Lang {
  if (typeof window === "undefined") return "RU"
  return window.localStorage.getItem(LANG_KEY) === "RO" ? "RO" : "RU"
}

function categoryLabel(c: Category, lang: Lang): string {
  return lang === "RO" ? c.name_ro : c.name_ru
}

type MenuCategoryBarProps = {
  categories: Category[]
}

type StickyChromeRender = (ctx: { isStuck: boolean }) => ReactNode

/** Макс. ширина слота логотипа (≈ +50% к прежним 48px) */
const STICKY_LOGO_MAX_W = 72
/** Длительность анимации логотипа в прилипшей полосе */
const STICKY_LOGO_DURATION_MS = 400
/** Плавная нелинейная кривая: быстрый старт, мягкое окончание (не linear) */
const STICKY_LOGO_EASING = "cubic-bezier(0.4, 0, 0.2, 1)"

/** Логотип в прилипшей полосе: ширина 0 → max, fade-in + сдвиг слева. */
function StickyBarLogo({ isStuck }: { isStuck: boolean }) {
  const t = `${STICKY_LOGO_DURATION_MS}ms ${STICKY_LOGO_EASING}`
  return (
    <div
      className="shrink-0 overflow-hidden"
      style={{
        maxWidth: isStuck ? STICKY_LOGO_MAX_W : 0,
        transition: `max-width ${t}`,
      }}
    >
      <Link
        href="/"
        tabIndex={isStuck ? 0 : -1}
        className={cn(
          "flex shrink-0 cursor-pointer items-center transition-all duration-200",
          isStuck
            ? "pointer-events-auto translate-x-0 opacity-100"
            : "pointer-events-none -translate-x-2 opacity-0",
        )}
        style={{
          transition: `opacity ${t}, transform ${t}`,
        }}
        aria-label="Kitch Pizza — на главную"
      >
        <Image
          src="/kitch-pizza-logo.svg"
          alt=""
          width={182}
          height={84}
          className="h-[54px] w-auto max-w-[72px] object-contain object-left"
          unoptimized
        />
      </Link>
    </div>
  )
}

/** Sentinel над sticky-блоком: когда уезжает вверх из viewport, полоса «прилипла». */
function StickyCategoryChrome({ children }: { children: StickyChromeRender }) {
  const sentinelRef = useRef<HTMLDivElement>(null)
  const [isStuck, setIsStuck] = useState(false)

  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => {
        setIsStuck(!entry.isIntersecting)
      },
      { threshold: 0, root: null, rootMargin: "0px" },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  return (
    <>
      <div
        ref={sentinelRef}
        className="h-px w-full shrink-0"
        aria-hidden
      />
      <div
        className={cn(
          "sticky top-0 z-40 transition-shadow duration-300 ease-out",
          isStuck
            ? "shadow-[0_4px_24px_rgba(0,0,0,0.07)]"
            : "shadow-none",
        )}
      >
        {/* Только фон + blur: контент не наследует opacity */}
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-0 z-0 bg-white/90 transition-[background-color] duration-300",
            isStuck && "bg-white/80",
          )}
          style={{
            WebkitBackdropFilter: "blur(50px)",
            backdropFilter: "blur(50px)",
          }}
        />
        <div className="relative z-10">{children({ isStuck })}</div>
      </div>
    </>
  )
}

export function MenuCategoryBar({ categories }: MenuCategoryBarProps) {
  const [lang, setLang] = useState<Lang>("RU")
  const [activeSlug, setActiveSlug] = useState<string | null>(null)
  const itemCount = useCartStore(selectCartItemCount)
  const openCart = useCartStore((s) => s.openCart)

  useEffect(() => {
    setLang(readLang())
  }, [])

  useEffect(() => {
    if (categories.length === 0) {
      setActiveSlug(null)
      return
    }
    setActiveSlug((prev) => {
      if (prev && categories.some((c) => c.slug === prev)) return prev
      return categories[0]!.slug
    })
  }, [categories])

  if (categories.length === 0) {
    return (
      <StickyCategoryChrome>
        {({ isStuck }) => (
          <ClientContainer className="flex items-center justify-between gap-4 py-1.5">
            <div
              className={cn(
                "flex min-w-0 flex-1 items-center",
                isStuck ? "gap-3" : "gap-0",
              )}
            >
              <StickyBarLogo isStuck={isStuck} />
            </div>
            <CartPill count={itemCount} onOpen={openCart} />
          </ClientContainer>
        )}
      </StickyCategoryChrome>
    )
  }

  return (
    <StickyCategoryChrome>
      {({ isStuck }) => (
        <ClientContainer className="flex items-center justify-between gap-4 py-1.5">
          <div
            className={cn(
              "flex min-w-0 flex-1 items-center pb-0.5 md:pb-0",
              isStuck ? "gap-3 md:gap-4" : "gap-0",
            )}
          >
            <StickyBarLogo isStuck={isStuck} />
            <nav
              className="flex min-w-0 flex-1 items-center gap-3 overflow-x-auto text-sm md:gap-4"
              aria-label="Категории меню"
            >
              {categories.map((cat) => {
                const isActive = activeSlug === cat.slug
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setActiveSlug(cat.slug)}
                    className={
                      isActive
                        ? "shrink-0 cursor-pointer font-semibold transition-all duration-200"
                        : "text-muted-foreground hover:text-foreground shrink-0 cursor-pointer transition-all duration-200"
                    }
                    style={isActive ? { color: BRAND_ACCENT } : undefined}
                  >
                    {categoryLabel(cat, lang)}
                  </button>
                )
              })}
            </nav>
          </div>
          <CartPill count={itemCount} onOpen={openCart} />
        </ClientContainer>
      )}
    </StickyCategoryChrome>
  )
}

function CartPill({ count, onOpen }: { count: number; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="text-foreground inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-full bg-[#ccff00] px-4 py-2.5 text-sm font-bold transition-all duration-200 hover:bg-[#b8f000] active:scale-[0.97]"
      aria-label={`Корзина, товаров: ${count}`}
    >
      <ShoppingBasket className="size-5 shrink-0" strokeWidth={2} aria-hidden />
      <span>Корзина</span>
      <span className="text-foreground/40 font-normal" aria-hidden>
        |
      </span>
      <span className="tabular-nums">{count}</span>
    </button>
  )
}
