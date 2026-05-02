"use server"

import { getCurrentStaff } from "@/lib/actions/pos/auth"
import { createServiceRoleClient } from "@/lib/supabase/service-role"

export type RejectOrderPosInput = {
  orderId: string
  reason: string
}

export type RejectOrderPosResult =
  | { success: true }
  | { success: false; error: string }

export async function rejectOrderPos(
  input: RejectOrderPosInput,
): Promise<RejectOrderPosResult> {
  const staff = await getCurrentStaff()
  if (!staff) {
    return { success: false, error: "Сессия кассира недействительна" }
  }

  const reason = input.reason.trim()
  if (!reason) {
    return { success: false, error: "Укажите причину отклонения" }
  }

  let supabase
  try {
    supabase = createServiceRoleClient()
  } catch {
    return { success: false, error: "Сервер временно недоступен" }
  }

  const { data: row, error: loadError } = await supabase
    .from("orders")
    .select("id, status, source")
    .eq("id", input.orderId)
    .maybeSingle()

  if (loadError || !row) {
    console.error("[rejectOrderPos] load", loadError?.message)
    return { success: false, error: "Заказ не найден" }
  }

  const { status, source } = row as {
    status: string
    source: string | null
  }

  if (source !== "website") {
    return {
      success: false,
      error: "Отклонять можно только заказы с сайта",
    }
  }
  if (status !== "new") {
    return {
      success: false,
      error: "Можно отклонить только заказ в статусе «Новый»",
    }
  }

  const updatedAt = new Date().toISOString()
  const { error: updError } = await supabase
    .from("orders")
    .update({
      status: "rejected",
      cancel_reason: reason,
      updated_at: updatedAt,
    })
    .eq("id", input.orderId)

  if (updError) {
    console.error("[rejectOrderPos] update", updError.message)
    return { success: false, error: "Не удалось отклонить заказ" }
  }

  return { success: true }
}
