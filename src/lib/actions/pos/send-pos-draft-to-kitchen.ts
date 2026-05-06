"use server"

import { getCurrentStaff } from "@/lib/actions/pos/auth"
import { createServiceRoleClient } from "@/lib/supabase/service-role"

export type SendPosDraftToKitchenInput = {
  orderId: string
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

  const nowIso = new Date().toISOString()

  const { data: updated, error: updateError } = await supabase
    .from("orders")
    .update({
      status: "cooking",
      cooking_started_at: nowIso,
      updated_at: nowIso,
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

  return { success: true, orderNumber }
}
