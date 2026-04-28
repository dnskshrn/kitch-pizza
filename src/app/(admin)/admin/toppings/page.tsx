import { getAdminBrandId } from "@/lib/get-admin-brand-id"
import { createClient } from "@/lib/supabase/server"
import type { Topping, ToppingGroup } from "@/types/database"
import { ToppingsClient } from "./toppings-client"

export default async function AdminToppingsPage() {
  const brandId = await getAdminBrandId()
  const supabase = await createClient()

  const { data: groups, error: gErr } = await supabase
    .from("topping_groups")
    .select("*")
    .eq("brand_id", brandId)
    .order("sort_order", { ascending: true })

  const { data: toppings, error: tErr } = await supabase
    .from("toppings")
    .select("*")
    .eq("brand_id", brandId)
    .order("sort_order", { ascending: true })

  if (gErr || tErr) {
    return (
      <p className="text-destructive">
        Не удалось загрузить данные: {gErr?.message ?? tErr?.message}
      </p>
    )
  }

  return (
    <ToppingsClient
      groups={(groups ?? []) as ToppingGroup[]}
      toppings={(toppings ?? []) as Topping[]}
    />
  )
}
