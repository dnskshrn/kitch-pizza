"use server"

import { getCurrentStaff } from "@/lib/actions/pos/auth"
import { createServiceRoleClient } from "@/lib/supabase/service-role"

export type CancelOrderPosInput = {
  orderId: string
  reason: string
}

export type CancelOrderPosResult =
  | { success: true }
  | { success: false; error: string }

export async function cancelOrderPos(
  input: CancelOrderPosInput,
): Promise<CancelOrderPosResult> {
  const staff = await getCurrentStaff()
  if (!staff) {
    return { success: false, error: "Сессия кассира недействительна" }
  }

  const reason = input.reason.trim()
  if (!reason) {
    return { success: false, error: "Укажите причину отмены" }
  }

  let supabase
  try {
    supabase = createServiceRoleClient()
  } catch {
    return { success: false, error: "Сервер временно недоступен" }
  }

  const { data: row, error: loadError } = await supabase
    .from("orders")
    .select("id, status")
    .eq("id", input.orderId)
    .maybeSingle()

  if (loadError || !row) {
    console.error("[cancelOrderPos] load", loadError?.message)
    return { success: false, error: "Заказ не найден" }
  }

  const status = (row as { status: string }).status
  const terminalDelivered = status === "done"
  const alreadyClosed =
    status === "cancelled" || status === "rejected"

  if (terminalDelivered) {
    return {
      success: false,
      error: "Нельзя отменить заказ после выдачи",
    }
  }
  if (alreadyClosed) {
    return {
      success: false,
      error: "Заказ уже отменён или отклонён",
    }
  }

  const updatedAt = new Date().toISOString()
  const { error: updError } = await supabase
    .from("orders")
    .update({
      status: "cancelled",
      cancel_reason: reason,
      updated_at: updatedAt,
    })
    .eq("id", input.orderId)

  if (updError) {
    console.error("[cancelOrderPos] update", updError.message)
    return { success: false, error: "Не удалось отменить заказ" }
  }

  return { success: true }
}
