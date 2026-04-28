import { getAdminBrandId } from "@/lib/get-admin-brand-id"
import { createClient } from "@/lib/supabase/server"
import type { Promotion } from "@/types/database"
import { PromotionsTable } from "./promotions-table"

export default async function AdminPromotionsPage() {
  const brandId = await getAdminBrandId()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("promotions")
    .select("*")
    .eq("brand_id", brandId)
    .order("sort_order", { ascending: true })

  if (error) {
    return (
      <p className="text-destructive">
        Не удалось загрузить акции: {error.message}
      </p>
    )
  }

  const promotions = (data ?? []) as Promotion[]

  return <PromotionsTable promotions={promotions} />
}
