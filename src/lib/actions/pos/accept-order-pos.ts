"use server"

import { getCurrentStaff } from "@/lib/actions/pos/auth"
import { createServiceRoleClient } from "@/lib/supabase/service-role"

export type AcceptOrderPosInput = {
  orderId: string
}

export type AcceptOrderPosResult =
  | { success: true }
  | { success: false; error: string }

/** Принятие входящего заказа с сайта: переход из `new` в `confirmed`. */
export async function acceptOrderPos(
  input: AcceptOrderPosInput,
): Promise<AcceptOrderPosResult> {
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
    .select("id, status, source")
    .eq("id", input.orderId)
    .maybeSingle()

  if (loadError || !row) {
    console.error("[acceptOrderPos] load", loadError?.message)
    return { success: false, error: "Заказ не найден" }
  }

  const { status, source } = row as {
    status: string
    source: string | null
  }

  if (source !== "website") {
    return { success: false, error: "Принимать можно только заказы с сайта" }
  }
  if (status !== "new") {
    return {
      success: false,
      error: "Заказ уже обработан или не в статусе «Новый»",
    }
  }

  const updatedAt = new Date().toISOString()
  const { error: updError } = await supabase
    .from("orders")
    .update({
      status: "confirmed",
      updated_at: updatedAt,
    })
    .eq("id", input.orderId)

  if (updError) {
    console.error("[acceptOrderPos] update", updError.message)
    return { success: false, error: "Не удалось принять заказ" }
  }

  return { success: true }
}
