import { getAdminBrandId } from "@/lib/get-admin-brand-id"
import { createClient } from "@/lib/supabase/server"
import type { DeliveryZone, DeliveryZoneSchedule } from "@/types/database"
import { DeliveryZonesTable } from "./delivery-zones-table"

export type DeliveryZoneWithSchedules = DeliveryZone & {
  delivery_zone_schedules?: DeliveryZoneSchedule[]
}

export default async function AdminDeliveryZonesPage() {
  const brandId = await getAdminBrandId()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("delivery_zones")
    .select(
      "id, name, color, polygon, delivery_price_bani, night_delivery_price_bani, min_order_bani, free_delivery_from_bani, delivery_time_min, is_active, sort_order, created_at, active_from, active_to, delivery_zone_schedules(id, from_time, to_time, delivery_time_min, delivery_price_bani, min_order_bani, free_delivery_from_bani, sort_order)",
    )
    .eq("brand_id", brandId)
    .order("sort_order", { ascending: true })

  if (error) {
    return (
      <p className="text-destructive">
        Не удалось загрузить зоны: {error.message}
      </p>
    )
  }

  const zones = (data ?? []) as DeliveryZoneWithSchedules[]

  return <DeliveryZonesTable zones={zones} />
}
