"use client"

import {
  getCartItemPrice,
  getCartItemSummary,
  type CartLang,
} from "@/lib/cart-helpers"
import { formatMoney, goodsPhrase, pickLocalizedName } from "@/lib/i18n/storefront"
import { useLanguage } from "@/lib/store/language-store"
import { cn } from "@/lib/utils"
import type { CartItem } from "@/types/cart"
import type { DeliveryZone } from "@/types/database"
import { ChevronRight, Info, Loader2 } from "lucide-react"
import Image from "next/image"
import { useMemo } from "react"

const btnMotion = "cursor-pointer transition-all duration-200 ease-out"
const checkoutCtaMotion = `${btnMotion} hover:brightness-95 active:scale-[0.97]`

export type OrderSummaryProps = {
  lang: CartLang
  items: CartItem[]
  itemCount: number
  subtotal: number
  discount: number
  deliveryFeeBani: number
  mode: "delivery" | "pickup"
  selectedZone: DeliveryZone | null
  grandTotal: number
  /** Если не передан — кнопка «Оформить заказ» не показывается (например, страница успеха). */
  onCheckout?: () => void | Promise<void>
  checkoutSubmitting?: boolean
  checkoutError?: string | null
}

export function OrderSummary({
  lang,
  items,
  itemCount,
  subtotal,
  discount,
  deliveryFeeBani,
  mode,
  selectedZone,
  grandTotal,
  onCheckout,
  checkoutSubmitting = false,
  checkoutError = null,
}: OrderSummaryProps) {
  const { t } = useLanguage()
  const deliveryLabel = useMemo(() => {
    if (mode === "pickup") return t.common.free
    if (!selectedZone) return "--"
    if (selectedZone.delivery_price_bani === 0) return t.common.free
    if (deliveryFeeBani === 0) return t.common.free
    return formatMoney(deliveryFeeBani, lang)
  }, [mode, selectedZone, deliveryFeeBani, lang, t.common.free])

  const showCheckoutCta = typeof onCheckout === "function"

  return (
    <div className="storefront-checkout-card storefront-modal-card-radius rounded-[24px] p-6 md:p-7">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-2">
        <h2 className="text-[20px] font-bold text-[#242424]">
          {t.checkout.orderContent}
        </h2>
        <span className="inline-flex items-center gap-1 text-[12px] font-bold text-[#808080]">
          {t.cart.promos}
          <Info className="size-4 shrink-0" strokeWidth={2} aria-hidden />
        </span>
      </div>

      <ul className="divide-y divide-[#f5f5f5]">
        {items.map((cartItem) => {
          const line = getCartItemSummary(cartItem, lang)
          const name = pickLocalizedName(cartItem.menuItem, lang)
          const unit =
            cartItem.quantity > 1 ? ` × ${cartItem.quantity}` : ""
          const imageUrl = cartItem.menuItem.image_url
          return (
            <li
              key={cartItem.id}
              className="flex items-start gap-3 py-4 first:pt-0 last:pb-0"
            >
              <div className="relative h-14 w-14 shrink-0">
                {imageUrl ? (
                  <Image
                    src={imageUrl}
                    alt=""
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
                {line ? (
                  <p className="mt-0.5 text-[12px] text-[#808080]">{line}</p>
                ) : null}
              </div>
              <p className="shrink-0 self-start pt-0.5 text-right text-[14px] font-medium tabular-nums text-[#242424]">
                {formatMoney(getCartItemPrice(cartItem) * cartItem.quantity, lang)}
              </p>
            </li>
          )
        })}
      </ul>

      <div className="mt-6 space-y-2 border-t border-[#f5f5f5] pt-4">
        <div className="flex items-center justify-between text-[14px] font-medium text-[rgba(36,36,36,0.5)]">
          <span>{goodsPhrase(itemCount, lang)}</span>
          <span className="tabular-nums">{formatMoney(subtotal, lang)}</span>
        </div>
        <div className="flex items-center justify-between text-[14px] font-medium text-[rgba(36,36,36,0.5)]">
          <span className="inline-flex items-center gap-1">
            {t.checkout.deliveryCost}
            <Info className="size-[14px] shrink-0 opacity-60" strokeWidth={2} />
          </span>
          <span className="tabular-nums text-[#242424]">{deliveryLabel}</span>
        </div>
        {discount > 0 ? (
          <div className="flex items-center justify-between text-[14px] font-medium">
            <span className="text-[rgba(36,36,36,0.5)]">{t.cart.discount}</span>
            <span className="storefront-modal-accent tabular-nums">
              −{formatMoney(discount, lang)}
            </span>
          </div>
        ) : null}
      </div>

      <div className="mt-6 flex items-center justify-between border-t border-[#f0f0f0] pt-4">
        <span className="text-[16px] font-bold text-[#242424]">{t.checkout.orderTotal}</span>
        <span className="text-[14px] font-bold tabular-nums text-[#242424]">
          {formatMoney(grandTotal, lang)}
        </span>
      </div>

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
