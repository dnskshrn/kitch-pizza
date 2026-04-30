"use client"

import {
  formatMoney,
  goodsPhrase,
  pickLocalizedName,
  promoErrorMessage,
} from "@/lib/i18n/storefront"
import {
  selectCartDiscount,
  useCartStore,
} from "@/lib/store/cart-store"
import { useDeliveryStore } from "@/lib/store/delivery-store"
import { useLanguage } from "@/lib/store/language-store"
import type { CartItem } from "@/types/cart"
import {
  Check,
  ChevronRight,
  Info,
  Loader2,
  ShoppingBasket,
  X,
} from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { CartItemCard } from "./CartItemCard"

type CartContentProps = {
  items: CartItem[]
  subtotal: number
  itemCount: number
  onClose: () => void
  onEditItem: (item: CartItem) => void
  onRemoveItem: (cartItemId: string) => void
  onQuantityChange: (cartItemId: string, delta: 1 | -1) => void
}

export function CartContent({
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

  const appliedPromo = useCartStore((s) => s.appliedPromo)
  const promoError = useCartStore((s) => s.promoError)
  const promoLoading = useCartStore((s) => s.promoLoading)
  const applyPromo = useCartStore((s) => s.applyPromo)
  const removePromo = useCartStore((s) => s.removePromo)
  const discount = useCartStore(selectCartDiscount)
  const deliveryFeeBani = useDeliveryStore((s) =>
    s.getDeliveryFeeBani(subtotal),
  )

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
    <div className="storefront-modal-bg relative flex h-full min-h-0 flex-col overflow-hidden">
      <header className="relative shrink-0 px-4 pb-6 pt-4 md:pb-7 md:pt-5">
        <div className="flex items-start gap-2 pr-10 md:pr-12">
          <ShoppingBasket className="mt-0.5 size-6 shrink-0 text-[#242424]" strokeWidth={2} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <h2 className="text-[20px] font-bold leading-tight text-[#242424]">
                {goodsPhrase(itemCount, lang)}
              </h2>
              <span className="inline-flex items-center gap-1 text-sm text-[rgba(36,36,36,0.45)]">
                {t.cart.promos}
                <Info className="size-4 shrink-0" strokeWidth={2} aria-hidden />
                {/* TODO: акции 2+1 / 3+1 — логика */}
              </span>
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="storefront-modal-surface absolute right-4 top-4 flex size-10 items-center justify-center rounded-full text-[#242424] transition-colors hover:bg-black/5"
          aria-label={t.cart.closeCart}
        >
          <X className="size-5" strokeWidth={2.5} />
        </button>
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

        <section className="mt-4 shrink-0 pb-4 pt-1">
          <p className="mb-2 text-xs text-[rgba(36,36,36,0.45)]">{t.cart.addToOrder}</p>
          <div className="-mx-1 flex gap-2 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch]">
            {/* TODO: апселл — реальные категории «Соусы» / «Напитки» */}
            <div className="storefront-modal-surface storefront-modal-card-radius w-[120px] shrink-0 rounded-[16px] p-3">
              <div
                className="mb-2 aspect-square w-full rounded-lg border border-dashed border-[#ddd]"
                aria-hidden
              />
              <p className="text-center text-sm font-medium text-[#242424]">{t.cart.sauces}</p>
            </div>
            <div className="storefront-modal-surface storefront-modal-card-radius w-[120px] shrink-0 rounded-[16px] p-3">
              <div
                className="mb-2 aspect-square w-full rounded-lg border border-dashed border-[#ddd]"
                aria-hidden
              />
              <p className="text-center text-sm font-medium text-[#242424]">{t.cart.drinks}</p>
            </div>
          </div>
        </section>

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
    </div>
  )
}
