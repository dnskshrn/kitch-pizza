"use server"

import { formatStreetLineFromNominatim } from "@/lib/nominatim-format-street"
import { findZoneForPoint } from "@/lib/geo"
import { getBrandId } from "@/lib/get-brand-id"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import type { DeliveryZone } from "@/types/database"

const NOMINATIM = "https://nominatim.openstreetmap.org"
const USER_AGENT = "KitchPizza/1.0"

type NominatimSearchHit = {
  lat: string
  lon: string
  display_name: string
  address?: Record<string, string>
}

function zonesViewbox(zones: DeliveryZone[] | undefined): string | null {
  const points = (zones ?? [])
    .flatMap((zone) => (Array.isArray(zone.polygon) ? zone.polygon : []))
    .filter(
      (point): point is [number, number] =>
        Array.isArray(point) &&
        point.length >= 2 &&
        Number.isFinite(Number(point[0])) &&
        Number.isFinite(Number(point[1])),
    )

  if (!points.length) return null

  const lats = points.map((point) => Number(point[0]))
  const lngs = points.map((point) => Number(point[1]))
  const pad = 0.01
  const minLat = Math.min(...lats) - pad
  const maxLat = Math.max(...lats) + pad
  const minLng = Math.min(...lngs) - pad
  const maxLng = Math.max(...lngs) + pad

  return `${minLng},${maxLat},${maxLng},${minLat}`
}

export async function getActiveDeliveryZones(): Promise<DeliveryZone[]> {
  const brandId = await getBrandId()
  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from("delivery_zones")
    .select("*")
    .eq("brand_id", brandId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })

  if (error) {
    console.error("[getActiveDeliveryZones]", error.message)
    return []
  }

  return (data ?? []) as DeliveryZone[]
}

export async function geocodeAddress(
  query: string,
  zones?: DeliveryZone[],
): Promise<{ lat: number; lng: number; display_name: string } | null> {
  const q = query.trim()
  if (!q) return null
  const activeZones = (zones ?? []).filter((zone) => zone.is_active)
  const viewbox = zonesViewbox(activeZones)

  const url = new URL(`${NOMINATIM}/search`)
  url.searchParams.set("q", q)
  url.searchParams.set("format", "json")
  url.searchParams.set("limit", viewbox ? "5" : "1")
  url.searchParams.set("countrycodes", "md")
  url.searchParams.set("addressdetails", "1")
  if (viewbox) {
    url.searchParams.set("viewbox", viewbox)
    url.searchParams.set("bounded", "1")
  }

  const res = await fetch(url.toString(), {
    headers: { "User-Agent": USER_AGENT },
    next: { revalidate: 0 },
  })

  if (!res.ok) return null
  const json = (await res.json()) as NominatimSearchHit[]
  const candidates = json
    .map((hit) => {
      const lat = Number(hit.lat)
      const lng = Number(hit.lon)
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
      return {
        lat,
        lng,
        display_name: formatStreetLineFromNominatim(
          hit.address,
          hit.display_name,
        ),
      }
    })
    .filter(
      (
        hit,
      ): hit is {
        lat: number
        lng: number
        display_name: string
      } => hit != null,
    )

  const first =
    activeZones.length > 0
      ? (candidates.find((hit) =>
          findZoneForPoint(hit.lat, hit.lng, activeZones),
        ) ?? candidates[0])
      : candidates[0]

  if (!first) return null

  return {
    lat: first.lat,
    lng: first.lng,
    display_name: first.display_name,
  }
}

export async function reverseGeocode(
  lat: number,
  lng: number,
): Promise<{ display_name: string } | null> {
  const url = new URL(`${NOMINATIM}/reverse`)
  url.searchParams.set("lat", String(lat))
  url.searchParams.set("lon", String(lng))
  url.searchParams.set("format", "json")
  url.searchParams.set("addressdetails", "1")

  const res = await fetch(url.toString(), {
    headers: { "User-Agent": USER_AGENT },
    next: { revalidate: 0 },
  })

  if (!res.ok) return null
  const json = (await res.json()) as {
    display_name?: string
    address?: Record<string, string>
  }
  if (!json.display_name) return null
  return {
    display_name: formatStreetLineFromNominatim(json.address, json.display_name),
  }
}
