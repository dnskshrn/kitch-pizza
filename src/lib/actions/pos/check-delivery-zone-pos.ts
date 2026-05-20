"use server"

import {
  attachResolvedZoneParams,
  isZoneAvailableNow,
  type DeliveryZoneWithResolvedParams,
  type ResolvedZoneParams,
} from "@/lib/delivery-zone-schedule"
import { findZoneForPoint } from "@/lib/geo"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import type { DeliveryZone, DeliveryZoneSchedule } from "@/types/database"

type DeliveryZoneWithSchedulesRelation = DeliveryZone & {
  delivery_zone_schedules?: DeliveryZoneSchedule[]
}

const NOMINATIM = "https://nominatim.openstreetmap.org"
const USER_AGENT = "KitchPizza/1.0"

const DELIVERY_ZONE_SELECT =
  "id, name, color, polygon, delivery_price_bani, night_delivery_price_bani, min_order_bani, free_delivery_from_bani, delivery_time_min, is_active, sort_order, created_at, active_from, active_to, delivery_zone_schedules(id, from_time, to_time, delivery_time_min, delivery_price_bani, min_order_bani, free_delivery_from_bani, sort_order)"

function zonesViewbox(zones: DeliveryZone[]): string | null {
  const points = zones
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

async function getZonesByBrandSlug(
  brandSlug: string,
): Promise<DeliveryZoneWithResolvedParams[]> {
  const supabase = createServiceRoleClient()

  const { data: brand } = await supabase
    .from("brands")
    .select("id")
    .eq("slug", brandSlug)
    .maybeSingle()

  if (!brand) return []

  const { data, error } = await supabase
    .from("delivery_zones")
    .select(DELIVERY_ZONE_SELECT)
    .eq("brand_id", (brand as { id: string }).id)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })

  if (error) return []
  const zones = (data ?? []) as DeliveryZoneWithSchedulesRelation[]
  return zones
    .filter((z) => isZoneAvailableNow(z.delivery_zone_schedules ?? []))
    .map(attachResolvedZoneParams)
}

export type DeliveryZoneCheckResultPos =
  | {
      status: "in_zone"
      zone: DeliveryZoneWithResolvedParams
      resolvedParams: ResolvedZoneParams
      display_name: string
      lat: number
      lng: number
    }
  | {
      status: "out_of_zone"
      display_name: string
      lat: number
      lng: number
    }
  | { status: "not_found" }
  | { status: "error"; message: string }

export async function checkDeliveryZoneByAddress(
  address: string,
  brandSlug: string,
): Promise<DeliveryZoneCheckResultPos> {
  const q = address.trim()
  if (!q) return { status: "not_found" }

  const zones = await getZonesByBrandSlug(brandSlug)
  const viewbox = zonesViewbox(zones)

  const url = new URL(`${NOMINATIM}/search`)
  url.searchParams.set("q", q)
  url.searchParams.set("format", "json")
  url.searchParams.set("limit", "5")
  url.searchParams.set("countrycodes", "md")
  url.searchParams.set("addressdetails", "1")
  if (viewbox) {
    url.searchParams.set("viewbox", viewbox)
    url.searchParams.set("bounded", "1")
  }

  let candidates: Array<{ lat: number; lng: number; display_name: string }>

  try {
    const res = await fetch(url.toString(), {
      headers: { "User-Agent": USER_AGENT },
      next: { revalidate: 0 },
    })
    if (!res.ok) return { status: "error", message: "Ошибка геокодирования" }

    const json = (await res.json()) as Array<{
      lat: string
      lon: string
      display_name: string
    }>
    candidates = json
      .map((item) => ({
        lat: Number(item.lat),
        lng: Number(item.lon),
        display_name: item.display_name,
      }))
      .filter(
        (item) =>
          Number.isFinite(item.lat) &&
          Number.isFinite(item.lng) &&
          Boolean(item.display_name),
      )
    if (!candidates.length) return { status: "not_found" }
  } catch {
    return { status: "error", message: "Ошибка геокодирования" }
  }

  for (const candidate of candidates) {
    const hit = findZoneForPoint(candidate.lat, candidate.lng, zones)
    if (hit) {
      const zone = attachResolvedZoneParams(hit)
      return {
        status: "in_zone",
        zone,
        resolvedParams: zone.resolvedParams,
        display_name: candidate.display_name,
        lat: candidate.lat,
        lng: candidate.lng,
      }
    }
  }

  const first = candidates[0]

  return {
    status: "out_of_zone",
    display_name: first.display_name,
    lat: first.lat,
    lng: first.lng,
  }
}
