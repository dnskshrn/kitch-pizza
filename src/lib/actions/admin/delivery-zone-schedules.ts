"use server"

import { getAdminBrandId } from "@/lib/get-admin-brand-id"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { revalidatePath } from "next/cache"

export type DeliveryZoneScheduleInput = {
  from_time: string
  to_time: string
  delivery_time_min: number
  delivery_price_bani: number
  min_order_bani: number
  free_delivery_from_bani: number | null
  sort_order?: number
}

function normalizeTimeForDb(value: string): string {
  const trimmed = value.trim()
  if (/^\d{2}:\d{2}:\d{2}$/.test(trimmed)) return trimmed
  if (/^\d{2}:\d{2}$/.test(trimmed)) return `${trimmed}:00`
  throw new Error("Некорректное время")
}

async function assertZoneOwnedByAdminBrand(zoneId: string): Promise<void> {
  const brandId = await getAdminBrandId()
  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from("delivery_zones")
    .select("id")
    .eq("id", zoneId)
    .eq("brand_id", brandId)
    .maybeSingle()

  if (error || !data) {
    throw new Error("Зона не найдена")
  }
}

async function assertScheduleOwnedByAdminBrand(scheduleId: string): Promise<void> {
  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from("delivery_zone_schedules")
    .select("zone_id")
    .eq("id", scheduleId)
    .maybeSingle()

  if (error || !data) {
    throw new Error("Слот расписания не найден")
  }

  await assertZoneOwnedByAdminBrand((data as { zone_id: string }).zone_id)
}

async function nextSortOrder(zoneId: string): Promise<number> {
  const supabase = createServiceRoleClient()
  const { data } = await supabase
    .from("delivery_zone_schedules")
    .select("sort_order")
    .eq("zone_id", zoneId)
    .order("sort_order", { ascending: false })
    .limit(1)

  const last = (data?.[0] as { sort_order: number } | undefined)?.sort_order
  return (last ?? -1) + 1
}

export async function createSchedule(
  zoneId: string,
  data: DeliveryZoneScheduleInput,
): Promise<void> {
  await assertZoneOwnedByAdminBrand(zoneId)
  const supabase = createServiceRoleClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from("delivery_zone_schedules") as any).insert({
    zone_id: zoneId,
    from_time: normalizeTimeForDb(data.from_time),
    to_time: normalizeTimeForDb(data.to_time),
    delivery_time_min: data.delivery_time_min,
    delivery_price_bani: data.delivery_price_bani,
    min_order_bani: data.min_order_bani,
    free_delivery_from_bani: data.free_delivery_from_bani,
    sort_order: data.sort_order ?? (await nextSortOrder(zoneId)),
  })

  if (error) throw new Error(error.message)
  revalidatePath("/admin/delivery-zones")
}

export async function updateSchedule(
  id: string,
  data: DeliveryZoneScheduleInput,
): Promise<void> {
  await assertScheduleOwnedByAdminBrand(id)
  const supabase = createServiceRoleClient()
  const patch: Record<string, unknown> = {
    from_time: normalizeTimeForDb(data.from_time),
    to_time: normalizeTimeForDb(data.to_time),
    delivery_time_min: data.delivery_time_min,
    delivery_price_bani: data.delivery_price_bani,
    min_order_bani: data.min_order_bani,
    free_delivery_from_bani: data.free_delivery_from_bani,
  }
  if (data.sort_order != null) {
    patch.sort_order = data.sort_order
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from("delivery_zone_schedules") as any)
    .update(patch)
    .eq("id", id)

  if (error) throw new Error(error.message)
  revalidatePath("/admin/delivery-zones")
}

export async function deleteSchedule(id: string): Promise<void> {
  await assertScheduleOwnedByAdminBrand(id)
  const supabase = createServiceRoleClient()
  const { error } = await supabase
    .from("delivery_zone_schedules")
    .delete()
    .eq("id", id)

  if (error) throw new Error(error.message)
  revalidatePath("/admin/delivery-zones")
}
