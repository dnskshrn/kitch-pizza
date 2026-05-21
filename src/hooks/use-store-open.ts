import { useState, useEffect } from "react"
import { getBrandBySlug } from "@/brands"
import {
  formatStoreOpenTime,
  getChisinauMinutes,
  getMinutesUntilStoreOpen,
  isStoreOpenAt,
} from "@/lib/store-hours"

function resolveBrandSlug(explicit?: string): string {
  if (explicit) return explicit
  if (typeof document !== "undefined") {
    return (
      document.body.dataset.brand ??
      document.querySelector("[data-brand]")?.getAttribute("data-brand") ??
      "kitch-pizza"
    )
  }
  return "kitch-pizza"
}

export function useStoreOpen(brandSlug?: string) {
  const slug = resolveBrandSlug(brandSlug)
  const { openHour, closeHour } = getBrandBySlug(slug)
  const openTimeLabel = formatStoreOpenTime(openHour)

  const [isOpen, setIsOpen] = useState(true)
  const [minutesLeft, setMinutesLeft] = useState(0)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const update = () => {
      const now = getChisinauMinutes()
      const open = isStoreOpenAt(openHour, closeHour, now)
      setIsOpen(open)
      setMinutesLeft(
        open ? 0 : getMinutesUntilStoreOpen(openHour, closeHour, now)
      )
    }
    update()
    const interval = setInterval(update, 30_000)
    return () => clearInterval(interval)
  }, [openHour, closeHour])

  const hours = Math.floor(minutesLeft / 60)
  const minutes = minutesLeft % 60

  return { isOpen, hours, minutes, mounted, openTimeLabel }
}
