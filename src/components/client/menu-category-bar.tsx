"use client"

import { ClientContainer } from "@/components/client/client-container"
import { BRAND_ACCENT } from "@/lib/client-brand"
import {
  selectCartItemCount,
  selectCartSubtotal,
  useCartStore,
} from "@/lib/store/cart-store"
import {
  formatMoney,
  pickLocalizedName,
  type Lang,
  type StorefrontMessages,
} from "@/lib/i18n/storefront"
import { useLanguage } from "@/lib/store/language-store"
import type { Category } from "@/types/database"
import { cn } from "@/lib/utils"
import Image from "next/image"
import Link from "next/link"
import { Pizza, ShoppingBasket } from "lucide-react"
import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react"

function menuCategorySectionId(slug: string): string {
  return `menu-category-${slug}`
}

function hasBoutiqueMenu(brandSlug: string): boolean {
  return brandSlug === "the-spot" || brandSlug === "losos"
}

function getScrollOffset(brandSlug: string): number {
  if (typeof window === "undefined") return 120
  const isMobile = window.matchMedia("(max-width: 767px)").matches
  if (hasBoutiqueMenu(brandSlug)) return isMobile ? 142 : 156
  return isMobile ? 84 : 96
}

type MenuCategoryBarProps = {
  brandSlug?: string
  categories: Category[]
}

type StickyChromeRender = (ctx: { isStuck: boolean }) => ReactNode
type StickyCategoryChromeProps = {
  children: StickyChromeRender
  className?: string
  backdropClassName?: string
  hasBackdrop?: boolean
  hasStickyShadow?: boolean
}

/** Макс. ширина слота логотипа (≈ +50% к прежним 48px) */
const STICKY_LOGO_MAX_W = 72
/** Длительность анимации логотипа в прилипшей полосе */
const STICKY_LOGO_DURATION_MS = 400
/** Плавная нелинейная кривая: быстрый старт, мягкое окончание (не linear) */
const STICKY_LOGO_EASING = "cubic-bezier(0.4, 0, 0.2, 1)"

/** Логотип в прилипшей полосе: ширина 0 → max, fade-in + сдвиг слева. */
function StickyBarLogo({
  isStuck,
  t,
}: {
  isStuck: boolean
  t: StorefrontMessages
}) {
  const transition = `${STICKY_LOGO_DURATION_MS}ms ${STICKY_LOGO_EASING}`
  return (
    <div
      className="shrink-0 overflow-hidden"
      style={{
        maxWidth: isStuck ? STICKY_LOGO_MAX_W : 0,
        transition: `max-width ${transition}`,
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
          transition: `opacity ${transition}, transform ${transition}`,
        }}
        aria-label={t.common.brandHome("Kitch Pizza")}
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
function StickyCategoryChrome({
  children,
  className,
  backdropClassName,
  hasBackdrop = true,
  hasStickyShadow = true,
}: StickyCategoryChromeProps) {
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
          "sticky top-0 z-30 transition-shadow duration-300 ease-out",
          className,
          hasStickyShadow && isStuck
            ? "shadow-[0_4px_24px_rgba(0,0,0,0.07)]"
            : "shadow-none",
        )}
      >
        {hasBackdrop ? (
          <>
            {/* Только фон + blur: контент не наследует opacity */}
            <div
              aria-hidden
              className={cn(
                "pointer-events-none absolute inset-0 z-0 bg-white/90 transition-[background-color] duration-300",
                isStuck && "bg-white/80",
                backdropClassName,
              )}
              style={{
                WebkitBackdropFilter: "blur(50px)",
                backdropFilter: "blur(50px)",
              }}
            />
          </>
        ) : null}
        <div className="relative z-10">{children({ isStuck })}</div>
      </div>
    </>
  )
}

export function MenuCategoryBar({
  brandSlug = "kitch-pizza",
  categories,
}: MenuCategoryBarProps) {
  const { lang, t } = useLanguage()
  const [activeSlug, setActiveSlug] = useState<string | null>(null)
  const categoryButtonRefs = useRef(new Map<string, HTMLButtonElement>())
  const itemCount = useCartStore(selectCartItemCount)
  const subtotal = useCartStore(selectCartSubtotal)
  const openCart = useCartStore((s) => s.openCart)
  const cartButtonPulseKey = useCartStore((s) => s.cartButtonPulseKey)
  const isBoutiqueMenu = hasBoutiqueMenu(brandSlug)

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

  useEffect(() => {
    if (categories.length === 0) return

    let frame = 0
    const updateActiveCategory = () => {
      frame = 0
      const threshold = getScrollOffset(brandSlug) + 24
      let nextSlug = categories[0]?.slug ?? null

      for (const category of categories) {
        const section = document.getElementById(
          menuCategorySectionId(category.slug),
        )
        if (!section) continue
        if (section.getBoundingClientRect().top <= threshold) {
          nextSlug = category.slug
        } else {
          break
        }
      }

      setActiveSlug((current) => (current === nextSlug ? current : nextSlug))
    }

    const requestUpdate = () => {
      if (frame) return
      frame = window.requestAnimationFrame(updateActiveCategory)
    }

    updateActiveCategory()
    window.addEventListener("scroll", requestUpdate, { passive: true })
    window.addEventListener("resize", requestUpdate)
    return () => {
      if (frame) window.cancelAnimationFrame(frame)
      window.removeEventListener("scroll", requestUpdate)
      window.removeEventListener("resize", requestUpdate)
    }
  }, [brandSlug, categories])

  useEffect(() => {
    if (!activeSlug) return
    if (!window.matchMedia("(max-width: 767px)").matches) return
    const button = categoryButtonRefs.current.get(activeSlug)
    button?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    })
  }, [activeSlug])

  const setCategoryButtonRef = useCallback(
    (slug: string) => (node: HTMLButtonElement | null) => {
      if (node) {
        categoryButtonRefs.current.set(slug, node)
      } else {
        categoryButtonRefs.current.delete(slug)
      }
    },
    [],
  )

  const handleSelectCategory = useCallback(
    (slug: string) => {
      setActiveSlug(slug)
      const section = document.getElementById(menuCategorySectionId(slug))
      if (!section) return
      const top =
        section.getBoundingClientRect().top +
        window.scrollY -
        getScrollOffset(brandSlug)
      window.scrollTo({ top: Math.max(0, top), behavior: "smooth" })
    },
    [brandSlug],
  )

  if (categories.length === 0) {
    if (isBoutiqueMenu) {
      return <TheSpotFloatingCart
        lang={lang}
        t={t}
        subtotal={subtotal}
        pulseKey={cartButtonPulseKey}
        onOpen={openCart}
      />
    }

    return (
      <>
        <StickyCategoryChrome>
          {({ isStuck }) => (
            <ClientContainer className="flex items-center justify-between gap-4 py-1.5">
              <div
                className={cn(
                  "flex min-w-0 flex-1 items-center",
                  isStuck ? "gap-3" : "gap-0",
                )}
              >
                <StickyBarLogo isStuck={isStuck} t={t} />
              </div>
              <div className="hidden md:block">
                <CartPill
                  count={itemCount}
                  t={t}
                  pulseKey={cartButtonPulseKey}
                  onOpen={openCart}
                />
              </div>
            </ClientContainer>
          )}
        </StickyCategoryChrome>
        <KitchFloatingCart
          lang={lang}
          t={t}
          subtotal={subtotal}
          pulseKey={cartButtonPulseKey}
          onOpen={openCart}
        />
      </>
    )
  }

  if (isBoutiqueMenu) {
    return (
      <>
        <TheSpotCategoryBar
          activeSlug={activeSlug}
          categories={categories}
          itemCount={itemCount}
          lang={lang}
          t={t}
          pulseKey={cartButtonPulseKey}
          onOpenCart={openCart}
          onSelect={handleSelectCategory}
          setButtonRef={setCategoryButtonRef}
        />
        <TheSpotFloatingCart
          lang={lang}
          t={t}
          subtotal={subtotal}
          pulseKey={cartButtonPulseKey}
          onOpen={openCart}
        />
      </>
    )
  }

  return (
    <>
      <DefaultCategoryBar
        activeSlug={activeSlug}
        categories={categories}
        itemCount={itemCount}
        lang={lang}
        t={t}
        pulseKey={cartButtonPulseKey}
        onOpenCart={openCart}
        onSelect={handleSelectCategory}
        setButtonRef={setCategoryButtonRef}
      />
      <KitchFloatingCart
        lang={lang}
        t={t}
        subtotal={subtotal}
        pulseKey={cartButtonPulseKey}
        onOpen={openCart}
      />
    </>
  )
}

function TheSpotCategoryBar({
  activeSlug,
  categories,
  itemCount,
  lang,
  t,
  pulseKey,
  onOpenCart,
  onSelect,
  setButtonRef,
}: {
  activeSlug: string | null
  categories: Category[]
  itemCount: number
  lang: Lang
  t: StorefrontMessages
  pulseKey: number
  onOpenCart: () => void
  onSelect: (slug: string) => void
  setButtonRef: (slug: string) => (node: HTMLButtonElement | null) => void
}) {
  return (
    <>
      <div className="sticky top-[77px] z-30 md:hidden">
        <div className="flex gap-2 overflow-x-auto py-1.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {categories.map((cat) => {
            const isActive = activeSlug === cat.slug
            return (
              <button
                key={cat.id}
                ref={setButtonRef(cat.slug)}
                type="button"
                onClick={() => onSelect(cat.slug)}
                className={cn(
                  "flex shrink-0 cursor-pointer items-center justify-center rounded-full px-4 py-3 text-[14px] font-bold transition-all duration-200 active:scale-[0.97]",
                  isActive
                    ? "bg-[var(--color-accent)] text-white"
                    : "bg-white text-[var(--color-text)]",
                )}
              >
                {pickLocalizedName(cat, lang)}
              </button>
            )
          })}
        </div>
      </div>

      <StickyCategoryChrome
        className="md:top-[90px]"
        hasBackdrop={false}
        hasStickyShadow={false}
      >
        {() => (
          <div className="hidden py-1 md:block">
            <div className="flex items-center justify-between gap-3">
              <nav
                className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto py-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                aria-label={t.common.menu}
              >
                {categories.map((cat) => {
                  const isActive = activeSlug === cat.slug
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => onSelect(cat.slug)}
                      className={cn(
                        "flex h-11 shrink-0 cursor-pointer items-center justify-center rounded-full px-4 text-[14px] font-bold transition-all duration-200 active:scale-[0.98]",
                        isActive
                          ? "bg-[var(--color-accent)] text-white"
                          : "bg-white text-[var(--color-text)] hover:bg-[var(--color-accent-soft)]",
                      )}
                    >
                      {pickLocalizedName(cat, lang)}
                    </button>
                  )
                })}
              </nav>
              <button
                key={pulseKey}
                type="button"
                onClick={onOpenCart}
                className={cn(
                  "flex h-11 shrink-0 cursor-pointer items-center gap-2 rounded-full bg-[var(--color-accent)] px-4 text-[14px] font-bold text-white transition-all duration-200 hover:brightness-[0.98] active:scale-[0.98]",
                  pulseKey > 0 && "storefront-cart-trigger-pulse",
                )}
                aria-label={`${t.cart.checkout}: ${itemCount}`}
              >
                <ShoppingBasket className="size-5" strokeWidth={2.2} aria-hidden />
                <span>{t.cart.total}</span>
                <span className="tabular-nums">{itemCount}</span>
              </button>
            </div>
          </div>
        )}
      </StickyCategoryChrome>
    </>
  )
}

function DefaultCategoryBar({
  activeSlug,
  categories,
  itemCount,
  lang,
  t,
  pulseKey,
  onOpenCart,
  onSelect,
  setButtonRef,
}: {
  activeSlug: string | null
  categories: Category[]
  itemCount: number
  lang: Lang
  t: StorefrontMessages
  pulseKey: number
  onOpenCart: () => void
  onSelect: (slug: string) => void
  setButtonRef: (slug: string) => (node: HTMLButtonElement | null) => void
}) {
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
            <StickyBarLogo isStuck={isStuck} t={t} />
            <nav
              className="flex min-w-0 flex-1 items-center gap-3 overflow-x-auto text-sm md:gap-4"
              aria-label={t.common.menu}
            >
              {categories.map((cat) => {
                const isActive = activeSlug === cat.slug
                return (
                  <button
                    key={cat.id}
                    ref={setButtonRef(cat.slug)}
                    type="button"
                    onClick={() => onSelect(cat.slug)}
                    className={
                      isActive
                        ? "shrink-0 cursor-pointer font-semibold transition-all duration-200"
                        : "text-muted-foreground hover:text-foreground shrink-0 cursor-pointer transition-all duration-200"
                    }
                    style={isActive ? { color: BRAND_ACCENT } : undefined}
                  >
                    {pickLocalizedName(cat, lang)}
                  </button>
                )
              })}
            </nav>
          </div>
          <div className="hidden md:block">
            <CartPill
              count={itemCount}
              t={t}
              pulseKey={pulseKey}
              onOpen={onOpenCart}
            />
          </div>
        </ClientContainer>
      )}
    </StickyCategoryChrome>
  )
}

function KitchFloatingCart({
  lang,
  t,
  subtotal,
  pulseKey,
  onOpen,
}: {
  lang: Lang
  t: StorefrontMessages
  subtotal: number
  pulseKey: number
  onOpen: () => void
}) {
  return (
    <div className="fixed inset-x-4 bottom-4 z-40 rounded-[28px] border border-white/70 bg-white/85 px-2 pb-2 pt-3 shadow-[0_12px_40px_rgba(36,36,36,0.08)] backdrop-blur-[25px] md:hidden">
      <div className="mb-2 flex items-center justify-center gap-2 px-3 text-[10px] text-[#242424]">
        <Pizza className="size-4 shrink-0 text-[#5F7600]" strokeWidth={2.2} />
        <span className="truncate">
          {t.cart.addToOrder}
        </span>
      </div>
      <button
        key={pulseKey}
        type="button"
        onClick={onOpen}
        className={cn(
          "flex h-12 w-full cursor-pointer items-center justify-between rounded-full bg-[#ccff00] px-5 text-[15px] font-bold text-[#242424] transition-all duration-200 active:scale-[0.98]",
          pulseKey > 0 && "storefront-cart-trigger-pulse",
        )}
      >
        <span className="inline-flex items-center gap-2">
          <ShoppingBasket className="size-5" strokeWidth={2.2} />
          {t.cart.total}
        </span>
        <span className="tabular-nums">
          {subtotal > 0 ? formatMoney(subtotal, lang) : formatMoney(0, lang)}
        </span>
      </button>
    </div>
  )
}

function TheSpotFloatingCart({
  lang,
  t,
  subtotal,
  pulseKey,
  onOpen,
}: {
  lang: Lang
  t: StorefrontMessages
  subtotal: number
  pulseKey: number
  onOpen: () => void
}) {
  return (
    <div className="fixed inset-x-4 bottom-4 z-40 rounded-[28px] border border-white/60 bg-white/80 px-2 pb-2 pt-3 shadow-[0_12px_40px_rgba(36,36,36,0.08)] backdrop-blur-[25px] md:hidden">
      <div className="mb-2 flex items-center justify-center gap-2 px-3 text-[10px] text-[var(--color-text)]">
        <Pizza className="size-4 shrink-0" strokeWidth={2.2} />
        <span className="truncate">
          {t.cart.addToOrder}
        </span>
      </div>
      <button
        key={pulseKey}
        type="button"
        onClick={onOpen}
        className={cn(
          "flex h-12 w-full cursor-pointer items-center justify-between rounded-full bg-[var(--color-accent)] px-5 text-[15px] font-bold text-white transition-all duration-200 active:scale-[0.98]",
          pulseKey > 0 && "storefront-cart-trigger-pulse",
        )}
      >
        <span className="inline-flex items-center gap-2">
          <ShoppingBasket className="size-5" strokeWidth={2.2} />
          {t.cart.total}
        </span>
        <span className="tabular-nums">
          {subtotal > 0 ? formatMoney(subtotal, lang) : formatMoney(0, lang)}
        </span>
      </button>
    </div>
  )
}

function CartPill({
  count,
  t,
  pulseKey,
  onOpen,
}: {
  count: number
  t: StorefrontMessages
  pulseKey: number
  onOpen: () => void
}) {
  return (
    <button
      key={pulseKey}
      type="button"
      onClick={onOpen}
      className={cn(
        "text-foreground inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-full bg-[#ccff00] px-4 py-2.5 text-sm font-bold transition-all duration-200 hover:bg-[#b8f000] active:scale-[0.97]",
        pulseKey > 0 && "storefront-cart-trigger-pulse",
      )}
      aria-label={`${t.cart.total}: ${count}`}
    >
      <ShoppingBasket className="size-5 shrink-0" strokeWidth={2} aria-hidden />
      <span>{t.cart.total}</span>
      <span className="text-foreground/40 font-normal" aria-hidden>
        |
      </span>
      <span className="tabular-nums">{count}</span>
    </button>
  )
}
