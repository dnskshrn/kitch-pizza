"use client"

import type { DeliveryZone } from "@/types/database"
import { useEffect, useRef } from "react"
import "leaflet/dist/leaflet.css"
import "leaflet-draw/dist/leaflet.draw.css"

const CHISINAU: [number, number] = [47.0245, 28.8322]
const FALLBACK_ZONE_COLOR = "#5F7600"

type LeafletModule = typeof import("leaflet")
type LMap = import("leaflet").Map
type LPolygon = import("leaflet").Polygon

function ringFromPolygon(layer: LPolygon): [number, number][] {
  const raw = layer.getLatLngs() as unknown
  const outer = Array.isArray(raw) && Array.isArray((raw as unknown[])[0])
    ? (raw as import("leaflet").LatLng[][])[0]
    : (raw as import("leaflet").LatLng[])
  return outer.map((p) => [p.lat, p.lng] as [number, number])
}

type Props = {
  zones: DeliveryZone[]
  editingId: string | null
  polygon: [number, number][]
  currentColor: string
  onPolygonChange: (coords: [number, number][]) => void
}

export default function AdminDeliveryMap({
  zones,
  editingId,
  polygon,
  currentColor,
  onPolygonChange,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<LMap | null>(null)
  const onChangeRef = useRef(onPolygonChange)
  onChangeRef.current = onPolygonChange

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    let cancelled = false
    let map: LMap | null = null
    const otherLayers: import("leaflet").Polygon[] = []

    void (async () => {
      const L = (await import("leaflet")).default as unknown as LeafletModule &
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { Draw: any }

      await import("leaflet-draw")

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl
      L.Icon.Default.mergeOptions({
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        iconRetinaUrl:
          "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      })

      if (cancelled || !containerRef.current) return

      const activeMap = L.map(containerRef.current).setView(CHISINAU, 12)
      map = activeMap
      mapRef.current = activeMap
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors",
      }).addTo(activeMap)

      zones.forEach((z) => {
        if (editingId && z.id === editingId) return
        if (!Array.isArray(z.polygon) || z.polygon.length < 2) return
        const zoneColor = z.color || FALLBACK_ZONE_COLOR
        const poly = L.polygon(
          z.polygon.map(([a, b]) => [a, b] as [number, number]),
          {
            color: zoneColor,
            weight: 2,
            dashArray: "6 4",
            fillColor: zoneColor,
            fillOpacity: 0.08,
          },
        ).addTo(activeMap)
        otherLayers.push(poly)
      })

      const drawnItems = new L.FeatureGroup()
      activeMap.addLayer(drawnItems)

      if (polygon.length >= 3) {
        const pl = L.polygon(
          polygon.map(([a, b]) => [a, b] as [number, number]),
          {
            color: currentColor || FALLBACK_ZONE_COLOR,
            weight: 3,
            fillColor: currentColor || FALLBACK_ZONE_COLOR,
            fillOpacity: 0.14,
          },
        )
        drawnItems.addLayer(pl)
        try {
          activeMap.fitBounds(pl.getBounds(), { padding: [24, 24] })
        } catch {
          /* noop */
        }
      }

      const drawControl = new L.Control.Draw({
        position: "topright",
        draw: {
          polygon: {
            allowIntersection: false,
            showArea: false,
          },
          polyline: false,
          rectangle: false,
          circle: false,
          marker: false,
          circlemarker: false,
        },
        edit: {
          featureGroup: drawnItems,
          remove: true,
        },
      })
      activeMap.addControl(drawControl)

      const extract = (layer: LPolygon) => {
        onChangeRef.current(ringFromPolygon(layer))
      }

      activeMap.on(
        "draw:created",
        (e: { layer: LPolygon }) => {
          drawnItems.clearLayers()
          e.layer.setStyle({
            color: currentColor || FALLBACK_ZONE_COLOR,
            fillColor: currentColor || FALLBACK_ZONE_COLOR,
            fillOpacity: 0.14,
          })
          drawnItems.addLayer(e.layer)
          extract(e.layer)
        },
      )

      activeMap.on("draw:edited", (e: import("leaflet").LeafletEvent) => {
        const layers = (e as unknown as { layers: import("leaflet").LayerGroup })
          .layers
        layers.eachLayer((layer) => {
          extract(layer as LPolygon)
        })
      })

      activeMap.on("draw:deleted", () => {
        onChangeRef.current([])
      })
    })()

    return () => {
      cancelled = true
      otherLayers.forEach((l) => {
        try {
          l.remove()
        } catch {
          /* noop */
        }
      })
      map?.remove()
      mapRef.current = null
    }
    // polygon — только начальное состояние при монтировании; сброс — через `key` у родителя
    // eslint-disable-next-line react-hooks/exhaustive-deps -- см. выше
  }, [currentColor, editingId, zones])

  return (
    <div
      ref={containerRef}
      className="h-[420px] w-full overflow-hidden rounded-md border border-border"
    />
  )
}
