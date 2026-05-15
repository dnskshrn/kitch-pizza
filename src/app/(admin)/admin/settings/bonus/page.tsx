import { createServiceSupabaseClient } from "@/lib/supabase/server"
import {
  BonusSettingsForm,
  type BonusSettingsFormInitial,
} from "./bonus-settings-form"

export const dynamic = "force-dynamic"

const DEFAULT_INITIAL: BonusSettingsFormInitial = {
  isEnabled: true,
  accrualPercent: 5,
  maxRedemptionPercent: 40,
}

export default async function AdminBonusSettingsPage() {
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

  const { data, error } = await supabase
    .from("bonus_settings")
    .select("is_enabled, accrual_rate, max_redemption_rate")
    .eq("id", 1)
    .maybeSingle()

  if (error) {
    return (
      <p className="text-destructive">
        Не удалось загрузить настройки: {error.message}
      </p>
    )
  }

  let initial: BonusSettingsFormInitial = DEFAULT_INITIAL
  if (data != null) {
    const accrRaw = data.accrual_rate
    const maxRaw = data.max_redemption_rate
    const enabledRaw = data.is_enabled
    initial = {
      isEnabled:
        enabledRaw == null ? DEFAULT_INITIAL.isEnabled : Boolean(enabledRaw),
      accrualPercent:
        accrRaw == null || Number.isNaN(Number(accrRaw))
          ? DEFAULT_INITIAL.accrualPercent
          : Number(accrRaw) * 100,
      maxRedemptionPercent:
        maxRaw == null || Number.isNaN(Number(maxRaw))
          ? DEFAULT_INITIAL.maxRedemptionPercent
          : Number(maxRaw) * 100,
    }
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Программа лояльности</h1>
      <BonusSettingsForm initial={initial} />
    </div>
  )
}
