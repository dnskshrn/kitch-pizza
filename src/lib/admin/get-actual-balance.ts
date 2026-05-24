import { createServiceRoleClient } from "@/lib/supabase/service-role"

/** Актуальный баланс бонусов: balance_after последней транзакции. */
export async function getActualBalance(profileId: string): Promise<number> {
  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from("bonus_transactions")
    .select("balance_after")
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !data) return 0
  return Number(data.balance_after)
}
