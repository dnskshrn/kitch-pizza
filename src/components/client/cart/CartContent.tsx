"use client"

import { BRAND_CART_BG } from "@/lib/client-brand"
import type { CartLang } from "@/lib/cart-helpers"
import {
  selectCartDiscount,
  useCartStore,
} from "@/lib/store/cart-store"
import { useDeliveryStore } from "@/lib/store/delivery-store"
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
import { useEffect, useState } from "react"
import { CartItemCard } from "./CartItemCard"

const BRAND_DISCOUNT = "#5F7600"

const LANG_KEY = "lang"

function readLang(): CartLang {
  if (typeof window === "undefined") return "RU"
  return window.localStorage.getItem(LANG_KEY) === "RO" ? "RO" : "RU"
}

/** Склонение «N товар(ов)» для RU. */
function ruGoodsPhrase(n: number): string {
  const abs = n % 100
  const d = n % 10
  if (abs > 10 && abs < 20) return `${n} товаров`
  if (d === 1) return `${n} товар`
  if (d >= 2 && d <= 4) return `${n} товара`
  return `${n} товаров`
}

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
  const [lang, setLang] = useState<CartLang>("RU")
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

  useEffect(() => {
    setLang(readLang())
    const onStorage = (e: StorageEvent) => {
      if (e.key === LANG_KEY) setLang(readLang())
    }
    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [])

  const formatLei = (bani: number) =>
    (bani / 100).toLocaleString("ro-MD", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })

  const subtotalLei = formatLei(subtotal)
  const discountLei = formatLei(discount)
  const goodsBani = Math.max(0, subtotal - discount)
  const grandTotalBani = goodsBani + deliveryFeeBani
  const totalLei = formatLei(grandTotalBani)

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
    <div className="flex h-full min-h-0 flex-col bg-[#f2f2f2]">
      <header className="relative shrink-0 px-4 pb-6 pt-4 md:pb-7 md:pt-5">
        <div className="flex items-start gap-2 pr-10 md:pr-12">
          <ShoppingBasket className="mt-0.5 size-6 shrink-0 text-[#242424]" strokeWidth={2} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <h2 className="text-[20px] font-bold leading-tight text-[#242424]">
                {ruGoodsPhrase(itemCount)}
              </h2>
              <span className="inline-flex items-center gap-1 text-sm text-[rgba(36,36,36,0.45)]">
                Акции 2+1 / 3+1
                <Info className="size-4 shrink-0" strokeWidth={2} aria-hidden />
                {/* TODO: акции 2+1 / 3+1 — логика */}
              </span>
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 flex size-10 items-center justify-center rounded-full text-[#242424] transition-colors hover:bg-black/5"
          aria-label="Закрыть корзину"
        >
          <X className="size-5" strokeWidth={2.5} />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 [-webkit-overflow-scrolling:touch]">
        <div className="space-y-3">
          {items.length === 0 ? (
            <div className="flex min-h-[120px] items-center justify-center py-8 text-center text-[rgba(36,36,36,0.5)]">
              Корзина пуста
            </div>
          ) : (
            items.map((cartItem) => (
              <CartItemCard
                key={cartItem.id}
                cartItem={cartItem}
                lang={lang}
                name={
                  lang === "RO" ? cartItem.menuItem.name_ro : cartItem.menuItem.name_ru
                }
                onEdit={() => onEditItem(cartItem)}
                onRemove={() => onRemoveItem(cartItem.id)}
                onQuantityChange={(delta) => onQuantityChange(cartItem.id, delta)}
              />
            ))
          )}
        </div>

        <section className="mt-4 shrink-0 pb-4 pt-1">
          <p className="mb-2 text-xs text-[rgba(36,36,36,0.45)]">Добавить к заказу?</p>
          <div className="-mx-1 flex gap-2 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch]">
            {/* TODO: апселл — реальные категории «Соусы» / «Напитки» */}
            <div className="w-[120px] shrink-0 rounded-[16px] bg-white p-3">
              <div
                className="mb-2 aspect-square w-full rounded-lg border border-dashed border-[#ddd]"
                aria-hidden
              />
              <p className="text-center text-sm font-medium text-[#242424]">Соусы</p>
            </div>
            <div className="w-[120px] shrink-0 rounded-[16px] bg-white p-3">
              <div
                className="mb-2 aspect-square w-full rounded-lg border border-dashed border-[#ddd]"
                aria-hidden
              />
              <p className="text-center text-sm font-medium text-[#242424]">Напитки</p>
            </div>
          </div>
        </section>
      </div>

      {/* Статичная декоративная белая секция: промокод + итоги + кнопка (не часть жеста sheet) */}
      <section
        className="shrink-0 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2"
        aria-label="Промокод и оформление"
      >
        <div className="rounded-[20px] bg-white p-4">
          {appliedPromo ? (
            <div className="flex items-center gap-2 rounded-[12px] bg-[#f2f2f2] px-3 py-3">
              <Check
                className="size-5 shrink-0"
                style={{ color: BRAND_DISCOUNT }}
                strokeWidth={2.5}
                aria-hidden
              />
              <p className="min-w-0 flex-1 text-sm font-medium text-[#242424]">
                Промокод{" "}
                <span className="font-mono uppercase">{appliedPromo.code}</span>{" "}
                применён
              </p>
              <button
                type="button"
                onClick={() => {
                  removePromo()
                  setCodeInput("")
                }}
                className="flex size-9 shrink-0 items-center justify-center rounded-full text-[#242424] transition-colors hover:bg-black/10"
                aria-label="Убрать промокод"
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
                  placeholder="Промокод"
                  value={codeInput}
                  disabled={promoLoading}
                  onChange={(e) => setCodeInput(e.target.value)}
                  onKeyDown={handlePromoKeyDown}
                  className="min-w-0 flex-1 rounded-[12px] bg-[#f2f2f2] px-4 py-3 font-mono uppercase text-[#242424] placeholder:text-[rgba(36,36,36,0.35)] disabled:opacity-60"
                  aria-label="Промокод"
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
                    "Применить"
                  )}
                </button>
              </div>
              {promoError ? (
                <p className="text-sm text-red-600" role="alert">
                  {promoError}
                </p>
              ) : null}
            </div>
          )}

          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-[rgba(36,36,36,0.55)]">{ruGoodsPhrase(itemCount)}</span>
              <span className="font-medium tabular-nums text-[#242424]">{subtotalLei} лей</span>
            </div>
            {discount > 0 ? (
              <div className="flex items-center justify-between text-sm">
                <span className="text-[rgba(36,36,36,0.55)]">Скидка</span>
                <span
                  className="font-medium tabular-nums"
                  style={{ color: BRAND_DISCOUNT }}
                >
                  −{discountLei} лей
                </span>
              </div>
            ) : null}
            <div className="flex items-center justify-between text-sm">
              <span className="inline-flex items-center gap-1 text-[rgba(36,36,36,0.55)]">
                Доставка
                <Info className="size-[14px] shrink-0" strokeWidth={2} aria-hidden />
                {/* TODO: расчёт доставки */}
              </span>
              <span className="tabular-nums text-[rgba(36,36,36,0.45)]">-- лей</span>
            </div>
          </div>

          <div className="mt-5 flex items-center gap-3 border-t border-[#f0f0f0] pt-4">
            <p className="text-[24px] font-bold tabular-nums text-[#242424]">{totalLei} лей</p>
            <Link
              href="/checkout"
              onClick={onClose}
              className="flex flex-1 cursor-pointer items-center justify-center gap-1 rounded-full py-3.5 text-[18px] font-bold text-[#343434] transition-all hover:brightness-95 active:scale-[0.98]"
              style={{ backgroundColor: BRAND_CART_BG }}
            >
              К оформлению
              <ChevronRight className="size-5 shrink-0" strokeWidth={2.5} />
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
