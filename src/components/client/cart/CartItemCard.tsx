"use client"

import { BRAND_ACCENT } from "@/lib/client-brand"
import { getCartItemPrice, getCartItemSummary } from "@/lib/cart-helpers"
import type { CartLang } from "@/lib/cart-helpers"
import type { CartItem } from "@/types/cart"
import { Minus, Plus, X } from "lucide-react"
import Image from "next/image"

type CartItemCardProps = {
  cartItem: CartItem
  name: string
  lang: CartLang
  onEdit: () => void
  onRemove: () => void
  onQuantityChange: (delta: 1 | -1) => void
}

export function CartItemCard({
  cartItem,
  name,
  lang,
  onEdit,
  onRemove,
  onQuantityChange,
}: CartItemCardProps) {
  const summary = getCartItemSummary(cartItem, lang)
  const unitBani = getCartItemPrice(cartItem)
  const lineTotalLei = (unitBani * cartItem.quantity) / 100
  const formattedLine = lineTotalLei.toLocaleString("ro-MD", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })

  return (
    <div className="flex flex-col rounded-[16px] bg-white p-3">
      <div className="flex gap-3">
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-[12px]">
          {cartItem.menuItem.image_url ? (
            <Image
              src={cartItem.menuItem.image_url}
              alt=""
              fill
              className="object-cover"
              sizes="64px"
            />
          ) : (
            <div
              className="flex h-full w-full items-center justify-center text-center text-[10px] leading-tight text-zinc-400"
              aria-hidden
            >
              {lang === "RO" ? "Fără foto" : "Нет фото"}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-bold leading-tight text-[#242424]">{name}</p>
          {summary ? (
            <p className="mt-0.5 line-clamp-2 text-sm text-[rgba(36,36,36,0.5)]">
              {summary}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="shrink-0 self-start p-0.5 text-[rgba(36,36,36,0.4)] transition-colors hover:text-[#242424]"
          aria-label="Удалить"
        >
          <X className="size-4" strokeWidth={2} />
        </button>
      </div>

      <div className="mt-2 flex min-w-0 items-center justify-between gap-2">
        <p className="text-[16px] font-bold tabular-nums text-[#242424]">
          {formattedLine} лей
        </p>
        <button
          type="button"
          onClick={onEdit}
          className="text-[15px] font-medium transition-opacity hover:opacity-80"
          style={{ color: BRAND_ACCENT }}
        >
          Изменить
        </button>
        <div className="inline-flex shrink-0 items-center gap-0 rounded-full bg-[#f2f2f2] p-0.5">
          <button
            type="button"
            onClick={() => onQuantityChange(-1)}
            className="flex size-8 items-center justify-center rounded-full text-[#242424] transition-colors hover:bg-black/5"
            aria-label="Меньше"
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
            aria-label="Больше"
          >
            <Plus className="size-4" strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </div>
  )
}
