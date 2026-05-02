"use client"

import Image from "next/image"

import { cn } from "@/lib/utils"

type PosFoodServiceLogoProps = {
  className?: string
}

/** Логотип Food Service из макета Figma (узел 1:6), файл в `public/food-service-pos-logo.svg`. */
export function PosFoodServiceLogo({ className }: PosFoodServiceLogoProps) {
  return (
    <Image
      src="/food-service-pos-logo.svg"
      alt="Food Service POS"
      width={812}
      height={276}
      className={cn(
        "h-7 w-auto max-w-[min(220px,42vw)] object-contain object-left sm:h-8",
        className,
      )}
      priority
    />
  )
}
