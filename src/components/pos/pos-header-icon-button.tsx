"use client"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { ComponentProps } from "react"

/** Кнопка в шапке POS (закрыть / назад): стандартный тач-таргет 40×40, фон #f2f2f2. */
export const posHeaderIconButtonClassName = cn(
  "shrink-0 size-10 min-h-10 min-w-10 rounded-lg border-0",
  "bg-[#f2f2f2] !text-foreground shadow-none",
  "hover:!bg-[#e8e8e8] active:!bg-[#e0e0e0] dark:hover:!bg-[#d8d8d8] dark:active:!bg-[#d0d0d0]",
  "focus-visible:ring-2 focus-visible:ring-ring/50",
)

/** Кнопка «Закрыть» (X) — белая плашка на сером фоне панели. */
export const posHeaderCloseButtonClassName = cn(
  "shrink-0 size-10 min-h-10 min-w-10 rounded-lg border-0",
  "bg-white !text-foreground shadow-none",
  "hover:!bg-zinc-100 active:!bg-zinc-200",
  "focus-visible:ring-2 focus-visible:ring-ring/50",
)

export function PosHeaderIconButton({
  className,
  ...props
}: ComponentProps<typeof Button>) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn(posHeaderIconButtonClassName, className)}
      {...props}
    />
  )
}
