"use client"

import {
  allocateGiftFreeUnitsByCartLineId,
  evaluateStorefrontCartDiscount,
  getOrderedExcludedDiscountCategoriesInCart,
} from "@/components/client/cart/storefront-cart-pricing"
import {
  formatMoney,
  formatStorefrontExcludedCategoryList,
  goodsPhrase,
  pickLocalizedName,
  promoErrorMessage,
} from "@/lib/i18n/storefront"
import {
  selectCartDiscount,
  useCartStore,
} from "@/lib/store/cart-store"
import { getStorefrontDeliveryLineDisplay } from "@/lib/storefront-delivery-display"
import { useDeliveryStore } from "@/lib/store/delivery-store"
import { useAuthStore } from "@/lib/store/auth-store"
import { useLanguage } from "@/lib/store/language-store"
import { cn } from "@/lib/utils"
import type { CartItem } from "@/types/cart"
import type { Category } from "@/types/database"
import type { DeliveryZoneForEngine, DiscountRule } from "@/types/promotions"
import {
  Check,
  ChevronRight,
  Info,
  Loader2,
  ShoppingBasket,
  X,
} from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { CartItemCard } from "./CartItemCard"
import { StorefrontDiscountExcludedNotice } from "./storefront-discount-excluded-notice"
import { StorefrontPromoExcludedWarning } from "./storefront-promo-excluded-warning"
import {
  LososUpsellCategoryStrip,
  LososUpsellSlidePanel,
} from "./losos-cart-upsell"

type CartContentProps = {
  brandSlug: string
  items: CartItem[]
  subtotal: number
  itemCount: number
  pricingBootstrap: {
    discountAutoRules: DiscountRule[]
    excludedDiscountCategoryIds: string[]
    storefrontExcludedDiscountCategories: Array<{
      id: string
      name_ru: string
      name_ro: string
    }>
  } | null
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
  pricingBootstrap,
  onClose,
  onEditItem,
  onRemoveItem,
  onQuantityChange,
}: CartContentProps) {
  const router = useRouter()
  const { lang, t } = useLanguage()
  const profile = useAuthStore((s) => s.profile)
  const openAuth = useAuthStore((s) => s.openAuth)
  const setOnAuthSuccess = useAuthStore((s) => s.setOnAuthSuccess)
  const [codeInput, setCodeInput] = useState("")
  const [upsellCategory, setUpsellCategory] = useState<Category | null>(null)
  /** `undefined` — запрос /api/auth/me ещё не завершён; `null` — гость */
  const [bonusMeProfile, setBonusMeProfile] = useState<{ profileId: string } | null | undefined>(
    undefined,
  )
  const [bonusSettings, setBonusSettings] = useState<{
    accrualRate: number
    maxRedemptionRate: number
    isEnabled: boolean
  } | null>(null)

  const appliedPromo = useCartStore((s) => s.appliedPromo)
  const promoError = useCartStore((s) => s.promoError)
  const promoLoading = useCartStore((s) => s.promoLoading)
  const applyPromo = useCartStore((s) => s.applyPromo)
  const removePromo = useCartStore((s) => s.removePromo)
  const fallbackPromoDiscount = useCartStore(selectCartDiscount)
  const isOpen = useCartStore((s) => s.isOpen)
  const deliveryMode = useDeliveryStore((s) => s.mode)
  const selectedZone = useDeliveryStore((s) => s.selectedZone)
  const outOfZone = useDeliveryStore((s) => s.outOfZone)
  const deliveryFeeBani = useDeliveryStore((s) =>
    s.getDeliveryFeeBani(subtotal),
  )

  const deliveryZoneForEngine = useMemo((): DeliveryZoneForEngine | null => {
    if (deliveryMode === "pickup") {
      return { price_bani: 0, free_from_bani: 0 }
    }
    const z = selectedZone
    if (!z) return null
    const params = z.resolvedParams
    return {
      price_bani: params.delivery_price_bani,
      free_from_bani: params.free_delivery_from_bani ?? Number.MAX_SAFE_INTEGER,
    }
  }, [deliveryMode, selectedZone])

  const storefrontEngineOutput = useMemo(() => {
    if (!pricingBootstrap) return null
    return evaluateStorefrontCartDiscount({
      cartItems: items,
      discountAutoRules: pricingBootstrap.discountAutoRules,
      excludedCategoryIds: pricingBootstrap.excludedDiscountCategoryIds,
      appliedPromo,
      deliveryZone: deliveryZoneForEngine,
    })
  }, [
    pricingBootstrap,
    items,
    appliedPromo,
    deliveryZoneForEngine,
  ])

  const excludedCategoriesOrderedForNotice = useMemo(() => {
    if (!pricingBootstrap) return []
    return getOrderedExcludedDiscountCategoriesInCart(
      items,
      pricingBootstrap.excludedDiscountCategoryIds,
      pricingBootstrap.storefrontExcludedDiscountCategories,
    )
  }, [items, pricingBootstrap])

  const hasActiveAutoRules =
    (pricingBootstrap?.discountAutoRules.length ?? 0) > 0

  const engineTotalDiscountBani =
    storefrontEngineOutput?.totalDiscountBani ?? 0

  const excludedDiscountNotice = useMemo(() => {
    if (excludedCategoriesOrderedForNotice.length === 0) return null
    if (engineTotalDiscountBani > 0) {
      return {
        mode: "partial" as const,
        categories: excludedCategoriesOrderedForNotice,
      }
    }
    if (hasActiveAutoRules && engineTotalDiscountBani === 0) {
      return {
        mode: "zero" as const,
        categories: excludedCategoriesOrderedForNotice,
      }
    }
    return null
  }, [
    excludedCategoriesOrderedForNotice,
    hasActiveAutoRules,
    engineTotalDiscountBani,
  ])

  const promoExcludedCategoryWarningText = useMemo(() => {
    if (appliedPromo == null || engineTotalDiscountBani !== 0) return null
    if (excludedCategoriesOrderedForNotice.length === 0) return null
    const names = excludedCategoriesOrderedForNotice.map((c) =>
      lang === "RU" ? c.name_ru : c.name_ro,
    )
    const list = formatStorefrontExcludedCategoryList(names, lang)
    return t.cart.promoAcceptedButExcluded(list)
  }, [
    appliedPromo,
    engineTotalDiscountBani,
    excludedCategoriesOrderedForNotice,
    lang,
    t.cart,
  ])

  const discount = useMemo(() => {
    if (!storefrontEngineOutput) {
      return fallbackPromoDiscount
    }
    return Math.min(
      subtotal,
      Math.max(0, Math.round(storefrontEngineOutput.totalDiscountBani)),
    )
  }, [storefrontEngineOutput, subtotal, fallbackPromoDiscount])

  const giftFreeUnitsByLineId = useMemo(() => {
    const gifts = storefrontEngineOutput?.giftItems
    if (!gifts?.length) return new Map<string, number>()
    return allocateGiftFreeUnitsByCartLineId(items, gifts)
  }, [items, storefrontEngineOutput?.giftItems])

  const itemPercentRules = useMemo(
    () =>
      (pricingBootstrap?.discountAutoRules ?? []).filter(
        (rule) => rule.effect_type === "item_percent",
      ),
    [pricingBootstrap?.discountAutoRules],
  )

  useEffect(() => {
    if (!isOpen) setUpsellCategory(null)
  }, [isOpen])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const meRes = await fetch("/api/auth/me", { credentials: "include" })
        const meJson: unknown = await meRes.json()
        if (cancelled) return
        const p =
          meJson &&
          typeof meJson === "object" &&
          "profile" in meJson &&
          meJson.profile &&
          typeof meJson.profile === "object" &&
          "profileId" in meJson.profile &&
          typeof (meJson.profile as { profileId: unknown }).profileId === "string"
            ? (meJson.profile as { profileId: string })
            : null
        if (p == null) {
          setBonusMeProfile(null)
          return
        }
        setBonusMeProfile({ profileId: p.profileId })
      } catch {
        if (!cancelled) setBonusMeProfile(null)
        return
      }

      try {
        const settingsRes = await fetch("/api/bonus/settings", {
          credentials: "include",
        })
        const settingsJson: unknown = await settingsRes.json()
        if (cancelled) return
        if (
          settingsRes.ok &&
          settingsJson &&
          typeof settingsJson === "object" &&
          "accrualRate" in settingsJson &&
          "maxRedemptionRate" in settingsJson &&
          "isEnabled" in settingsJson
        ) {
          const o = settingsJson as {
            accrualRate: unknown
            maxRedemptionRate: unknown
            isEnabled: unknown
          }
          setBonusSettings({
            accrualRate: Number(o.accrualRate),
            maxRedemptionRate: Number(o.maxRedemptionRate),
            isEnabled: Boolean(o.isEnabled),
          })
        } else {
          setBonusSettings(null)
        }
      } catch {
        if (!cancelled) setBonusSettings(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const subtotalLei = formatMoney(subtotal, lang)
  const discountLei = formatMoney(discount, lang)
  const goodsBani = Math.max(0, subtotal - discount)
  const grandTotalBani = goodsBani + deliveryFeeBani
  const totalLei = formatMoney(grandTotalBani, lang)
  const bonusAccrualEarned =
    bonusMeProfile != null && bonusSettings != null && bonusSettings.isEnabled
      ? Math.floor((grandTotalBani / 100) * bonusSettings.accrualRate)
      : 0
  const showBonusAccrualRow =
    bonusMeProfile != null &&
    bonusSettings != null &&
    bonusSettings.isEnabled &&
    bonusAccrualEarned > 0
  const isCartEmpty = items.length === 0
  const deliveryLine = useMemo(
    () =>
      getStorefrontDeliveryLineDisplay({
        lang,
        mode: deliveryMode,
        selectedZone,
        deliveryFeeBani,
        freeLabel: t.common.free,
        outOfZone,
      }),
    [
      lang,
      deliveryMode,
      selectedZone,
      deliveryFeeBani,
      t.common.free,
      outOfZone,
    ],
  )

  const checkoutPath =
    brandSlug === "kitch-pizza"
      ? "/checkout"
      : brandSlug === "the-spot"
        ? "/thespot/checkout"
        : `/${brandSlug}/checkout`

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
                giftFreeUnits={giftFreeUnitsByLineId.get(cartItem.id) ?? 0}
                itemPercentRules={itemPercentRules}
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
              <div className="flex flex-col gap-2">
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
                {promoExcludedCategoryWarningText ? (
                  <StorefrontPromoExcludedWarning
                    message={promoExcludedCategoryWarningText}
                  />
                ) : null}
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
                    className="storefront-input min-w-0 flex-1 rounded-[12px] px-4 py-3 font-mono uppercase text-[#242424] placeholder:text-[rgba(36,36,36,0.35)] disabled:opacity-60"
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
                  <span className="inline-flex items-center text-[rgba(36,36,36,0.55)]">
                    {t.cart.discount}
                    {brandSlug === "kitch-pizza" ? (
                      <Popover>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            className="border-0 bg-transparent p-0"
                            aria-label="Акция 3+1"
                          >
                            <Info
                              size={14}
                              className="ml-1 inline-block cursor-pointer align-middle text-muted-foreground"
                              strokeWidth={2}
                            />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent align="start">
                          <p className="max-w-[220px] text-sm">
                            🍕 Акция 3+1: при заказе 4 пицц самая дешёвая — бесплатно.
                            Максимум 2 бесплатные пиццы за заказ.
                          </p>
                        </PopoverContent>
                      </Popover>
                    ) : null}
                  </span>
                  <span className="storefront-modal-accent font-medium tabular-nums">
                    −{discountLei}
                  </span>
                </div>
              ) : null}
              {excludedDiscountNotice ? (
                <StorefrontDiscountExcludedNotice
                  categories={excludedDiscountNotice.categories}
                  mode={excludedDiscountNotice.mode}
                />
              ) : null}
              {showBonusAccrualRow ? (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[rgba(36,36,36,0.55)]">
                    🎁 {t.bonus.earn}
                  </span>
                  <span className="font-medium tabular-nums text-[#242424]">
                    +{bonusAccrualEarned} {t.bonus.points}
                  </span>
                </div>
              ) : null}
              <div className="space-y-1">
                <div className="flex items-start justify-between gap-3 text-sm">
                  <span className="inline-flex min-w-0 items-center gap-1 text-[rgba(36,36,36,0.55)]">
                    {t.cart.delivery}
                    <Info className="size-[14px] shrink-0" strokeWidth={2} aria-hidden />
                  </span>
                  <span
                    className={cn(
                      "shrink-0 text-right tabular-nums",
                      deliveryLine.amountLine.includes("--")
                        ? "text-[rgba(36,36,36,0.45)]"
                        : "font-medium text-[#242424]",
                    )}
                  >
                    {deliveryLine.amountLine}
                  </span>
                </div>
                {deliveryLine.sublineKind === "addressCost" ? (
                  <p className="text-[11px] leading-snug text-[rgba(36,36,36,0.45)]">
                    {t.cart.deliveryCostAddressHint}
                  </p>
                ) : null}
                {deliveryLine.sublineKind === "outOfZone" ? (
                  <p
                    className="text-[11px] leading-snug text-red-600"
                    role="alert"
                  >
                    {t.cart.deliveryOutsideZoneHint}
                  </p>
                ) : null}
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
              ) : profile == null ? (
                <button
                  type="button"
                  onClick={() => {
                    setOnAuthSuccess(() => {
                      router.push(checkoutPath)
                    })
                    openAuth()
                    onClose()
                  }}
                  className="storefront-modal-cta flex flex-1 cursor-pointer items-center justify-center gap-1 rounded-full border-0 py-4 text-[16px] font-bold transition-all hover:brightness-95 active:scale-[0.98]"
                >
                  {t.cart.checkout}
                  <ChevronRight className="size-5 shrink-0" strokeWidth={2.5} />
                </button>
              ) : (
                <Link
                  href={checkoutPath}
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
