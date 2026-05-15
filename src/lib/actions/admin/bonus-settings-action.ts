"use server"

import { revalidatePath } from "next/cache"
import {
  createClient,
  createServiceSupabaseClient,
} from "@/lib/supabase/server"

export async function updateBonusSettings(input: {
  isEnabled: boolean
  accrualPercent: number
  maxRedemptionPercent: number
}): Promise<{ ok?: true; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Не авторизован" }

  const accrual = Number(input.accrualPercent)
  const maxRed = Number(input.maxRedemptionPercent)
  if (!Number.isFinite(accrual) || accrual < 1 || accrual > 100) {
    return { error: "Некорректный процент начисления" }
  }
  if (!Number.isFinite(maxRed) || maxRed < 1 || maxRed > 100) {
    return { error: "Некорректный максимальный % списания" }
  }

  const db = createServiceSupabaseClient()
  const accrualRate = accrual / 100
  const maxRedemptionRate = maxRed / 100

  const { error } = await (db.from("bonus_settings") as any)
    .update({
      is_enabled: input.isEnabled,
      accrual_rate: accrualRate,
      max_redemption_rate: maxRedemptionRate,
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1)

  if (error) return { error: error.message }

  revalidatePath("/admin/settings/bonus")
  return { ok: true }
}
