"use client"

import { reverseGeocode } from "@/lib/actions/check-delivery-zone"
import { findZoneForPoint } from "@/lib/geo"
import { useDeliveryStore } from "@/lib/store/delivery-store"
import type { DeliveryZone } from "@/types/database"
import dynamic from "next/dynamic"
import { useCallback, useState } from "react"
import { X } from "lucide-react"
import { Drawer } from "vaul"
import { DeliveryContent } from "./DeliveryContent"
import { DeliveryModeIsland } from "./delivery-mode-island"

const DeliveryMap = dynamic(() => import("./DeliveryMap"), {
  ssr: false,
  loading: () => (
    <div
      className="absolute inset-0 z-0 animate-pulse bg-[#eee]"
      aria-hidden
    />
  ),
})

type DeliverySheetProps = {
  open: boolean
  onClose: () => void
  zones: DeliveryZone[]
}

export function DeliverySheet({ open, onClose, zones }: DeliverySheetProps) {
  const [locating, setLocating] = useState(false)
  const mode = useDeliveryStore((s) => s.mode)
  const mapLat = useDeliveryStore((s) => s.lat)
  const mapLng = useDeliveryStore((s) => s.lng)

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

  return (
    <Drawer.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-[60] bg-black/50" />
        <Drawer.Content className="fixed bottom-0 left-0 right-0 z-[70] flex h-[92dvh] max-h-[92dvh] flex-col overflow-hidden rounded-t-[24px] bg-white p-0 outline-none">
          <Drawer.Title className="sr-only">Адрес доставки</Drawer.Title>

          {/* Верх: карта (~половина высоты), как на десктопе — отдельно от панели формы */}
          <div className="relative min-h-0 flex-1 basis-0">
            <DeliveryMap
              zones={zones}
              mode={mode}
              lat={mapLat}
              lng={mapLng}
              onLocateMe={handleLocateMe}
              locating={locating}
              locateMeButtonClassName="bottom-4 right-4 z-10"
              className="h-full w-full min-h-0"
            />
            {/* Островок Доставка / Самовывоз + закрытие — поверх карты */}
            <div className="pointer-events-none absolute inset-0 z-[25]">
              <div className="pointer-events-auto absolute left-1/2 top-[max(0.75rem,env(safe-area-inset-top))] w-[min(320px,calc(100%-4.5rem))] -translate-x-1/2">
                <DeliveryModeIsland variant="floating" />
              </div>
              <button
                type="button"
                onClick={onClose}
                className="pointer-events-auto absolute right-3 top-[max(0.75rem,env(safe-area-inset-top))] z-[26] flex size-11 shrink-0 items-center justify-center rounded-full bg-white text-[#242424] shadow-md transition hover:opacity-90 active:scale-[0.96]"
                aria-label="Закрыть"
              >
                <X className="size-[22px]" strokeWidth={2.5} aria-hidden />
              </button>
            </div>
          </div>

          {/* Низ: форма на непрозрачном белом фоне, без blur */}
          <div className="flex min-h-0 flex-1 basis-0 flex-col overflow-hidden border-t border-[#ebebeb] bg-white">
            <div
              className="mx-auto mt-3 h-1 w-10 shrink-0 rounded-full bg-[#ccc]"
              aria-hidden
            />
            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-5 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <DeliveryContent
                zones={zones}
                onChoose={onClose}
                onLocateMe={handleLocateMe}
                locating={locating}
                hideModeToggle
              />
            </div>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
