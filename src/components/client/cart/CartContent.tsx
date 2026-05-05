"use client"

import {
  formatMoney,
  formatWeightGrams,
  goodsPhrase,
  pickLocalizedName,
  promoErrorMessage,
  type Lang,
} from "@/lib/i18n/storefront"
import {
  selectCartDiscount,
  useCartStore,
} from "@/lib/store/cart-store"
import { useDeliveryStore } from "@/lib/store/delivery-store"
import { useLanguage } from "@/lib/store/language-store"
import { createClient } from "@/lib/supabase/client"
import type { CartItem } from "@/types/cart"
import type { Category } from "@/types/database"
import { getBrandBySlug } from "@/brands"
import {
  Check,
  ChevronRight,
  Info,
  Loader2,
  Minus,
  Plus,
  ShoppingBasket,
  X,
} from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { CartItemCard } from "./CartItemCard"
import {
  LososUpsellCategoryStrip,
  LososUpsellSlidePanel,
} from "./losos-cart-upsell"

/** Slug витрины: тот же источник, что `x-brand-slug` / `getBrand()` на сервере. */
function getStorefrontBrandSlug(): string {
  if (typeof document === "undefined") return "kitch-pizza"
  const raw = document
    .querySelector("[data-brand]")
    ?.getAttribute("data-brand")
    ?.trim()
  return raw && raw.length > 0 ? raw : "kitch-pizza"
}

type CondimentMenuRow = {
  id: string
  name_ru: string
  name_ro: string
  image_url: string | null
  weight_grams: number | null
  price: number | null
  is_default_condiment: boolean
  condiment_default_qty?: number | null
}

function CondimentDrawerRow({
  item,
  lang,
  qty,
  unitBani,
  tDecrease,
  tIncrease,
  onIncrementFromZero,
  onDelta,
}: {
  item: CondimentMenuRow
  lang: Lang
  qty: number
  unitBani: number
  tDecrease: string
  tIncrease: string
  onIncrementFromZero: () => void
  onDelta: (delta: 1 | -1) => void
}) {
  const name = pickLocalizedName(item, lang)
  const hasPrice = unitBani > 0
  const weightLabel =
    item.weight_grams != null && Number.isFinite(item.weight_grams)
      ? formatWeightGrams(item.weight_grams, lang)
      : null

  const addFreeLabel = lang === "RO" ? "Adaugă" : "Добавить"

  return (
    <div className="flex items-center gap-3">
      <div className="relative size-14 shrink-0 overflow-hidden rounded-lg bg-muted/30">
        {item.image_url ? (
          <Image
            src={item.image_url}
            alt=""
            fill
            className="object-cover"
            sizes="56px"
          />
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-medium leading-snug text-[var(--color-text)]">
          {name}
        </p>
        {qty > 0 && hasPrice ? (
          <p className="mt-0.5 text-sm leading-snug">
            <span className="tabular-nums text-[var(--color-text)]">
              {formatMoney(unitBani * qty, lang)}
            </span>
            {weightLabel ? (
              <span className="text-[var(--color-muted)]"> {weightLabel}</span>
            ) : null}
          </p>
        ) : null}
        {qty === 0 && hasPrice && weightLabel ? (
          <p className="mt-0.5 text-sm text-[var(--color-muted)]">{weightLabel}</p>
        ) : null}
        {!hasPrice && weightLabel ? (
          <p className="mt-0.5 text-sm text-[var(--color-muted)]">{weightLabel}</p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center">
        {qty === 0 ? (
          <button
            type="button"
            onClick={onIncrementFromZero}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-transparent px-[14px] py-2 text-sm font-medium text-[var(--color-text)] transition-colors hover:bg-muted/40"
          >
            {hasPrice ? (
              <>
                <span className="tabular-nums">{formatMoney(unitBani, lang)}</span>
                <Plus className="size-4" strokeWidth={2.5} aria-hidden />
              </>
            ) : (
              <>
                <span>{addFreeLabel}</span>
                <Plus className="size-4" strokeWidth={2.5} aria-hidden />
              </>
            )}
          </button>
        ) : (
          <div className="storefront-modal-field inline-flex shrink-0 items-center gap-0 rounded-full p-0.5">
            <button
              type="button"
              onClick={() => onDelta(-1)}
              className="flex size-8 items-center justify-center rounded-full text-[var(--color-text)] transition-colors hover:bg-black/5"
              aria-label={tDecrease}
            >
              <Minus className="size-4" strokeWidth={2.5} />
            </button>
            <span className="min-w-[2ch] px-1 text-center text-sm font-semibold tabular-nums">
              {qty}
            </span>
            <button
              type="button"
              onClick={() => onDelta(1)}
              className="flex size-8 items-center justify-center rounded-full text-[var(--color-text)] transition-colors hover:bg-black/5"
              aria-label={tIncrease}
            >
              <Plus className="size-4" strokeWidth={2.5} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

type CartContentProps = {
  brandSlug: string
  items: CartItem[]
  subtotal: number
  itemCount: number
  onClose: () => void
  onEditItem: (item: CartItem) => void
  onRemoveItem: (cartItemId: string) => void
  onQuantityChange: (cartItemId: string, delta: 1 | -1) => void
}

export function CartContent({
  brandSlug,
  items,
  subtotal,
  itemCount,
  onClose,
  onEditItem,
  onRemoveItem,
  onQuantityChange,
}: CartContentProps) {
  const { lang, t } = useLanguage()
  const [codeInput, setCodeInput] = useState("")
  const [upsellCategory, setUpsellCategory] = useState<Category | null>(null)

  const appliedPromo = useCartStore((s) => s.appliedPromo)
  const promoError = useCartStore((s) => s.promoError)
  const promoLoading = useCartStore((s) => s.promoLoading)
  const applyPromo = useCartStore((s) => s.applyPromo)
  const removePromo = useCartStore((s) => s.removePromo)
  const discount = useCartStore(selectCartDiscount)
  const isOpen = useCartStore((s) => s.isOpen)
  const mergeCondimentsMeta = useCartStore((s) => s.mergeCondimentsMeta)
  const applyCondimentDefaults = useCartStore((s) => s.applyCondimentDefaults)
  const condimentQuantities = useCartStore((s) => s.condimentQuantities)
  const setCondimentQty = useCartStore((s) => s.setCondimentQty)
  const deliveryFeeBani = useDeliveryStore((s) =>
    s.getDeliveryFeeBani(subtotal),
  )

  useEffect(() => {
    if (!isOpen) setUpsellCategory(null)
  }, [isOpen])

  const [condimentItems, setCondimentItems] = useState<CondimentMenuRow[]>([])

  useEffect(() => {
    if (!isOpen) return
    let cancelled = false
    ;(async () => {
      try {
        const supabase = createClient()
        const brandSlug = getStorefrontBrandSlug()
        const brandConfig = getBrandBySlug(brandSlug)
        const { data: brandRow, error: bErr } = await supabase
          .from("brands")
          .select("id")
          .eq("slug", brandConfig.slug)
          .maybeSingle()
        if (bErr || !brandRow) {
          if (!cancelled) setCondimentItems([])
          return
        }
        const brandId = (brandRow as { id: string }).id

        const { data: catsRaw, error: cErr } = await supabase
          .from("menu_categories")
          .select("id")
          .eq("brand_id", brandId)
          .eq("is_active", true)
          .eq("is_condiment", true)
        if (cErr || !catsRaw?.length) {
          if (!cancelled) setCondimentItems([])
          return
        }
        const catIds = (catsRaw as { id: string }[]).map((c) => c.id)
        const { data: itemsRaw, error: iErr } = await supabase
          .from("menu_items")
          .select(
            "id,name_ru,name_ro,image_url,weight_grams,price,is_default_condiment,condiment_default_qty,sort_order",
          )
          .eq("brand_id", brandId)
          .in("category_id", catIds)
          .eq("is_active", true)
          .order("sort_order", { ascending: true })
        if (cancelled) return
        if (iErr || !itemsRaw?.length) {
          setCondimentItems([])
          return
        }
        const rows = itemsRaw as CondimentMenuRow[]
        setCondimentItems(rows)
        mergeCondimentsMeta(
          rows.map((r) => ({
            id: r.id,
            name_ru: r.name_ru,
            name_ro: r.name_ro,
            price: r.price ?? 0,
          })),
        )
        applyCondimentDefaults(rows)
      } catch {
        if (!cancelled) setCondimentItems([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [isOpen, mergeCondimentsMeta, applyCondimentDefaults])

  const showEcoCondimentsBanner = useMemo(
    () =>
      condimentItems.some(
        (row) =>
          (row.price ?? 0) === 0 &&
          (condimentQuantities[row.id] ?? 0) > 0,
      ),
    [condimentItems, condimentQuantities],
  )

  function handleCondimentDelta(id: string, delta: 1 | -1) {
    const cur = condimentQuantities[id] ?? 0
    const next = Math.max(0, cur + delta)
    setCondimentQty(id, next)
  }

  function handleDeclineFreeCondiments() {
    for (const row of condimentItems) {
      if ((row.price ?? 0) === 0 && (condimentQuantities[row.id] ?? 0) > 0) {
        setCondimentQty(row.id, 0)
      }
    }
  }

  const subtotalLei = formatMoney(subtotal, lang)
  const discountLei = formatMoney(discount, lang)
  const goodsBani = Math.max(0, subtotal - discount)
  const grandTotalBani = goodsBani + deliveryFeeBani
  const totalLei = formatMoney(grandTotalBani, lang)
  const isCartEmpty = items.length === 0

  async function handleApplyPromo() {
    await applyPromo(codeInput)
  }

  function handlePromoKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault()
      void handleApplyPromo()
    }
  }

  return (
    <div className="storefront-modal-bg flex h-full min-h-0 flex-col overflow-hidden">
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        <header className="shrink-0 px-4 pb-6 pt-4 md:pb-7 md:pt-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <ShoppingBasket
                className="size-6 shrink-0 text-[#242424]"
                strokeWidth={2}
                aria-hidden
              />
              <h2 className="text-[20px] font-bold leading-tight text-[#242424]">
                {goodsPhrase(itemCount, lang)}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="storefront-modal-surface flex size-10 shrink-0 items-center justify-center rounded-full text-[#242424] transition-colors hover:bg-black/5"
              aria-label={t.cart.closeCart}
            >
              <X className="size-5" strokeWidth={2.5} />
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[112px] [-webkit-overflow-scrolling:touch]">
        <div className="space-y-3">
          {items.length === 0 ? (
            <div className="flex min-h-[120px] items-center justify-center rounded-[16px] py-8 text-center text-[rgba(36,36,36,0.5)]">
              {t.cart.empty}
            </div>
          ) : (
            items.map((cartItem) => (
              <CartItemCard
                key={cartItem.id}
                cartItem={cartItem}
                lang={lang}
                name={
                  pickLocalizedName(cartItem.menuItem, lang)
                }
                onEdit={() => onEditItem(cartItem)}
                onRemove={() => onRemoveItem(cartItem.id)}
                onQuantityChange={(delta) => onQuantityChange(cartItem.id, delta)}
              />
            ))
          )}
        </div>

        {condimentItems.length > 0 ? (
          <section className="-mx-4 mt-4 shrink-0 px-4 pb-1 pt-1 text-[var(--color-text)]">
            <p className="mb-3 text-[15px] font-medium text-[var(--color-text)]">
              {lang === "RO" ? "Adaugă încă" : "Добавить ещё"}
            </p>
            <div className="space-y-3">
              {condimentItems.map((row) => {
                const qty = condimentQuantities[row.id] ?? 0
                const unitBani = row.price ?? 0
                return (
                  <div
                    key={row.id}
                    className="storefront-modal-surface storefront-modal-card-radius rounded-[16px] p-3"
                  >
                    <CondimentDrawerRow
                      item={row}
                      lang={lang}
                      qty={qty}
                      unitBani={unitBani}
                      tDecrease={t.cart.decrease}
                      tIncrease={t.cart.increase}
                      onIncrementFromZero={() => setCondimentQty(row.id, 1)}
                      onDelta={(d) => handleCondimentDelta(row.id, d)}
                    />
                  </div>
                )
              })}
            </div>
            {showEcoCondimentsBanner ? (
              <div
                className="storefront-modal-card-radius mt-4 flex flex-col gap-3 rounded-[16px] bg-[var(--color-accent-soft)] p-4 text-[var(--color-accent-text)]"
                aria-live="polite"
              >
                <p className="text-sm font-normal leading-snug">{t.cart.ecoChopsticksHint}</p>
                <button
                  type="button"
                  onClick={handleDeclineFreeCondiments}
                  className="w-full rounded-full border border-current/35 bg-transparent px-[14px] py-2 text-sm font-medium text-[var(--color-accent-text)] transition-opacity hover:opacity-90"
                >
                  {t.cart.ecoDeclineChopsticks}
                </button>
              </div>
            ) : null}
          </section>
        ) : null}

        {brandSlug === "losos" ? (
          <LososUpsellCategoryStrip
            cartIsOpen={isOpen}
            lang={lang}
            addToOrderHeading={t.cart.addToOrder}
            onPickCategory={setUpsellCategory}
          />
        ) : null}

        <section className="shrink-0 pb-4 pt-1" aria-label={t.cart.promoAndDetails}>
          <div className="storefront-modal-surface storefront-modal-card-radius rounded-[20px] p-4">
            {appliedPromo ? (
              <div className="storefront-modal-field flex items-center gap-2 rounded-[12px] px-3 py-3">
                <Check
                  className="storefront-modal-accent size-5 shrink-0"
                  strokeWidth={2.5}
                  aria-hidden
                />
                <p className="min-w-0 flex-1 text-sm font-medium text-[#242424]">
                  {t.cart.promoApplied(appliedPromo.code)}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    removePromo()
                    setCodeInput("")
                  }}
                  className="flex size-9 shrink-0 items-center justify-center rounded-full text-[#242424] transition-colors hover:bg-black/10"
                  aria-label={t.cart.removePromo}
                >
                  <X className="size-4" strokeWidth={2.5} />
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    name="promo"
                    placeholder={t.cart.promoPlaceholder}
                    value={codeInput}
                    disabled={promoLoading}
                    onChange={(e) => setCodeInput(e.target.value)}
                    onKeyDown={handlePromoKeyDown}
                    className="storefront-modal-field min-w-0 flex-1 rounded-[12px] px-4 py-3 font-mono uppercase text-[#242424] placeholder:text-[rgba(36,36,36,0.35)] disabled:opacity-60"
                    aria-label={t.cart.promoAria}
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    onClick={() => void handleApplyPromo()}
                    disabled={promoLoading || !codeInput.trim()}
                    className="shrink-0 rounded-[12px] bg-[#242424] px-4 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {promoLoading ? (
                      <Loader2 className="size-5 animate-spin" aria-hidden />
                    ) : (
                      t.cart.applyPromo
                    )}
                  </button>
                </div>
                {promoError ? (
                  <p className="text-sm text-red-600" role="alert">
                    {promoErrorMessage(promoError, lang)}
                  </p>
                ) : null}
              </div>
            )}

            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-[rgba(36,36,36,0.55)]">{goodsPhrase(itemCount, lang)}</span>
                <span className="font-medium tabular-nums text-[#242424]">{subtotalLei}</span>
              </div>
              {discount > 0 ? (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[rgba(36,36,36,0.55)]">{t.cart.discount}</span>
                  <span className="storefront-modal-accent font-medium tabular-nums">
                    −{discountLei}
                  </span>
                </div>
              ) : null}
              <div className="flex items-center justify-between text-sm">
                <span className="inline-flex items-center gap-1 text-[rgba(36,36,36,0.55)]">
                  {t.cart.delivery}
                  <Info className="size-[14px] shrink-0" strokeWidth={2} aria-hidden />
                  {/* TODO: расчёт доставки */}
                </span>
                <span className="tabular-nums text-[rgba(36,36,36,0.45)]">
                  -- {lang === "RO" ? "lei" : "лей"}
                </span>
              </div>
            </div>
          </div>
        </section>
        </div>

        {/* Статичный нижний островок: только сумма + кнопка, чтобы товары получали больше места для скролла. */}
        <section
          className="pointer-events-none absolute inset-x-0 bottom-0 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
          aria-label={t.cart.total}
        >
          <div className="storefront-modal-surface pointer-events-auto rounded-full p-2">
            <div className="flex items-center gap-3">
              <p className="pl-3 text-[20px] font-bold tabular-nums text-[#242424]">
                {totalLei}
              </p>
              {isCartEmpty ? (
                <button
                  type="button"
                  disabled
                  className="storefront-modal-cta flex flex-1 cursor-not-allowed items-center justify-center gap-1 rounded-full py-4 text-[16px] font-bold opacity-45"
                >
                  {t.cart.checkout}
                  <ChevronRight className="size-5 shrink-0" strokeWidth={2.5} />
                </button>
              ) : (
                <Link
                  href="/checkout"
                  onClick={onClose}
                  className="storefront-modal-cta flex flex-1 cursor-pointer items-center justify-center gap-1 rounded-full py-4 text-[16px] font-bold transition-all hover:brightness-95 active:scale-[0.98]"
                >
                  {t.cart.checkout}
                  <ChevronRight className="size-5 shrink-0" strokeWidth={2.5} />
                </Link>
              )}
            </div>
          </div>
        </section>

        {brandSlug === "losos" && upsellCategory ? (
          <button
            type="button"
            aria-label={
              lang === "RO"
                ? "Închide lista de recomandări"
                : "Закрыть список рекомендаций"
            }
            className="absolute inset-0 z-[8] bg-black/40 transition-opacity"
            onClick={() => setUpsellCategory(null)}
          />
        ) : null}

        {brandSlug === "losos" ? (
          <LososUpsellSlidePanel
            upsellCategory={upsellCategory}
            onClose={() => setUpsellCategory(null)}
            lang={lang}
          />
        ) : null}
      </div>
    </div>
  )
}
