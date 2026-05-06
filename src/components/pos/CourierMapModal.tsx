"use client"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { fixLeafletDefaultIcon } from "@/lib/leaflet-fix-default-icon"
import { createClient } from "@/lib/supabase/client"
import dynamic from "next/dynamic"
import { Loader2 } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import "leaflet/dist/leaflet.css"

export type CourierMapModalProps = {
  isOpen: boolean
  onClose: () => void
}

type CourierPosition = {
  staffId: string
  name: string
  lat: number
  lng: number
  updatedAt: string
}

type CourierLeafletMapProps = {
  positions: CourierPosition[]
}

/** Вся разметка react-leaflet — только после динамического импорта (SSR: false). */
const CourierLeafletMap = dynamic(
  async () => {
    const RL = await import("react-leaflet")
    const {
      MapContainer,
      Marker,
      Popup,
      TileLayer,
      Tooltip,
      useMap,
    } = RL

    function MapResize() {
      const map = useMap()
      useEffect(() => {
        const t = window.setTimeout(() => map.invalidateSize(), 200)
        return () => window.clearTimeout(t)
      }, [map])
      return null
    }

    return function CourierLeafletMapInner({ positions }: CourierLeafletMapProps) {
      return (
        <MapContainer
          center={[47.0245, 28.8322]}
          zoom={12}
          scrollWheelZoom
          className="[&_.leaflet-container]:isolate [&_.leaflet-container]:z-0 [&_.leaflet-container]:size-full [&_.leaflet-layer]:isolate"
          style={{ height: 480, width: "100%" }}
        >
          <MapResize />
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {positions.map((p) => (
            <Marker key={p.staffId} position={[p.lat, p.lng]}>
              <Tooltip
                permanent
                direction="top"
                opacity={1}
                className="!rounded-md !border-0 !bg-white/95 !px-2 !py-0.5 !text-xs !font-semibold !text-[#242424] !shadow-sm"
              >
                {p.name}
              </Tooltip>
              <Popup>
                <div>
                  <strong>{p.name}</strong>
                  <br />
                  <span style={{ fontSize: 11, color: "#808080" }}>
                    {new Date(p.updatedAt).toLocaleTimeString("ru-RU", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      )
    }
  },
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[480px] w-full items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    ),
  },
)

export function CourierMapModal({ isOpen, onClose }: CourierMapModalProps) {
  const [positions, setPositions] = useState<CourierPosition[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void import("leaflet").then((Lmod) => {
      fixLeafletDefaultIcon(Lmod.default)
    })
  }, [])

  const fetchPositions = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const supabase = createClient()
      const { data: locations, error: locErr } = await supabase
        .from("courier_locations")
        .select("staff_id, lat, lng, updated_at")
        .eq("is_on_shift", true)

      if (locErr) {
        setError("Не удалось загрузить позиции курьеров")
        setPositions([])
        return
      }

      if (!locations?.length) {
        setPositions([])
        return
      }

      const ids = [...new Set(locations.map((l) => l.staff_id))]
      const { data: staffRows, error: staffErr } = await supabase
        .from("staff")
        .select("id, name")
        .in("id", ids)
        .eq("role", "courier")
        .eq("is_active", true)

      if (staffErr) {
        setError("Не удалось загрузить курьеров")
        setPositions([])
        return
      }

      const byId = new Map(
        (staffRows ?? []).map((s) => [s.id, s.name as string]),
      )

      const joined: CourierPosition[] = []
      for (const loc of locations) {
        const name = byId.get(loc.staff_id)
        if (!name) continue
        const lat = Number(loc.lat)
        const lng = Number(loc.lng)
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue
        joined.push({
          staffId: loc.staff_id,
          name,
          lat,
          lng,
          updatedAt:
            typeof loc.updated_at === "string"
              ? loc.updated_at
              : new Date().toISOString(),
        })
      }

      joined.sort((a, b) => a.name.localeCompare(b.name, "ru"))
      setPositions(joined)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!isOpen) {
      setPositions([])
      setError(null)
      setLoading(false)
      return
    }
    void fetchPositions()
  }, [isOpen, fetchPositions])

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent className="sm:max-w-2xl gap-0 overflow-hidden p-0">
        <DialogHeader className="flex flex-row items-center justify-between gap-3 border-b border-border px-5 py-4">
          <DialogTitle className="text-base">Курьеры на карте</DialogTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0"
            disabled={loading || !isOpen}
            onClick={() => void fetchPositions()}
          >
            {loading ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              "Обновить"
            )}
          </Button>
        </DialogHeader>

        {loading && positions.length === 0 ? (
          <div className="flex h-[480px] w-full items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="size-6 animate-spin" />
          </div>
        ) : error && positions.length === 0 ? (
          <div className="flex h-[480px] w-full items-center justify-center px-5 text-center text-sm text-destructive">
            {error}
          </div>
        ) : positions.length === 0 ? (
          <div className="flex h-[480px] w-full items-center justify-center px-5 text-center text-sm text-muted-foreground">
            Нет курьеров на смене
          </div>
        ) : (
          <CourierLeafletMap positions={positions} />
        )}
      </DialogContent>
    </Dialog>
  )
}
