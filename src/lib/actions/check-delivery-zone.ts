"use server"

import { formatStreetLineFromNominatim } from "@/lib/nominatim-format-street"
import { getBrandId } from "@/lib/get-brand-id"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import type { DeliveryZone } from "@/types/database"

const NOMINATIM = "https://nominatim.openstreetmap.org"
const USER_AGENT = "KitchPizza/1.0"

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
): Promise<{ lat: number; lng: number; display_name: string } | null> {
  const q = query.trim()
  if (!q) return null

  const url = new URL(`${NOMINATIM}/search`)
  url.searchParams.set("q", q)
  url.searchParams.set("format", "json")
  url.searchParams.set("limit", "1")
  url.searchParams.set("countrycodes", "md")
  url.searchParams.set("addressdetails", "1")

  const res = await fetch(url.toString(), {
    headers: { "User-Agent": USER_AGENT },
    next: { revalidate: 0 },
  })

  if (!res.ok) return null
  const json = (await res.json()) as Array<{
    lat: string
    lon: string
    display_name: string
    address?: Record<string, string>
  }>
  const first = json[0]
  if (!first) return null

  const lat = Number(first.lat)
  const lng = Number(first.lon)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null

  const display_name = formatStreetLineFromNominatim(
    first.address,
    first.display_name,
  )

  return {
    lat,
    lng,
    display_name,
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
