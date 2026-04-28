"use server"

import { findZoneForPoint } from "@/lib/geo"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import type { DeliveryZone } from "@/types/database"

const NOMINATIM = "https://nominatim.openstreetmap.org"
const USER_AGENT = "KitchPizza/1.0"

async function getZonesByBrandSlug(brandSlug: string): Promise<DeliveryZone[]> {
  const supabase = createServiceRoleClient()

  const { data: brand } = await supabase
    .from("brands")
    .select("id")
    .eq("slug", brandSlug)
    .maybeSingle()

  if (!brand) return []

  const { data, error } = await supabase
    .from("delivery_zones")
    .select("*")
    .eq("brand_id", (brand as { id: string }).id)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })

  if (error) return []
  return (data ?? []) as DeliveryZone[]
}

export type DeliveryZoneCheckResultPos =
  | { status: "in_zone"; zone: DeliveryZone; display_name: string }
  | { status: "out_of_zone"; display_name: string }
  | { status: "not_found" }
  | { status: "error"; message: string }

export async function checkDeliveryZoneByAddress(
  address: string,
  brandSlug: string,
): Promise<DeliveryZoneCheckResultPos> {
  const q = address.trim()
  if (!q) return { status: "not_found" }

  const url = new URL(`${NOMINATIM}/search`)
  url.searchParams.set("q", q)
  url.searchParams.set("format", "json")
  url.searchParams.set("limit", "1")
  url.searchParams.set("countrycodes", "md")
  url.searchParams.set("addressdetails", "1")

  let lat: number, lng: number, display_name: string

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
    const first = json[0]
    if (!first) return { status: "not_found" }

    lat = Number(first.lat)
    lng = Number(first.lon)
    display_name = first.display_name

    if (!Number.isFinite(lat) || !Number.isFinite(lng))
      return { status: "not_found" }
  } catch {
    return { status: "error", message: "Ошибка геокодирования" }
  }

  const zones = await getZonesByBrandSlug(brandSlug)
  const zone = findZoneForPoint(lat, lng, zones)

  if (zone) {
    return { status: "in_zone", zone, display_name }
  }

  return { status: "out_of_zone", display_name }
}
