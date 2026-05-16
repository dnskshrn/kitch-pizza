"use server"

import { getCurrentStaff } from "@/lib/actions/pos/auth"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import type { PosOrderStatus } from "@/types/pos"

export type UpdateOrderStatusPosResult =
  | { success: true }
  | { success: false; error: string }

export async function updateOrderStatusPos(
  orderId: string,
  status: PosOrderStatus,
): Promise<UpdateOrderStatusPosResult> {
  try {
    const staff = await getCurrentStaff()
    if (!staff) {
      return { success: false, error: "Сессия кассира недействительна" }
    }

    const supabase = createServiceRoleClient()
    const { error } = await supabase
      .from("orders")
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId)

    if (error) {
      console.error("[updateOrderStatusPos]", error.message)
      return { success: false, error: "Не удалось обновить статус" }
    }

    return { success: true }
  } catch (error) {
    console.error("[updateOrderStatusPos]", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Не удалось обновить статус",
    }
  }
}
