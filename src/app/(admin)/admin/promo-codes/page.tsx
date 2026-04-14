import { createClient } from "@/lib/supabase/server"
import type { PromoCode } from "@/types/database"
import { PromoCodesTable } from "./promo-codes-table"

export default async function AdminPromoCodesPage() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("promo_codes")
    .select("*")
    .order("created_at", { ascending: false })

  if (error) {
    return (
      <p className="text-destructive">
        Не удалось загрузить промокоды: {error.message}
      </p>
    )
  }

  const rows = (data ?? []) as PromoCode[]

  return <PromoCodesTable promoCodes={rows} />
}
