"use client"

import { cn } from "@/lib/utils"
import { Minus, Plus } from "lucide-react"
import Image from "next/image"

export type ToppingStepperCardVariant = "storefront" | "pos"

export type ToppingStepperCardProps = {
  variant?: ToppingStepperCardVariant
  imageUrl: string | null
  name: string
  quantity: number
  priceLabel: string
  priceIsFree?: boolean
  addDisabled: boolean
  onAdd: () => void
  onRemove: () => void
  decreaseLabel?: string
  increaseLabel?: string
}

export function ToppingStepperCard({
  variant = "storefront",
  imageUrl,
  name,
  quantity,
  priceLabel,
  priceIsFree = false,
  addDisabled,
  onAdd,
  onRemove,
  decreaseLabel = "Меньше",
  increaseLabel = "Добавить",
}: ToppingStepperCardProps) {
  const selected = quantity > 0
  const isStorefront = variant === "storefront"

  const handleCardActivate = () => {
    if (addDisabled) return
    onAdd()
  }

  const handleCardKeyDown = (e: React.KeyboardEvent) => {
    if (addDisabled) return
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      onAdd()
    }
  }

  return (
    <div
      role="button"
      tabIndex={addDisabled ? -1 : 0}
      aria-label={increaseLabel}
      aria-disabled={addDisabled}
      onClick={handleCardActivate}
      onKeyDown={handleCardKeyDown}
      className={cn(
        "flex flex-col items-center rounded-xl border bg-white p-3 transition-colors outline-none select-none",
        !addDisabled &&
          "cursor-pointer hover:bg-[#fafafa] focus-visible:ring-2 focus-visible:ring-[#242424]/20",
        addDisabled &&
          (quantity > 0 ? "cursor-default" : "cursor-default opacity-50"),
        selected
          ? isStorefront
            ? "border-[#5f7600] shadow-sm"
            : "border-primary shadow-sm"
          : "border-[#f2f2f2]",
      )}
    >
      <div className="relative mx-auto mb-2 size-16 shrink-0 overflow-hidden rounded-md pointer-events-none">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt=""
            fill
            className="object-contain"
            sizes="64px"
          />
        ) : (
          <div
            className={cn(
              "flex h-full w-full items-center justify-center rounded-md border border-dashed text-[10px]",
              isStorefront
                ? "border-zinc-300 text-zinc-400"
                : "border-border text-muted-foreground",
            )}
            aria-hidden
          >
            —
          </div>
        )}
      </div>

      <p className="pointer-events-none line-clamp-2 w-full text-center text-sm font-medium leading-tight text-[#242424]">
        {name}
      </p>

      <p
        className={cn(
          "pointer-events-none mt-1 text-center text-xs font-medium tabular-nums",
          priceIsFree ? "text-[#4CAF50]" : "text-[#808080]",
        )}
      >
        {priceLabel}
      </p>

      <div className="mt-2 flex min-h-7 w-full items-center justify-center">
        {selected ? (
          <div
            className={cn(
              "inline-flex items-center gap-0 rounded-full p-0.5",
              isStorefront ? "storefront-modal-field bg-white/80" : "bg-[#f2f2f2]",
            )}
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onRemove()
              }}
              className="flex size-7 items-center justify-center rounded-full text-[#242424] transition-colors hover:bg-black/5"
              aria-label={decreaseLabel}
            >
              <Minus className="size-3.5" strokeWidth={2.5} />
            </button>
            <span className="pointer-events-none min-w-[2ch] px-0.5 text-center text-xs font-semibold tabular-nums text-[#242424]">
              {quantity}
            </span>
          </div>
        ) : (
          <span
            className={cn(
              "flex size-7 items-center justify-center rounded-full text-[#242424] pointer-events-none",
              isStorefront ? "storefront-modal-field bg-white/80" : "bg-[#f2f2f2]",
            )}
            aria-hidden
          >
            <Plus className="size-3.5" strokeWidth={2.5} />
          </span>
        )}
      </div>
    </div>
  )
}
