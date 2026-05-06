"use server"

import { getCurrentStaff } from "@/lib/actions/pos/auth"
import { createServiceRoleClient } from "@/lib/supabase/service-role"

export type DeletePosDraftOrderResult =
  | { success: true }
  | { success: false; error: string }

/** Удаляет черновик текущего оператора (освобождение мастера после оформления). */
export async function deletePosDraftOrder(
  orderId: string,
): Promise<DeletePosDraftOrderResult> {
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
    .select("id, status, operator_id")
    .eq("id", orderId)
    .maybeSingle()

  if (loadError || !row) {
    console.error("[deletePosDraftOrder] load", loadError?.message)
    return { success: false, error: "Заказ не найден" }
  }

  const r = row as {
    status: string
    operator_id: string | null
  }

  if (r.status !== "draft") {
    return { success: false, error: "Можно удалить только черновик" }
  }
  if (r.operator_id !== staff.id) {
    return { success: false, error: "Нет доступа к этому черновику" }
  }

  const { error: delError } = await supabase.from("orders").delete().eq("id", orderId)

  if (delError) {
    console.error("[deletePosDraftOrder] delete", delError.message)
    return { success: false, error: "Не удалось удалить черновик" }
  }

  return { success: true }
}
