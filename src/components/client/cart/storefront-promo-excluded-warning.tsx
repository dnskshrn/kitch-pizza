"use client"

import { AlertTriangle } from "lucide-react"

export function StorefrontPromoExcludedWarning({
  message,
}: {
  message: string
}) {
  return (
    <div
      className="flex items-start gap-2 rounded-[12px] border border-amber-200/90 bg-amber-50 px-3 py-2.5 text-xs leading-snug text-amber-950"
      role="status"
    >
      <AlertTriangle
        className="mt-0.5 size-4 shrink-0 text-amber-600"
        strokeWidth={2}
        aria-hidden
      />
      <p className="min-w-0 flex-1">{message}</p>
    </div>
  )
}
