"use server"

import { getAdminBrandId } from "@/lib/get-admin-brand-id"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import type { OrderStatus } from "@/types/database"

export async function updateOrderStatus(
  orderId: string,
  status: OrderStatus,
): Promise<{ success: boolean }> {
  let supabase
  let brandId: string
  try {
    brandId = await getAdminBrandId()
    supabase = createServiceRoleClient()
  } catch {
    return { success: false }
  }

  const { error } = await supabase
    .from("orders")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", orderId)
    .eq("brand_id", brandId)

  if (error) {
    console.error("[updateOrderStatus]", error.message)
    return { success: false }
  }

  return { success: true }
}
