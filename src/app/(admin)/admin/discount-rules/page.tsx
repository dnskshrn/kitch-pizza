import { createServiceSupabaseClient } from "@/lib/supabase/server"
import { getBrands } from "@/lib/actions/get-brands"
import type { DiscountRule } from "@/types/promotions"
import { PromotionsClient } from "./promotions-client"

export const dynamic = "force-dynamic"

export default async function AdminDiscountRulesPage() {
  let supabase: ReturnType<typeof createServiceSupabaseClient>
  try {
    supabase = createServiceSupabaseClient()
  } catch (e) {
    return (
      <p className="text-destructive">
        Не удалось подключиться к базе:{" "}
        {e instanceof Error ? e.message : "ошибка конфигурации"}
      </p>
    )
  }

  const [{ data, error }, brands] = await Promise.all([
    (supabase.from("discount_rules") as any)
      .select("*")
      .order("brand_id", { ascending: true })
      .order("priority", { ascending: false }),
    getBrands().catch(() => [] as { id: string; slug: string; name: string }[]),
  ])

  if (error) {
    return (
      <p className="text-destructive">
        Не удалось загрузить правила: {error.message}
      </p>
    )
  }

  const rules = (data ?? []) as DiscountRule[]

  return <PromotionsClient rules={rules} brands={brands} />
}
