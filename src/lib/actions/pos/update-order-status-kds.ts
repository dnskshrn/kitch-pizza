"use server"

import { getCurrentStaff } from "@/lib/actions/pos/auth"
import { createServiceRoleClient } from "@/lib/supabase/service-role"

export type UpdateOrderStatusKdsResult =
  | { success: true }
  | { success: false; error: string }

/** KDS: перевод заказа из «готовится» в «готов». */
export async function updateOrderStatusKds(
  orderId: string,
): Promise<UpdateOrderStatusKdsResult> {
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

  const { data: row, error: loadError } = await supabase
    .from("orders")
    .select("id, status")
    .eq("id", orderId)
    .maybeSingle()

  if (loadError || !row) {
    console.error("[updateOrderStatusKds] load", loadError?.message)
    return { success: false, error: "Заказ не найден" }
  }

  const status = (row as { status: string }).status
  if (status !== "cooking") {
    return {
      success: false,
      error: "Заказ не в статусе «Готовится»",
    }
  }

  const updatedAt = new Date().toISOString()
  const { error: updError } = await supabase
    .from("orders")
    .update({
      status: "ready",
      updated_at: updatedAt,
    })
    .eq("id", orderId)
    .eq("status", "cooking")

  if (updError) {
    console.error("[updateOrderStatusKds] update", updError.message)
    return { success: false, error: "Не удалось обновить статус" }
  }

  return { success: true }
}
