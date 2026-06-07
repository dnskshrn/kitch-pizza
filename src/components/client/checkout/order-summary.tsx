"use client"

import {
  getCartItemPrice,
  getCartItemSizeLabel,
  type CartLang,
} from "@/lib/cart-helpers"
import { CartLinePrice } from "@/components/client/cart/cart-line-price"
import { StorefrontDiscountExcludedNotice } from "@/components/client/cart/storefront-discount-excluded-notice"
import { CartItemToppingDetails } from "@/components/client/cart/CartItemToppingDetails"
import { useStorefrontCampaignRules } from "@/components/client/storefront-campaign-rules-context"
import { formatMoney, goodsPhrase, pickLocalizedName } from "@/lib/i18n/storefront"
import { getItemCampaignDiscount } from "@/lib/storefront-item-campaign-discount"
import { getStorefrontDeliveryLineDisplay } from "@/lib/storefront-delivery-display"
import { useLanguage } from "@/lib/store/language-store"
import { cn } from "@/lib/utils"
import { menuItemImageAlt } from "@/lib/seo/menu-item-image-alt"
import type { CartItem } from "@/types/cart"
import type { DeliveryZone } from "@/types/database"
import { ChevronRight, Info, Loader2 } from "lucide-react"
import Image from "next/image"
import { useMemo, type ReactNode } from "react"

const btnMotion = "cursor-pointer transition-all duration-200 ease-out"
const checkoutCtaMotion = `${btnMotion} hover:brightness-95 active:scale-[0.97]`

export type CheckoutDiscountRuleLine = {
  type: "item_discount" | "promo_code" | "bonus_redemption"
  label: string
  amount_bani: number
}

export type CheckoutPricingBreakdown = {
  subtotalBani: number
  itemDiscountBani: number
  promoDiscountBani: number
  bonusesRedeemedMdl: number
  deliveryFeeBani: number
  totalBani: number
  loading?: boolean
  discountRulesApplied?: CheckoutDiscountRuleLine[]
  /** cartLineId — индекс строки корзины ("0", "1", …), как в PricingResult. */
  giftUnits?: Array<{ cartLineId: string; quantity: number }>
}

export type OrderSummaryProps = {
  lang: CartLang
  /** Пояснение про категории без авто-скидки (корзина / checkout). */
  excludedDiscountNotice?: {
    mode: "zero" | "partial"
    categories: Array<{ id: string; name_ru: string; name_ro: string }>
  } | null
  items: CartItem[]
  itemCount: number
  subtotal: number
  discount: number
  deliveryFeeBani: number
  mode: "delivery" | "pickup"
  selectedZone: DeliveryZone | null
  /** Адрес привязан к точке вне зон доставки. */
  outOfZone?: boolean
  grandTotal: number
  /** Списание бонусов в пунктах (1 пункт = 1 MDL к снятию с итога). */
  bonusesRedeemed?: number
  /** Детализация из `/checkout/pricing`; если передана — показывается вместо legacy-строк. */
  pricingBreakdown?: CheckoutPricingBreakdown | null
  /** Если не передан — кнопка «Оформить заказ» не показывается (например, страница успеха). */
  onCheckout?: () => void | Promise<void>
  checkoutSubmitting?: boolean
  checkoutError?: string | null
  /** Между сводкой строк и итогом (напр. бонусы). Передаётся как дочерний элемент композицией. */
  children?: ReactNode
}

export function OrderSummary({
  lang,
  excludedDiscountNotice = null,
  items,
  itemCount,
  subtotal,
  discount,
  deliveryFeeBani,
  mode,
  selectedZone,
  outOfZone = false,
  grandTotal,
  bonusesRedeemed = 0,
  pricingBreakdown = null,
  children = null,
  onCheckout,
  checkoutSubmitting = false,
  checkoutError = null,
}: OrderSummaryProps) {
  const { t } = useLanguage()
  const campaignRules = useStorefrontCampaignRules()
  const giftFreeUnitsByLineId = useMemo(() => {
    const units = pricingBreakdown?.giftUnits
    if (!units?.length) return new Map<string, number>()
    const map = new Map<string, number>()
    for (const { cartLineId, quantity } of units) {
      if (quantity <= 0) continue
      const index = Number(cartLineId)
      const cartItem = items[index]
      if (cartItem) map.set(cartItem.id, quantity)
    }
    return map
  }, [pricingBreakdown?.giftUnits, items])
  const deliveryLine = useMemo(
    () =>
      getStorefrontDeliveryLineDisplay({
        lang,
        mode,
        selectedZone,
        deliveryFeeBani,
        freeLabel: t.common.free,
        outOfZone,
      }),
    [lang, mode, selectedZone, deliveryFeeBani, t.common.free, outOfZone],
  )

  const showCheckoutCta = typeof onCheckout === "function"

  return (
    <div className="storefront-checkout-card storefront-modal-card-radius rounded-[24px] p-6 md:p-7">
      <div className="mb-6">
        <h2 className="text-[20px] font-bold text-[#242424]">
          {t.checkout.orderContent}
        </h2>
      </div>

      <ul className="divide-y divide-[#f5f5f5]">
        {items.map((cartItem) => {
          const sizeLabel = getCartItemSizeLabel(cartItem, lang)
          const name = pickLocalizedName(cartItem.menuItem, lang)
          const unit =
            cartItem.quantity > 1 ? ` × ${cartItem.quantity}` : ""
          const imageUrl = cartItem.menuItem.image_url
          const shelfUnitBani = getCartItemPrice(cartItem)
          const { discountedPriceBani, originalPriceBani, hasCampaign } =
            getItemCampaignDiscount(
              cartItem.menuItem,
              campaignRules,
              shelfUnitBani,
            )
          const unitBani = hasCampaign ? discountedPriceBani : shelfUnitBani
          const compareUnitBani = hasCampaign ? originalPriceBani : null
          return (
            <li
              key={cartItem.id}
              className="flex items-start gap-3 py-4 first:pt-0 last:pb-0"
            >
              <div className="relative h-14 w-14 shrink-0">
                {imageUrl ? (
                  <Image
                    src={imageUrl}
                    alt={menuItemImageAlt(cartItem.menuItem.name_ro)}
                    fill
                    className="object-contain object-center"
                    sizes="56px"
                  />
                ) : (
                  <div
                    className="flex h-full w-full items-center justify-center rounded-xl border border-dashed border-[#e8e8e8] text-center text-[9px] font-medium leading-tight text-[#c4c4c4]"
                    aria-hidden
                  >
                    {t.common.noPhoto}
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[16px] font-bold text-[#242424]">
                  {name}
                  {unit}
                </p>
                {sizeLabel ? (
                  <p className="mt-0.5 text-[12px] text-[#808080]">{sizeLabel}</p>
                ) : null}
                <CartItemToppingDetails cartItem={cartItem} lang={lang} />
              </div>
              <div className="shrink-0 self-start pt-0.5 text-right">
                <CartLinePrice
                  unitBani={unitBani}
                  compareUnitBani={compareUnitBani}
                  quantity={cartItem.quantity}
                  giftFreeUnits={giftFreeUnitsByLineId.get(cartItem.id) ?? 0}
                  lang={lang}
                />
              </div>
            </li>
          )
        })}
      </ul>

      {children ? <div className="mt-4 border-t border-[#f5f5f5] pt-4">{children}</div> : null}

      {pricingBreakdown ? (
        <div className="mt-6 space-y-2 border-t border-[#f5f5f5] pt-4 font-mono text-[13px] leading-relaxed text-[#242424]">
          <BreakdownRow
            label={t.checkout.pricingSubtotal}
            value={formatMoney(pricingBreakdown.subtotalBani, lang)}
          />
          {(() => {
            const appliedDiscountLines =
              pricingBreakdown.discountRulesApplied?.filter(
                (entry) =>
                  entry.amount_bani > 0 && entry.type !== "bonus_redemption",
              ) ?? []

            if (appliedDiscountLines.length > 0) {
              return appliedDiscountLines.map((entry, index) => (
                <BreakdownRow
                  key={`discount-${entry.type}-${entry.label}-${index}`}
                  label={entry.label}
                  value={`−${formatMoney(entry.amount_bani, lang)}`}
                  accent
                />
              ))
            }

            const legacyLines: ReactNode[] = []
            if (pricingBreakdown.itemDiscountBani > 0) {
              legacyLines.push(
                <BreakdownRow
                  key="legacy-item-discount"
                  label={t.checkout.pricingItemDiscount}
                  value={`−${formatMoney(pricingBreakdown.itemDiscountBani, lang)}`}
                  accent
                />,
              )
            }
            if (pricingBreakdown.promoDiscountBani > 0) {
              legacyLines.push(
                <BreakdownRow
                  key="legacy-promo-discount"
                  label={t.checkout.pricingPromo}
                  value={`−${formatMoney(pricingBreakdown.promoDiscountBani, lang)}`}
                  accent
                />,
              )
            }
            return legacyLines.length > 0 ? legacyLines : null
          })()}
          {pricingBreakdown.bonusesRedeemedMdl > 0 ? (
            <BreakdownRow
              label={t.checkout.pricingBonuses}
              value={`−${pricingBreakdown.bonusesRedeemedMdl} MDL`}
              accent
            />
          ) : null}
          <BreakdownRow
            label={t.checkout.pricingDelivery}
            value={
              pricingBreakdown.deliveryFeeBani > 0
                ? `+${formatMoney(pricingBreakdown.deliveryFeeBani, lang)}`
                : deliveryLine.amountLine
            }
          />
          {deliveryLine.sublineKind === "addressCost" ? (
            <p className="font-sans text-[12px] font-normal leading-snug text-[rgba(36,36,36,0.45)]">
              {t.cart.deliveryCostAddressHint}
            </p>
          ) : null}
          {deliveryLine.sublineKind === "outOfZone" ? (
            <p
              className="font-sans text-[12px] font-normal leading-snug text-red-600"
              role="alert"
            >
              {t.cart.deliveryOutsideZoneHint}
            </p>
          ) : null}
          {excludedDiscountNotice != null &&
          excludedDiscountNotice.categories.length > 0 ? (
            <div className="font-sans pt-1">
              <StorefrontDiscountExcludedNotice
                categories={excludedDiscountNotice.categories}
                mode={excludedDiscountNotice.mode}
              />
            </div>
          ) : null}
          <div className="border-t border-dashed border-[#e0e0e0] pt-2" />
          <BreakdownRow
            label={t.checkout.pricingTotal}
            value={
              pricingBreakdown.loading
                ? t.checkout.pricingLoading
                : formatMoney(pricingBreakdown.totalBani, lang)
            }
            strong
          />
        </div>
      ) : (
        <div className="mt-6 space-y-2 border-t border-[#f5f5f5] pt-4">
          <div className="flex items-center justify-between text-[14px] font-medium text-[rgba(36,36,36,0.5)]">
            <span>{goodsPhrase(itemCount, lang)}</span>
            <span className="tabular-nums">{formatMoney(subtotal, lang)}</span>
          </div>
          <div className="space-y-1">
            <div className="flex items-start justify-between gap-3 text-[14px] font-medium text-[rgba(36,36,36,0.5)]">
              <span className="inline-flex min-w-0 items-center gap-1">
                {t.checkout.deliveryCost}
                <Info className="size-[14px] shrink-0 opacity-60" strokeWidth={2} />
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
              <p className="text-[12px] font-normal leading-snug text-[rgba(36,36,36,0.45)]">
                {t.cart.deliveryCostAddressHint}
              </p>
            ) : null}
            {deliveryLine.sublineKind === "outOfZone" ? (
              <p className="text-[12px] font-normal leading-snug text-red-600" role="alert">
                {t.cart.deliveryOutsideZoneHint}
              </p>
            ) : null}
          </div>
          {discount > 0 ? (
            <div className="flex items-center justify-between text-[14px] font-medium">
              <span className="text-[rgba(36,36,36,0.5)]">{t.cart.discount}</span>
              <span className="storefront-modal-accent tabular-nums">
                −{formatMoney(discount, lang)}
              </span>
            </div>
          ) : null}
          {excludedDiscountNotice != null &&
          excludedDiscountNotice.categories.length > 0 ? (
            <StorefrontDiscountExcludedNotice
              categories={excludedDiscountNotice.categories}
              mode={excludedDiscountNotice.mode}
            />
          ) : null}
          {bonusesRedeemed > 0 ? (
            <div className="flex items-center justify-between text-[14px] font-medium">
              <span className="text-[rgba(36,36,36,0.5)]">{t.bonus.redeemed}:</span>
              <span className="storefront-modal-accent tabular-nums">
                −{bonusesRedeemed} MDL
              </span>
            </div>
          ) : null}
          <div className="mt-4 flex items-center justify-between border-t border-[#f0f0f0] pt-4">
            <span className="text-[16px] font-bold text-[#242424]">
              {t.checkout.orderTotal}
            </span>
            <span className="text-[14px] font-bold tabular-nums text-[#242424]">
              {formatMoney(grandTotal, lang)}
            </span>
          </div>
        </div>
      )}

      {showCheckoutCta ? (
        <div className="mt-6 hidden md:block">
          <button
            type="button"
            onClick={() => void onCheckout?.()}
            disabled={checkoutSubmitting}
            className={cn(
              "storefront-modal-cta flex h-12 w-full items-center justify-center gap-2 rounded-full text-[16px] font-bold disabled:opacity-60",
              checkoutCtaMotion,
            )}
          >
            {checkoutSubmitting ? (
              <Loader2 className="size-6 animate-spin" aria-hidden />
            ) : (
              <>
                {t.checkout.submit}
                <ChevronRight className="size-5 shrink-0" strokeWidth={2} />
              </>
            )}
          </button>
          {checkoutError ? (
            <p className="mt-2 text-center text-[13px] text-red-600" role="alert">
              {checkoutError}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function BreakdownRow({
  label,
  value,
  accent = false,
  strong = false,
}: {
  label: string
  value: string
  accent?: boolean
  strong?: boolean
}) {
  return (
    <div
      className={cn(
        "flex items-baseline justify-between gap-4",
        strong && "text-[14px] font-bold",
      )}
    >
      <span className={cn(!strong && "text-[#808080]")}>{label}:</span>
      <span
        className={cn(
          "shrink-0 tabular-nums",
          accent && !strong && "text-[#5F7600]",
          strong && "text-[#242424]",
        )}
      >
        {value}
      </span>
    </div>
  )
}
