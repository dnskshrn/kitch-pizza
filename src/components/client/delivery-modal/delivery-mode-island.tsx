"use client"

import { useDeliveryStore } from "@/lib/store/delivery-store"
import { useLanguage } from "@/lib/store/language-store"
import { cn } from "@/lib/utils"
import { Bike, UtensilsCrossed } from "lucide-react"

type DeliveryModeIslandProps = {
  /** В панели формы — серый трек; поверх карты — «стекло» по референсу */
  variant?: "panel" | "floating"
  className?: string
}

export function DeliveryModeIsland({
  variant = "panel",
  className,
}: DeliveryModeIslandProps) {
  const { t } = useLanguage()
  const mode = useDeliveryStore((s) => s.mode)
  const setMode = useDeliveryStore((s) => s.setMode)

  const isFloating = variant === "floating"

  return (
    <div
      role="group"
      aria-label={t.delivery.modeGroup}
      className={cn(
        "flex h-[42px] w-full gap-[10px] rounded-full p-[4px]",
        isFloating && "max-w-[min(100%,320px)]",
        isFloating
          ? "border border-white/60 bg-white/55 shadow-lg backdrop-blur-xl"
          : "storefront-modal-field",
        className,
      )}
    >
      <button
        type="button"
        onClick={() => setMode("delivery")}
        className={cn(
          "flex min-w-0 flex-1 cursor-pointer items-center justify-center gap-2 rounded-full py-[6px] text-center text-[16px] font-medium transition-colors",
          mode === "delivery"
            ? cn(
                "storefront-modal-mode-active",
                isFloating
                  ? "font-semibold shadow-md"
                  : "",
              )
            : cn(
                "text-black",
                isFloating ? "bg-transparent" : "storefront-modal-field",
              ),
        )}
      >
        <Bike className="size-[18px] shrink-0" strokeWidth={2} aria-hidden />
        <span className="truncate">{t.delivery.delivery}</span>
      </button>
      <button
        type="button"
        onClick={() => setMode("pickup")}
        className={cn(
          "flex min-w-0 flex-1 cursor-pointer items-center justify-center gap-2 rounded-full py-[6px] text-center text-[16px] font-medium transition-colors",
          mode === "pickup"
            ? cn(
                "storefront-modal-mode-active",
                isFloating
                  ? "font-semibold shadow-md"
                  : "",
              )
            : cn(
                "text-black",
                isFloating ? "bg-transparent" : "storefront-modal-field",
              ),
        )}
      >
        <UtensilsCrossed className="size-[18px] shrink-0" strokeWidth={2} aria-hidden />
        <span className="truncate">{t.delivery.pickup}</span>
      </button>
    </div>
  )
}
