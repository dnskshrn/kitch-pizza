"use client"

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
        "storefront-modal-surface relative flex w-full cursor-pointer flex-col gap-2 rounded-[12px] p-2 text-left transition-all duration-200 active:scale-[0.98]",
        selected ? "hover:brightness-[1.02]" : "hover:bg-[#f5f5f5]",
      )}
      style={{
        borderWidth: 2,
        borderStyle: "solid",
        borderColor: selected ? "var(--color-accent)" : "transparent",
      }}
    >
      {selected ? (
        <span
          className="storefront-modal-accent-bg pointer-events-none absolute left-1 top-1 z-10 flex h-6 w-6 items-center justify-center rounded-full"
          aria-hidden
        >
          <Check size={14} color="white" strokeWidth={3} />
        </span>
      ) : null}
      <div className="relative z-0 aspect-square w-full shrink-0 overflow-hidden rounded-md">
        {topping.image_url ? (
          <Image
            src={topping.image_url}
            alt=""
            fill
            className="object-contain"
            sizes="(max-width: 768px) 30vw, 140px"
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
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="line-clamp-2 text-[14px] font-bold leading-tight text-[#242424]">
          {name}
        </span>
        <span className="text-[13px] font-medium tabular-nums text-[#242424]">
          {priceLabel}
        </span>
      </div>
    </button>
  )
}
