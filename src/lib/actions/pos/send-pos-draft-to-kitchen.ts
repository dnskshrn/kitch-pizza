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

const SENDABLE_POS_STATUSES = ["draft", "new", "confirmed"] as const

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
    .select("status, total, profile_id, bonuses_redeemed, order_number")
    .eq("id", input.orderId)
    .maybeSingle()

  if (orderLoadError || !orderBefore) {
    console.error("[sendPosDraftToKitchen] load order", orderLoadError?.message)
    return { success: false, error: "Заказ недоступен" }
  }

  const orderStatus = String((orderBefore as { status: string }).status)
  if (orderStatus === "cooking") {
    return {
      success: true,
      orderNumber: Number((orderBefore as { order_number: number }).order_number),
    }
  }

  if (!SENDABLE_POS_STATUSES.includes(orderStatus as (typeof SENDABLE_POS_STATUSES)[number])) {
    return { success: false, error: "Заказ уже отправлен или недоступен" }
  }

  const storedTotalBani = Math.max(
    0,
    Math.round((orderBefore as { total: number }).total ?? 0),
  )
  const existingPtsRaw = (orderBefore as { bonuses_redeemed: unknown })
    .bonuses_redeemed
  const existingBonusPts =
    typeof existingPtsRaw === "number" && Number.isFinite(existingPtsRaw)
      ? Math.max(0, Math.floor(existingPtsRaw))
      : Math.max(0, Math.floor(Number(existingPtsRaw) || 0))
  /** `orders.total` — нетто; восстанавливаем сумму до списания, чтобы не вычитать бонусы дважды. */
  const grossBeforeRedeemBani = storedTotalBani + existingBonusPts * 100

  const rawMdl = Math.max(0, Number(input.bonusesToRedeem ?? 0))
  const redeemBani = Math.round(rawMdl * 100)
  const maxPointsFromGross = Math.floor(grossBeforeRedeemBani / 100)
  const redeemPoints = Math.min(Math.floor(redeemBani / 100), maxPointsFromGross)
  const appliedBani = redeemPoints * 100
  const newTotalBani = Math.max(0, grossBeforeRedeemBani - appliedBani)

  const profileIdForRedeem =
    typeof input.profileId === "string" && input.profileId.trim()
      ? input.profileId.trim()
      : (orderBefore as { profile_id: string | null }).profile_id?.trim() || null

  const nowIso = new Date().toISOString()

  if (redeemPoints > 0) {
    if (profileIdForRedeem) {
      const { data: freshOrder } = await supabase
        .from("orders")
        .select("status, bonuses_redeemed, profile_id")
        .eq("id", input.orderId)
        .maybeSingle()

      const freshStatus = freshOrder
        ? String((freshOrder as { status: string }).status)
        : orderStatus

      if (
        !SENDABLE_POS_STATUSES.includes(
          freshStatus as (typeof SENDABLE_POS_STATUSES)[number],
        )
      ) {
        console.warn(
          `[sendPosDraftToKitchen] Order ${input.orderId} is ${freshStatus}, skipping redeem`,
        )
      } else {
        try {
          await redeemBonus(profileIdForRedeem, input.orderId, redeemPoints)
        } catch (e) {
          console.error(
            "[sendPosDraftToKitchen] redeemBonus",
            e instanceof Error ? e.message : e,
          )
        }
      }
    } else {
      console.error(
        "[sendPosDraftToKitchen] redeemBonus skipped: no profile_id for order",
        input.orderId,
      )
    }
  }

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
    .in("status", [...SENDABLE_POS_STATUSES])
    .select("order_number")
    .maybeSingle()

  if (updateError) {
    console.error("[sendPosDraftToKitchen] update", updateError.message)
    return { success: false, error: "Не удалось отправить заказ на кухню" }
  }

  if (!updated) {
    const { data: currentOrder } = await supabase
      .from("orders")
      .select("status, order_number")
      .eq("id", input.orderId)
      .maybeSingle()
    const current = currentOrder as
      | { status: string; order_number: number }
      | null
    if (current?.status === "cooking") {
      return { success: true, orderNumber: Number(current.order_number) }
    }
    return {
      success: false,
      error: "Заказ уже отправлен или недоступен",
    }
  }

  const orderNumber = Number((updated as { order_number: number }).order_number)

  return { success: true, orderNumber }
}
