"use client"

import { fixLeafletDefaultIcon } from "@/lib/leaflet-fix-default-icon"
import {
  STOREFRONT_MAP_ATTRIBUTION,
  STOREFRONT_MAP_TILE_URL,
} from "@/lib/leaflet-storefront-tiles"
import { cn } from "@/lib/utils"
import L from "leaflet"
import { useEffect, useRef } from "react"
import "leaflet/dist/leaflet.css"

const RESTAURANT: L.LatLngTuple = [47.0167, 28.8414]

type CheckoutSuccessMapProps = {
  mode: "delivery" | "pickup"
  lat: number | null
  lng: number | null
  className?: string
}

/**
 * Та же подложка Carto, что в `DeliveryMap`; маркер — адрес доставки или ресторан при самовывозе.
 */
export function CheckoutSuccessMap({
  mode,
  lat,
  lng,
  className,
}: CheckoutSuccessMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    fixLeafletDefaultIcon(L)

    const point: L.LatLngTuple =
      mode === "delivery" && lat != null && lng != null
        ? [lat, lng]
        : RESTAURANT

    const map = L.map(el, {
      scrollWheelZoom: true,
    }).setView(point, 15)

    L.tileLayer(STOREFRONT_MAP_TILE_URL, {
      attribution: STOREFRONT_MAP_ATTRIBUTION,
    }).addTo(map)

    L.marker(point).addTo(map)

    return () => {
      map.remove()
    }
  }, [mode, lat, lng])

  return (
    <div
      ref={containerRef}
      className={cn("z-0 min-h-[300px] w-full", className)}
    />
  )
}
