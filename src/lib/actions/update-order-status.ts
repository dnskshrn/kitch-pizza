"use server"

import { createServiceRoleClient } from "@/lib/supabase/service-role"
import type { OrderStatus } from "@/types/database"

export async function updateOrderStatus(
  orderId: string,
  status: OrderStatus,
): Promise<{ success: boolean }> {
  let supabase
  try {
    supabase = createServiceRoleClient()
  } catch {
    return { success: false }
  }

  const { error } = await supabase
    .from("orders")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", orderId)

  if (error) {
    console.error("[updateOrderStatus]", error.message)
    return { success: false }
  }

  return { success: true }
}
