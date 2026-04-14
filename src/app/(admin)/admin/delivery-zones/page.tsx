import { createClient } from "@/lib/supabase/server"
import type { DeliveryZone } from "@/types/database"
import { DeliveryZonesTable } from "./delivery-zones-table"

export default async function AdminDeliveryZonesPage() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("delivery_zones")
    .select("*")
    .order("sort_order", { ascending: true })

  if (error) {
    return (
      <p className="text-destructive">
        Не удалось загрузить зоны: {error.message}
      </p>
    )
  }

  const zones = (data ?? []) as DeliveryZone[]

  return <DeliveryZonesTable zones={zones} />
}
