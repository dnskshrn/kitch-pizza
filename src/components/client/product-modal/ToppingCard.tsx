"use client"

import { BRAND_CART_BG } from "@/lib/client-brand"
import { cn } from "@/lib/utils"
import type { Topping } from "@/types/database"
import { Check } from "lucide-react"
import Image from "next/image"

export type ToppingCardProps = {
  topping: Topping
  selected: boolean
  onToggle: () => void
  name: string
  priceLabel: string
}

export function ToppingCard({ topping, selected, onToggle, name, priceLabel }: ToppingCardProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "relative flex w-full cursor-pointer items-center gap-1.5 rounded-[12px] bg-white p-2 text-left transition-all duration-200 active:scale-[0.98]",
        selected ? "hover:brightness-[1.02]" : "hover:bg-[#f5f5f5]",
      )}
      style={{
        borderWidth: 2,
        borderStyle: "solid",
        borderColor: selected ? BRAND_CART_BG : "transparent",
      }}
    >
      {selected ? (
        <span
          className="pointer-events-none absolute left-1 top-1 z-10 flex h-6 w-6 items-center justify-center rounded-full"
          style={{ backgroundColor: "#5F7600" }}
          aria-hidden
        >
          <Check size={14} color="white" strokeWidth={3} />
        </span>
      ) : null}
      <div className="relative z-0 h-[72px] w-[72px] shrink-0 overflow-hidden rounded-md">
        {topping.image_url ? (
          <Image
            src={topping.image_url}
            alt=""
            width={72}
            height={72}
            className="h-full w-full object-contain"
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center rounded-md border border-dashed border-zinc-300 text-[10px] text-zinc-400"
            aria-hidden
          >
            —
          </div>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="line-clamp-2 text-[14px] font-medium leading-tight text-[#242424]">
          {name}
        </span>
        <span className="text-[14px] font-bold tabular-nums text-[#242424]">
          {priceLabel}
        </span>
      </div>
    </button>
  )
}
