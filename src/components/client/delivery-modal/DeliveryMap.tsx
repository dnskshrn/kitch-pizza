"use client"

import { reverseGeocode } from "@/lib/actions/check-delivery-zone"
import { findZoneForPoint } from "@/lib/geo"
import { useDeliveryStore } from "@/lib/store/delivery-store"
import type { DeliveryZone } from "@/types/database"
import {
  STOREFRONT_MAP_ATTRIBUTION,
  STOREFRONT_MAP_TILE_URL,
} from "@/lib/leaflet-storefront-tiles"
import { cn } from "@/lib/utils"
import L from "leaflet"
import { Navigation } from "lucide-react"
import Image from "next/image"
import { useEffect, useRef, useState } from "react"
import "leaflet/dist/leaflet.css"

const CHISINAU: [number, number] = [47.0245, 28.8322]
const RESTAURANT: [number, number] = [47.0167, 28.8414]

function closeCoord(a: number, b: number, eps = 1e-5) {
  return Math.abs(a - b) < eps
}

export type DeliveryMapProps = {
  /** Если ещё не загружено — передавайте []; компонент терпимо относится к undefined. */
  zones?: DeliveryZone[] | null
  mode: "delivery" | "pickup"
  lat: number | null
  lng: number | null
  className?: string
  /** Кнопка «Найти меня» поверх карты (правый нижний угол) */
  onLocateMe?: () => void
  locating?: boolean
  /** Позиция/ z-index кнопки (напр. моб. sheet: выше нижней панели) */
  locateMeButtonClassName?: string
}

export default function DeliveryMap({
  zones,
  mode,
  lat,
  lng,
  className,
  onLocateMe,
  locating = false,
  locateMeButtonClassName,
}: DeliveryMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const zonesRef = useRef<DeliveryZone[]>(zones ?? [])
  const modeRef = useRef(mode)
  const ignoreNextMoveEndRef = useRef(false)
  const moveSeqRef = useRef(0)

  zonesRef.current = zones ?? []
  modeRef.current = mode

  const polygonLayersRef = useRef<L.Polygon[]>([])
  const [mapReady, setMapReady] = useState(false)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const map = L.map(el).setView(CHISINAU, 13)
    mapRef.current = map
    L.tileLayer(STOREFRONT_MAP_TILE_URL, {
      attribution: STOREFRONT_MAP_ATTRIBUTION,
    }).addTo(map)

    const runReverseForCenter = () => {
      const c = map.getCenter()
      moveSeqRef.current += 1
      const seq = moveSeqRef.current
      useDeliveryStore.getState().setGeocoding(true)
      void (async () => {
        try {
          const rev = await reverseGeocode(c.lat, c.lng)
          if (seq !== moveSeqRef.current) return
          const zone = findZoneForPoint(c.lat, c.lng, zonesRef.current)
          useDeliveryStore.getState().setResolved(
            c.lat,
            c.lng,
            rev?.display_name ?? "",
            zone,
          )
        } catch {
          if (seq !== moveSeqRef.current) return
          const zone = findZoneForPoint(c.lat, c.lng, zonesRef.current)
          useDeliveryStore.getState().setResolved(c.lat, c.lng, "", zone)
        }
      })()
    }

    const onMoveEnd = () => {
      if (ignoreNextMoveEndRef.current) {
        ignoreNextMoveEndRef.current = false
        return
      }
      if (modeRef.current !== "delivery") return
      runReverseForCenter()
    }

    const onMapClick = (e: { latlng: { lat: number; lng: number } }) => {
      if (modeRef.current !== "delivery") return
      map.setView(e.latlng, map.getZoom())
    }

    map.on("moveend", onMoveEnd)
    map.on("click", onMapClick)

    setMapReady(true)

    return () => {
      setMapReady(false)
      polygonLayersRef.current.forEach((p) => {
        try {
          p.remove()
        } catch {
          /* noop */
        }
      })
      polygonLayersRef.current = []
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!mapReady) return
    const map = mapRef.current
    if (!map) return

    polygonLayersRef.current.forEach((p) => p.remove())
    polygonLayersRef.current = []
    ;(zones ?? []).forEach((z, idx) => {
      const isPrimary = idx === 0
      const poly = L.polygon(
        z.polygon.map((pair) => [pair[0], pair[1]] as [number, number]),
        {
          color: isPrimary ? "#5F7600" : "#2563eb",
          weight: 2,
          opacity: isPrimary ? 0.6 : 0.5,
          fillColor: isPrimary ? "#5F7600" : "#2563eb",
          fillOpacity: isPrimary ? 0.2 : 0.15,
        },
      ).addTo(map)
      polygonLayersRef.current.push(poly)
    })
  }, [mapReady, zones])

  useEffect(() => {
    if (!mapReady) return
    const map = mapRef.current
    if (!map) return

    if (mode === "pickup") {
      ignoreNextMoveEndRef.current = true
      map.setView(RESTAURANT, 15)
      return
    }

    if (lat != null && lng != null) {
      const c = map.getCenter()
      if (closeCoord(c.lat, lat) && closeCoord(c.lng, lng)) return
      ignoreNextMoveEndRef.current = true
      map.setView([lat, lng], 15)
    } else {
      ignoreNextMoveEndRef.current = false
      map.setView(CHISINAU, 13)
    }
  }, [mapReady, mode, lat, lng])

  return (
    <div
      className={cn("relative min-h-[240px] w-full", className)}
      onPointerDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
    >
      <div ref={containerRef} className="absolute inset-0 z-0 min-h-[240px]" />
      {mode === "delivery" ? (
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 z-[5] -translate-x-1/2 -translate-y-full"
          aria-hidden
        >
          <Image
            src="/Address_Pin_Geo.svg"
            alt=""
            width={43}
            height={61}
            className="h-[52px] w-auto drop-shadow-md"
            unoptimized
          />
        </div>
      ) : null}
      {onLocateMe ? (
        <button
          type="button"
          onClick={onLocateMe}
          disabled={locating}
          className={cn(
            "absolute flex cursor-pointer items-center gap-[12px] rounded-full bg-white px-[16px] py-[8px] transition-opacity disabled:pointer-events-none disabled:opacity-60",
            locateMeButtonClassName ?? "bottom-[20px] right-[20px] z-[1000]",
          )}
        >
          <Navigation
            className="size-[22px] shrink-0 rotate-180 scale-y-[-1] text-[#242424]"
            strokeWidth={2}
            aria-hidden
          />
          <span className="text-[16px] font-bold leading-none text-[#242424]">
            Найти меня
          </span>
        </button>
      ) : null}
    </div>
  )
}
