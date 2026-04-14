"use client"

import { getActiveDeliveryZones } from "@/lib/actions/check-delivery-zone"
import { useDeliveryModalStore } from "@/lib/store/delivery-modal-store"
import { useDeliveryStore } from "@/lib/store/delivery-store"
import type { DeliveryZone } from "@/types/database"
import { useEffect, useState } from "react"
import { DeliveryModal } from "./DeliveryModal"
import { DeliverySheet } from "./DeliverySheet"

function useIsMobileViewport() {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(max-width: 767px)").matches
      : false,
  )
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)")
    const fn = () => setIsMobile(mq.matches)
    setIsMobile(mq.matches)
    mq.addEventListener("change", fn)
    return () => mq.removeEventListener("change", fn)
  }, [])
  return isMobile
}

export function DeliveryRoot() {
  const isOpen = useDeliveryModalStore((s) => s.isOpen)
  const close = useDeliveryModalStore((s) => s.close)
  const isMobile = useIsMobileViewport()
  const [zones, setZones] = useState<DeliveryZone[]>([])

  useEffect(() => {
    void getActiveDeliveryZones().then((z) => {
      setZones(z)
      useDeliveryStore.getState().recheckZoneWithZones(z)
    })
  }, [])

  useEffect(() => {
    if (!isOpen) return
    void getActiveDeliveryZones().then((z) => {
      setZones(z)
      useDeliveryStore.getState().recheckZoneWithZones(z)
    })
  }, [isOpen])

  if (isMobile) {
    return <DeliverySheet open={isOpen} onClose={close} zones={zones} />
  }
  return <DeliveryModal open={isOpen} onClose={close} zones={zones} />
}
