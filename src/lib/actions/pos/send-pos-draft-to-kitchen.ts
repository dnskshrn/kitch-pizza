"use server"

import { getCurrentStaff } from "@/lib/actions/pos/auth"
import { redeemBonus } from "@/lib/bonus"
import { createServiceRoleClient } from "@/lib/supabase/service-role"

export type SendPosDraftToKitchenInput = {
  orderId: string
  /**
   * Сумма списания в MDL (как в форме POS); на сервере переводится в целые пункты:
   * 1 п. = 1 MDL = 100 бан, как на витрине (`bonusesRedeemed * 100`).
   */
  bonusesToRedeem?: number
  /** Профиль для redeemBonus; если не передан — берётся orders.profile_id */
  profileId?: string | null
}

export type SendPosDraftToKitchenResult =
  | { success: true; orderNumber: number }
  | { success: false; error: string }

export async function sendPosDraftToKitchen(
  input: SendPosDraftToKitchenInput,
): Promise<SendPosDraftToKitchenResult> {
  const staff = await getCurrentStaff()
  if (!staff) {
    return { success: false, error: "Сессия кассира недействительна" }
  }

  let supabase
  try {
    supabase = createServiceRoleClient()
  } catch {
    return { success: false, error: "Сервер временно недоступен" }
  }

  const { data: itemProbe, error: itemsError } = await supabase
    .from("order_items")
    .select("id")
    .eq("order_id", input.orderId)
    .limit(1)

  if (itemsError) {
    console.error("[sendPosDraftToKitchen] items", itemsError.message)
    return { success: false, error: "Не удалось проверить состав заказа" }
  }

  if (!itemProbe?.length) {
    return { success: false, error: "Добавьте позиции в заказ" }
  }

  const { data: orderBefore, error: orderLoadError } = await supabase
    .from("orders")
    .select("total, profile_id")
    .eq("id", input.orderId)
    .eq("status", "draft")
    .maybeSingle()

  if (orderLoadError || !orderBefore) {
    console.error("[sendPosDraftToKitchen] load order", orderLoadError?.message)
    return { success: false, error: "Черновик уже отправлен или недоступен" }
  }

  const totalBani = Math.max(0, Math.round((orderBefore as { total: number }).total ?? 0))
  const rawMdl = Math.max(0, Number(input.bonusesToRedeem ?? 0))
  const redeemBani = Math.round(rawMdl * 100)
  const maxPointsFromTotal = Math.floor(totalBani / 100)
  const redeemPoints = Math.min(Math.floor(redeemBani / 100), maxPointsFromTotal)
  const appliedBani = redeemPoints * 100
  const newTotalBani = Math.max(0, totalBani - appliedBani)

  const profileIdForRedeem =
    typeof input.profileId === "string" && input.profileId.trim()
      ? input.profileId.trim()
      : (orderBefore as { profile_id: string | null }).profile_id?.trim() || null

  const nowIso = new Date().toISOString()

  const { data: updated, error: updateError } = await supabase
    .from("orders")
    .update({
      status: "cooking",
      cooking_started_at: nowIso,
      updated_at: nowIso,
      total: newTotalBani,
      bonuses_redeemed: redeemPoints,
    })
    .eq("id", input.orderId)
    .eq("status", "draft")
    .select("order_number")
    .maybeSingle()

  if (updateError) {
    console.error("[sendPosDraftToKitchen] update", updateError.message)
    return { success: false, error: "Не удалось отправить заказ на кухню" }
  }

  if (!updated) {
    return {
      success: false,
      error: "Черновик уже отправлен или недоступен",
    }
  }

  const orderNumber = Number((updated as { order_number: number }).order_number)

  if (redeemPoints > 0) {
    if (profileIdForRedeem) {
      try {
        await redeemBonus(profileIdForRedeem, input.orderId, redeemPoints)
      } catch (e) {
        console.error(
          "[sendPosDraftToKitchen] redeemBonus",
          e instanceof Error ? e.message : e,
        )
      }
    } else {
      console.error(
        "[sendPosDraftToKitchen] redeemBonus skipped: no profile_id for order",
        input.orderId,
      )
    }
  }

  return { success: true, orderNumber }
}
