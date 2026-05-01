"use server"

import { getAdminBrandId } from "@/lib/get-admin-brand-id"
import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export type DeliveryZoneInput = {
  name: string
  color: string
  polygon: [number, number][]
  delivery_price_bani: number
  min_order_bani: number
  free_delivery_from_bani: number | null
  delivery_time_min: number
  is_active: boolean
  sort_order: number
}

function normalizeHexColor(color: string): string {
  const value = color.trim()
  if (/^#[0-9a-fA-F]{6}$/.test(value)) return value
  throw new Error("Укажите цвет зоны в формате HEX, например #5F7600")
}

export async function createDeliveryZone(data: DeliveryZoneInput) {
  const brandId = await getAdminBrandId()
  const supabase = await createClient()
  const color = normalizeHexColor(data.color)
  const { error } = await supabase.from("delivery_zones").insert({
    brand_id: brandId,
    name: data.name,
    color,
    polygon: data.polygon,
    delivery_price_bani: data.delivery_price_bani,
    min_order_bani: data.min_order_bani,
    free_delivery_from_bani: data.free_delivery_from_bani,
    delivery_time_min: data.delivery_time_min,
    is_active: data.is_active,
    sort_order: data.sort_order,
  })
  if (error) throw new Error(error.message)
  revalidatePath("/admin/delivery-zones")
}

export async function updateDeliveryZone(id: string, data: DeliveryZoneInput) {
  const brandId = await getAdminBrandId()
  const supabase = await createClient()
  const color = normalizeHexColor(data.color)
  const { error } = await supabase
    .from("delivery_zones")
    .update({
      name: data.name,
      color,
      polygon: data.polygon,
      delivery_price_bani: data.delivery_price_bani,
      min_order_bani: data.min_order_bani,
      free_delivery_from_bani: data.free_delivery_from_bani,
      delivery_time_min: data.delivery_time_min,
      is_active: data.is_active,
      sort_order: data.sort_order,
    })
    .eq("id", id)
    .eq("brand_id", brandId)
  if (error) throw new Error(error.message)
  revalidatePath("/admin/delivery-zones")
}

export async function deleteDeliveryZone(id: string) {
  const brandId = await getAdminBrandId()
  const supabase = await createClient()
  const { error } = await supabase
    .from("delivery_zones")
    .delete()
    .eq("id", id)
    .eq("brand_id", brandId)
  if (error) throw new Error(error.message)
  revalidatePath("/admin/delivery-zones")
}
