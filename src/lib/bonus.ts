import { createServiceSupabaseClient } from '@/lib/supabase/server'

const DEFAULT_BONUS_SETTINGS = {
  accrualRate: 0.05,
  maxRedemptionRate: 0.4,
  isEnabled: true,
} as const

export async function getUserBalance(profileId: string): Promise<number> {
  const supabase = createServiceSupabaseClient()
  const { data, error } = await supabase
    .from('bonus_transactions')
    .select('balance_after')
    .eq('profile_id', profileId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error || !data) return 0
  return Number(data.balance_after)
}

export async function awardWelcomeBonus(profileId: string): Promise<boolean> {
  const supabase = createServiceSupabaseClient()

  const { data: existing, error: checkError } = await supabase
    .from('bonus_transactions')
    .select('id')
    .eq('profile_id', profileId)
    .eq('type', 'welcome')
    .maybeSingle()

  if (checkError) {
    console.error('[bonus] awardWelcomeBonus check', checkError.message)
    return false
  }

  if (existing) return false

  const currentBalance = await getUserBalance(profileId)

  const { error: insertError } = await supabase.from('bonus_transactions').insert({
    profile_id: profileId,
    amount: 100,
    balance_after: currentBalance + 100,
    type: 'welcome',
    note: 'Приветственный бонус LOSOS',
    created_by: null,
  })

  if (insertError) {
    console.error('[bonus] awardWelcomeBonus insert', insertError.message)
    return false
  }

  return true
}

export async function getBonusSettings(): Promise<{
  accrualRate: number
  maxRedemptionRate: number
  isEnabled: boolean
}> {
  const supabase = createServiceSupabaseClient()
  const { data, error } = await supabase
    .from('bonus_settings')
    .select('accrual_rate, max_redemption_rate, is_enabled')
    .eq('id', 1)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (data == null) {
    return {
      accrualRate: DEFAULT_BONUS_SETTINGS.accrualRate,
      maxRedemptionRate: DEFAULT_BONUS_SETTINGS.maxRedemptionRate,
      isEnabled: DEFAULT_BONUS_SETTINGS.isEnabled,
    }
  }

  const accrualRaw = data.accrual_rate
  const maxRedRaw = data.max_redemption_rate
  const enabledRaw = data.is_enabled

  return {
    accrualRate:
      accrualRaw == null || Number.isNaN(Number(accrualRaw))
        ? DEFAULT_BONUS_SETTINGS.accrualRate
        : Number(accrualRaw),
    maxRedemptionRate:
      maxRedRaw == null || Number.isNaN(Number(maxRedRaw))
        ? DEFAULT_BONUS_SETTINGS.maxRedemptionRate
        : Number(maxRedRaw),
    // NULL в колонке не должен выключать программу (раньше Boolean(null) === false).
    isEnabled:
      enabledRaw == null ? DEFAULT_BONUS_SETTINGS.isEnabled : Boolean(enabledRaw),
  }
}

export function calculateEarned(paidAmountBani: number, accrualRate: number): number {
  return Math.floor((paidAmountBani / 100) * accrualRate)
}

export function calculateMaxRedeemable(
  orderTotalBani: number,
  balance: number,
  maxRedemptionRate: number,
): number {
  return Math.min(balance, Math.floor((orderTotalBani / 100) * maxRedemptionRate))
}

export async function accrueBonus(profileId: string, orderId: string, amount: number): Promise<void> {
  if (amount <= 0) return

  const currentBalance = await getUserBalance(profileId)
  const supabase = createServiceSupabaseClient()
  const { error } = await supabase.from('bonus_transactions').insert({
    profile_id: profileId,
    order_id: orderId,
    type: 'accrual',
    amount,
    balance_after: currentBalance + amount,
    note: 'Начисление за заказ',
    created_by: null,
  })

  if (error) throw new Error(error.message)
}

export async function redeemBonus(profileId: string, orderId: string, amount: number): Promise<void> {
  if (amount <= 0) return

  const currentBalance = await getUserBalance(profileId)
  if (currentBalance < amount) throw new Error('Недостаточно бонусов')

  const supabase = createServiceSupabaseClient()
  const { error } = await supabase.from('bonus_transactions').insert({
    profile_id: profileId,
    order_id: orderId,
    type: 'redemption',
    amount,
    balance_after: currentBalance - amount,
    note: 'Списание при оформлении заказа',
    created_by: null,
  })

  if (error) throw new Error(error.message)
}

export async function manualAdjust(
  profileId: string,
  type: 'manual_add' | 'manual_deduct',
  amount: number,
  note: string,
  createdBy: string,
): Promise<void> {
  const currentBalance = await getUserBalance(profileId)

  let balanceAfter: number
  if (type === 'manual_add') {
    balanceAfter = currentBalance + amount
  } else {
    if (currentBalance < amount) throw new Error('Недостаточно бонусов')
    balanceAfter = currentBalance - amount
  }

  const supabase = createServiceSupabaseClient()
  const { error } = await supabase.from('bonus_transactions').insert({
    profile_id: profileId,
    order_id: null,
    type,
    amount,
    balance_after: balanceAfter,
    note,
    created_by: createdBy,
  })

  if (error) throw new Error(error.message)
}

/**
 * Начисление бонусов после перевода заказа в `done`.
 * `totalBani` — итог заказа в банях (как в `orders.total` после списания бонусов).
 * Ошибки только в лог, без throw.
 */
export async function processBonusAccrualOnOrderDone(
  profileId: string,
  orderId: string,
  totalBani: number,
  multiplier: number = 1,
): Promise<void> {
  try {
    if (!profileId) return

    const supabase = createServiceSupabaseClient()

    let settings: Awaited<ReturnType<typeof getBonusSettings>>
    try {
      settings = await getBonusSettings()
    } catch (e) {
      console.error(
        "[bonus] processBonusAccrualOnOrderDone getBonusSettings",
        e instanceof Error ? e.message : e,
      )
      return
    }

    if (!settings.isEnabled) return

    const total = Number(totalBani)
    if (!Number.isFinite(total)) return

    const earnedAmount = Math.round(
      (total / 100) * settings.accrualRate * multiplier,
    )

    if (earnedAmount > 0) {
      try {
        await accrueBonus(profileId, orderId, earnedAmount)
      } catch (e) {
        console.error(
          "[bonus] processBonusAccrualOnOrderDone accrueBonus",
          e instanceof Error ? e.message : e,
        )
        return
      }
    }

    const { error: updErr } = await supabase
      .from("orders")
      .update({ bonuses_earned: earnedAmount })
      .eq("id", orderId)

    if (updErr) {
      console.error(
        "[bonus] processBonusAccrualOnOrderDone update bonuses_earned",
        updErr.message,
      )
    }
  } catch (e) {
    console.error(
      "[bonus] processBonusAccrualOnOrderDone",
      e instanceof Error ? e.message : e,
    )
  }
}
