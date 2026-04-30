"use client"

import { reverseGeocode } from "@/lib/actions/check-delivery-zone"
import { findZoneForPoint } from "@/lib/geo"
import { useDeliveryStore } from "@/lib/store/delivery-store"
import { useLanguage } from "@/lib/store/language-store"
import type { DeliveryZone } from "@/types/database"
import { cn } from "@/lib/utils"
import { X } from "lucide-react"
import dynamic from "next/dynamic"
import { useCallback, useEffect, useState } from "react"
import { DeliveryContent } from "./DeliveryContent"

const DeliveryMap = dynamic(() => import("./DeliveryMap"), {
  ssr: false,
  loading: () => (
    <div
      className="h-full min-h-[280px] w-full animate-pulse bg-[#eee]"
      aria-hidden
    />
  ),
})

const DESKTOP_EXIT_MS = 300

type DeliveryModalProps = {
  open: boolean
  onClose: () => void
  zones: DeliveryZone[]
}

export function DeliveryModal({ open, onClose, zones }: DeliveryModalProps) {
  const { t } = useLanguage()
  const [visible, setVisible] = useState(false)
  const [rendered, setRendered] = useState(false)
  const [locating, setLocating] = useState(false)

  const mode = useDeliveryStore((s) => s.mode)

  useEffect(() => {
    if (open) {
      setRendered(true)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setVisible(true))
      })
    } else {
      setVisible(false)
      const t = setTimeout(() => setRendered(false), DESKTOP_EXIT_MS)
      return () => clearTimeout(t)
    }
  }, [open])

  const resolvePick = useCallback(
    async (la: number, ln: number) => {
      const rev = await reverseGeocode(la, ln)
      const zone = findZoneForPoint(la, ln, zones)
      useDeliveryStore
        .getState()
        .setResolved(la, ln, rev?.display_name ?? "", zone)
    },
    [zones],
  )

  const handleLocateMe = useCallback(() => {
    if (!navigator.geolocation) return
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        void resolvePick(pos.coords.latitude, pos.coords.longitude).finally(() =>
          setLocating(false),
        )
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 12_000 },
    )
  }, [resolvePick])

  const mapLat = useDeliveryStore((s) => s.lat)
  const mapLng = useDeliveryStore((s) => s.lng)

  if (!rendered) return null

  return (
    <div
      className={cn(
        "fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 transition-opacity duration-300 ease-out",
        visible ? "opacity-100" : "opacity-0",
      )}
      role="presentation"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-[960px]"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={cn(
            "storefront-modal-surface relative flex h-[540px] w-full flex-row overflow-hidden rounded-[24px] transition-all duration-300 ease-out",
            visible
              ? "translate-y-0 scale-100 opacity-100"
              : "translate-y-3 scale-[0.96] opacity-0",
          )}
          role="dialog"
          aria-modal="true"
          aria-label={t.delivery.title}
        >
          <button
            type="button"
            onClick={onClose}
            className="storefront-modal-surface absolute right-4 top-4 z-[2000] flex size-11 cursor-pointer items-center justify-center rounded-full text-[#242424] shadow-md transition-all duration-200 hover:bg-gray-200 active:scale-[0.93]"
            aria-label={t.common.close}
          >
            <X size={22} strokeWidth={2.5} />
          </button>
          <div className="storefront-modal-surface flex h-full w-full min-w-0 max-w-[450px] shrink-0 flex-col border-r border-[#ebebeb] p-[20px]">
            <DeliveryContent
              zones={zones}
              onChoose={onClose}
              onLocateMe={handleLocateMe}
              locating={locating}
              layout="desktop"
            />
          </div>
          <div className="relative min-h-0 min-w-0 flex-1 bg-[#e5e5e5]">
            <DeliveryMap
              zones={zones}
              mode={mode}
              lat={mapLat}
              lng={mapLng}
              onLocateMe={handleLocateMe}
              locating={locating}
              className="h-full w-full min-h-0"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
