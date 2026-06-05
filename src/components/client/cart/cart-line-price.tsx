"use client"

import { formatMoney } from "@/lib/i18n/storefront"
import type { CartLang } from "@/lib/cart-helpers"

type CartLinePriceProps = {
  unitBani: number
  compareUnitBani?: number | null
  quantity: number
  giftFreeUnits?: number
  lang: CartLang
}

export function CartLinePrice({
  unitBani,
  compareUnitBani,
  quantity,
  giftFreeUnits = 0,
  lang,
}: CartLinePriceProps) {
  const freeUnits = Math.min(Math.max(0, giftFreeUnits), quantity)
  const paidUnits = quantity - freeUnits
  const showItemDiscount =
    compareUnitBani != null && compareUnitBani > unitBani
  const strikeUnitBani = showItemDiscount ? compareUnitBani : unitBani
  const strikeClass =
    "mr-1 text-xs font-normal text-muted-foreground line-through"
  const finalClass = "font-bold text-[#242424]"

  if (freeUnits <= 0) {
    if (!showItemDiscount) {
      return (
        <p className="text-[16px] font-bold tabular-nums text-[#242424]">
          {formatMoney(unitBani * quantity, lang)}
        </p>
      )
    }

    return (
      <div className="flex items-baseline text-[16px] tabular-nums">
        <span className={strikeClass}>
          {formatMoney(compareUnitBani * quantity, lang)}
        </span>
        <span className={finalClass}>
          {formatMoney(unitBani * quantity, lang)}
        </span>
      </div>
    )
  }

  const freePartStrikeBani = strikeUnitBani * freeUnits
  const paidPartBani = unitBani * paidUnits
  const paidPartStrikeBani = strikeUnitBani * paidUnits

  return (
    <div className="flex flex-wrap items-baseline text-[16px] tabular-nums">
      <span className={strikeClass}>{formatMoney(freePartStrikeBani, lang)}</span>
      <span className="storefront-modal-accent font-medium">
        {formatMoney(0, lang)}
      </span>
      {paidUnits > 0 ? (
        showItemDiscount ? (
          <>
            <span className={strikeClass}>
              {formatMoney(paidPartStrikeBani, lang)}
            </span>
            <span className={finalClass}>{formatMoney(paidPartBani, lang)}</span>
          </>
        ) : (
          <span className={finalClass}>{formatMoney(paidPartBani, lang)}</span>
        )
      ) : null}
    </div>
  )
}
