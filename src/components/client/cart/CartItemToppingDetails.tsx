"use client"

import {
  getCartItemToppingDisplayGroups,
  type CartLang,
} from "@/lib/cart-helpers"
import { formatMoney } from "@/lib/i18n/storefront"
import type { CartItem } from "@/types/cart"

type CartItemToppingDetailsProps = {
  cartItem: CartItem
  lang: CartLang
  className?: string
}

export function CartItemToppingDetails({
  cartItem,
  lang,
  className,
}: CartItemToppingDetailsProps) {
  const groups = getCartItemToppingDisplayGroups(cartItem, lang)
  if (groups.length === 0) return null

  const comboBadge = lang === "RO" ? "În combo" : "В комбо"

  return (
    <div className={className}>
      {groups.map((group) => (
        <div key={group.groupId || "ungrouped"} className="mt-1 first:mt-0">
          {group.groupName ? (
            <p className="mb-0.5 flex flex-wrap items-center gap-1.5 text-[12px] font-semibold text-[rgba(36,36,36,0.55)]">
              <span>{group.groupName}</span>
              {group.isFullyFree ? (
                <span className="inline-flex rounded-full bg-[#4CAF50]/15 px-1.5 py-0.5 text-[10px] font-semibold text-[#4CAF50]">
                  {comboBadge}
                </span>
              ) : null}
            </p>
          ) : null}
          <ul className="space-y-0.5">
            {group.lines.map((line) => (
              <li
                key={line.toppingId}
                className="text-[12px] leading-snug text-[rgba(36,36,36,0.5)]"
              >
                {line.name}
                {line.quantity > 1 ? ` ×${line.quantity}` : ""}
                {" — "}
                {formatMoney(line.chargeBani, lang)}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
