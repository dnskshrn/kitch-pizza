"use client"

import { ClientContainer } from "@/components/client/client-container"
import { STOREFRONT_TOP_BAR_HEIGHT_PX } from "@/components/client/storefront-top-bar"
import { useStoreOpen } from "@/hooks/use-store-open"
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

/** Мобила: `MainHeader` (`py-3` + капсула `h-[63px]`). */
const MAIN_HEADER_MOBILE_FLOW_PX = 63 + 12 * 2
/** md+ остров: `min-h-[64px]` внутри контейнера с `md:py-5`. */
const MAIN_HEADER_MD_ISLAND_FLOW_PX = 64 + 20 * 2

function hasBoutiqueMenu(brandSlug: string): boolean {
  return (
    brandSlug === "the-spot" ||
    brandSlug === "losos" ||
    brandSlug === "kitch-pizza"
  )
}

/**
 * Компенсация верхней витринной хромы для scroll-spy и прокрутки к секции категории
 * (в синхроне с sticky `top` у полосы категорий: спейсер TopBar только до `lg`).
 */
function getScrollOffset(): number {
  if (typeof window === "undefined") return 160
  const w = window.innerWidth
  if (w >= 1024) {
    return MAIN_HEADER_MD_ISLAND_FLOW_PX
  }
  const topBar = STOREFRONT_TOP_BAR_HEIGHT_PX
  if (w < 768) {
    return topBar + MAIN_HEADER_MOBILE_FLOW_PX
  }
  return topBar + MAIN_HEADER_MD_ISLAND_FLOW_PX
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
  const { isOpen: storeOpen } = useStoreOpen()
  const handleOpenCart = useCallback(() => {
    if (!storeOpen) return
    openCart()
  }, [storeOpen, openCart])
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
      const threshold = getScrollOffset() + 24
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
  }, [categories])

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
        getScrollOffset()
      window.scrollTo({ top: Math.max(0, top), behavior: "smooth" })
    },
    [],
  )

  if (categories.length === 0) {
    if (isBoutiqueMenu) {
      return <TheSpotFloatingCart
        lang={lang}
        t={t}
        subtotal={subtotal}
        pulseKey={cartButtonPulseKey}
        onOpen={handleOpenCart}
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
                  onOpen={handleOpenCart}
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
          onOpen={handleOpenCart}
        />
      </>
    )
  }

  if (isBoutiqueMenu) {
    return (
      <>
        <TheSpotCategoryBar
          brandSlug={brandSlug}
          activeSlug={activeSlug}
          categories={categories}
          itemCount={itemCount}
          lang={lang}
          t={t}
          pulseKey={cartButtonPulseKey}
          onOpenCart={handleOpenCart}
          onSelect={handleSelectCategory}
          setButtonRef={setCategoryButtonRef}
        />
        <TheSpotFloatingCart
          lang={lang}
          t={t}
          subtotal={subtotal}
          pulseKey={cartButtonPulseKey}
          onOpen={handleOpenCart}
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
        onOpenCart={handleOpenCart}
        onSelect={handleSelectCategory}
        setButtonRef={setCategoryButtonRef}
      />
      <KitchFloatingCart
        lang={lang}
        t={t}
        subtotal={subtotal}
        pulseKey={cartButtonPulseKey}
        onOpen={handleOpenCart}
      />
    </>
  )
}

function TheSpotCategoryBar({
  brandSlug,
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
  brandSlug: string
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
      <div
        className="sticky z-30 md:hidden"
        style={{
          top: `calc(${STOREFRONT_TOP_BAR_HEIGHT_PX}px + env(safe-area-inset-top, 0px) + ${MAIN_HEADER_MOBILE_FLOW_PX}px)`,
        }}
      >
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
                    ? "bg-[var(--color-accent)] text-[var(--color-accent-text)]"
                    : "bg-white text-[var(--color-text)]",
                )}
              >
                {pickLocalizedName(cat, lang)}
              </button>
            )
          })}
        </div>
      </div>

      {/** `44` = `STOREFRONT_TOP_BAR_HEIGHT_PX`, `104` = `MAIN_HEADER_MD_ISLAND_FLOW_PX` */}
      <StickyCategoryChrome
        className="md:max-lg:top-[calc(env(safe-area-inset-top,0px)+44px+104px)] lg:top-[104px]"
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
                          ? "bg-[var(--color-accent)] text-[var(--color-accent-text)]"
                          : "bg-white text-[var(--color-text)] hover:bg-[var(--color-accent-soft)]",
                      )}
                    >
                      {pickLocalizedName(cat, lang)}
                    </button>
                  )
                })}
              </nav>
              {brandSlug === "kitch-pizza" ? (
                <CartPill
                  count={itemCount}
                  t={t}
                  pulseKey={pulseKey}
                  onOpen={onOpenCart}
                  className="h-11 shrink-0 px-4 py-0 text-[14px] hover:bg-[#b8f000]"
                />
              ) : (
              <button
                key={pulseKey}
                type="button"
                onClick={onOpenCart}
                className={cn(
                  "flex h-11 shrink-0 cursor-pointer items-center gap-2 rounded-full bg-[var(--color-accent)] px-4 text-[14px] font-bold text-[var(--color-accent-text)] transition-all duration-200 hover:brightness-[0.98] active:scale-[0.98]",
                  pulseKey > 0 && "storefront-cart-trigger-pulse",
                )}
                aria-label={`${t.cart.checkout}: ${itemCount}`}
              >
                <ShoppingBasket className="size-5" strokeWidth={2.2} aria-hidden />
                <span>{t.cart.total}</span>
                <span className="tabular-nums">{itemCount}</span>
              </button>
              )}
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
          "flex h-12 w-full cursor-pointer items-center justify-between rounded-full bg-[var(--color-accent)] px-5 text-[15px] font-bold text-[var(--color-accent-text)] transition-all duration-200 active:scale-[0.98]",
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
          "flex h-12 w-full cursor-pointer items-center justify-between rounded-full bg-[var(--color-accent)] px-5 text-[15px] font-bold text-[var(--color-accent-text)] transition-all duration-200 active:scale-[0.98]",
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
  className,
}: {
  count: number
  t: StorefrontMessages
  pulseKey: number
  onOpen: () => void
  className?: string
}) {
  return (
    <button
      key={pulseKey}
      type="button"
      onClick={onOpen}
      className={cn(
        "inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-full bg-[var(--color-accent)] px-4 py-2.5 text-sm font-bold text-[var(--color-accent-text)] transition-all duration-200 hover:brightness-[0.96] active:scale-[0.97]",
        pulseKey > 0 && "storefront-cart-trigger-pulse",
        className,
      )}
      aria-label={`${t.cart.total}: ${count}`}
    >
      <ShoppingBasket className="size-5 shrink-0" strokeWidth={2} aria-hidden />
      <span>{t.cart.total}</span>
      <span className="font-normal text-[var(--color-accent-text)]/40" aria-hidden>
        |
      </span>
      <span className="tabular-nums">{count}</span>
    </button>
  )
}
