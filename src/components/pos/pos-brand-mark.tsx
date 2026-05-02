"use client"

import { getBrandBySlug } from "@/brands/index"
import { cn } from "@/lib/utils"

type PosBrandMarkProps = {
  brandSlug: string
  className?: string
  /** `sm` — строка в карточке списка; `md` — шапка заказа */
  size?: "sm" | "md"
}

export function PosBrandMark({
  brandSlug,
  className,
  size = "sm",
}: PosBrandMarkProps) {
  const brand = getBrandBySlug(brandSlug)

  return (
    <span
      className={cn("inline-flex shrink-0 items-center justify-center", className)}
      title={brand.name}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- локальные SVG-марки; next/image даёт сбои на части SVG в POS */}
      <img
        src={brand.logo}
        alt=""
        decoding="async"
        draggable={false}
        className={cn(
          "block h-auto w-auto object-contain object-left",
          size === "md"
            ? "max-h-7 max-w-[min(140px,28vw)] sm:max-w-[160px]"
            : "max-h-4 max-w-[100px]",
        )}
      />
    </span>
  )
}
