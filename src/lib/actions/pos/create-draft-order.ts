"use server"

import { getCurrentStaff } from "@/lib/actions/pos/auth"
import { createServiceRoleClient } from "@/lib/supabase/service-role"

export type CreateDraftOrderResult =
  | { success: true; orderId: string }
  | { success: false; error: string }

export async function createDraftOrder(): Promise<CreateDraftOrderResult> {
  const staff = await getCurrentStaff()
  if (!staff) {
    return { success: false, error: "Сессия кассира недействительна" }
  }

  console.log("[createDraftOrderPos] session ok, inserting draft...")

  let supabase
  try {
    supabase = createServiceRoleClient()
  } catch {
    return { success: false, error: "Сервер временно недоступен" }
  }

  const insertRow = {
    status: "draft" as const,
    source: "pos" as const,
    operator_id: staff.id,
    total: 0,
    delivery_mode: "delivery" as const,
    payment_method: "cash" as const,
    delivery_fee: 0,
    discount: 0,
    brand_id: null,
    user_name: null,
    user_phone: null,
    delivery_address: null,
    promo_code: null,
    scheduled_time: null,
    comment: null,
    change_from: null,
    cancel_reason: null,
    address_entrance: null,
    address_floor: null,
    address_apartment: null,
    address_intercom: null,
  }

  const { data, error } = await supabase
    .from("orders")
    .insert(insertRow)
    .select("id")
    .single()

  if (error) {
    console.error(
      "[createDraftOrderPos] error:",
      JSON.stringify(error, null, 2),
    )
    return { success: false, error: error.message ?? "Unknown error" }
  }

  if (!data) {
    console.error("[createDraftOrderPos] insert returned no data")
    return { success: false, error: "Не удалось создать черновик заказа" }
  }

  return { success: true, orderId: (data as { id: string }).id }
}

/** Alias for POS UI (то же самое, что `createDraftOrder`). */
export const createDraftOrderPos = createDraftOrder
