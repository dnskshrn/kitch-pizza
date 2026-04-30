"use client"

import { getBrandBySlug } from "@/brands/index"
import { cn } from "@/lib/utils"
import Image from "next/image"

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
      <Image
        src={brand.logo}
        alt={brand.name}
        width={200}
        height={64}
        className={cn(
          "h-auto w-auto object-contain object-left",
          size === "md"
            ? "max-h-7 max-w-[min(140px,28vw)] sm:max-w-[160px]"
            : "max-h-4 max-w-[100px]",
        )}
        priority={size === "md"}
      />
    </span>
  )
}
