"use client"

import { getCartItemPrice, getCartItemSizeLabel } from "@/lib/cart-helpers"
import type { CartLang } from "@/lib/cart-helpers"
import { formatMoney } from "@/lib/i18n/storefront"
import { useLanguage } from "@/lib/store/language-store"
import { menuItemImageAlt } from "@/lib/seo/menu-item-image-alt"
import type { CartItem } from "@/types/cart"
import { Minus, Plus, X } from "lucide-react"
import Image from "next/image"
import { CartItemToppingDetails } from "./CartItemToppingDetails"

type CartItemCardProps = {
  cartItem: CartItem
  name: string
  lang: CartLang
  /** Сколько единиц на этой строке бесплатны по акции (giftItems). */
  giftFreeUnits?: number
  onEdit: () => void
  onRemove: () => void
  onQuantityChange: (delta: 1 | -1) => void
}

function CartLinePrice({
  unitBani,
  quantity,
  giftFreeUnits,
  lang,
}: {
  unitBani: number
  quantity: number
  giftFreeUnits: number
  lang: CartLang
}) {
  const freeUnits = Math.min(Math.max(0, giftFreeUnits), quantity)
  const paidUnits = quantity - freeUnits

  if (freeUnits <= 0) {
    return (
      <p className="text-[16px] font-bold tabular-nums text-[#242424]">
        {formatMoney(unitBani * quantity, lang)}
      </p>
    )
  }

  const freePartBani = unitBani * freeUnits
  const paidPartBani = unitBani * paidUnits

  return (
    <div className="flex flex-wrap items-center gap-2 text-[16px] font-bold tabular-nums">
      <span className="line-through text-muted-foreground font-normal">
        {formatMoney(freePartBani, lang)}
      </span>
      <span className="storefront-modal-accent font-medium">
        {formatMoney(0, lang)}
      </span>
      {paidUnits > 0 ? (
        <span className="text-[#242424]">{formatMoney(paidPartBani, lang)}</span>
      ) : null}
    </div>
  )
}

export function CartItemCard({
  cartItem,
  name,
  lang,
  giftFreeUnits = 0,
  onEdit,
  onRemove,
  onQuantityChange,
}: CartItemCardProps) {
  const { t } = useLanguage()
  const sizeLabel = getCartItemSizeLabel(cartItem, lang)
  const unitBani = getCartItemPrice(cartItem)

  return (
    <div className="storefront-modal-surface storefront-modal-card-radius flex flex-col rounded-[16px] p-3">
      <div className="flex gap-3">
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-[12px]">
          {cartItem.menuItem.image_url ? (
            <Image
              src={cartItem.menuItem.image_url}
              alt={menuItemImageAlt(cartItem.menuItem.name_ro)}
              fill
              className="object-cover"
              sizes="64px"
            />
          ) : (
            <div
              className="flex h-full w-full items-center justify-center text-center text-[10px] leading-tight text-zinc-400"
              aria-hidden
            >
              {t.common.noPhoto}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-bold leading-tight text-[#242424]">{name}</p>
          {sizeLabel ? (
            <p className="mt-0.5 text-sm text-[rgba(36,36,36,0.5)]">{sizeLabel}</p>
          ) : null}
          <CartItemToppingDetails cartItem={cartItem} lang={lang} />
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="shrink-0 self-start p-0.5 text-[rgba(36,36,36,0.4)] transition-colors hover:text-[#242424]"
          aria-label={t.cart.remove}
        >
          <X className="size-4" strokeWidth={2} />
        </button>
      </div>

      <div className="mt-2 flex min-w-0 items-center justify-between gap-2">
        <CartLinePrice
          unitBani={unitBani}
          quantity={cartItem.quantity}
          giftFreeUnits={giftFreeUnits}
          lang={lang}
        />
        <button
          type="button"
          onClick={onEdit}
          className="storefront-modal-accent text-[15px] font-medium transition-opacity hover:opacity-80"
        >
          {t.cart.edit}
        </button>
        <div className="storefront-modal-field inline-flex shrink-0 items-center gap-0 rounded-full p-0.5">
          <button
            type="button"
            onClick={() => onQuantityChange(-1)}
            className="flex size-8 items-center justify-center rounded-full text-[#242424] transition-colors hover:bg-black/5"
            aria-label={t.cart.decrease}
          >
            <Minus className="size-4" strokeWidth={2.5} />
          </button>
          <span className="min-w-[2ch] px-1 text-center text-sm font-semibold tabular-nums">
            {cartItem.quantity}
          </span>
          <button
            type="button"
            onClick={() => onQuantityChange(1)}
            className="flex size-8 items-center justify-center rounded-full text-[#242424] transition-colors hover:bg-black/5"
            aria-label={t.cart.increase}
          >
            <Plus className="size-4" strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </div>
  )
}
