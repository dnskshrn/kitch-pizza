"use server"

import { getCurrentStaff } from "@/lib/actions/pos/auth"
import { createServiceRoleClient } from "@/lib/supabase/service-role"

/** Совпадает с выборкой KDS-клиента; читается через service role (RLS не режет строки). */
const KDS_ORDER_SELECT = `
  id,
  order_number,
  brand_id,
  status,
  scheduled_time,
  updated_at,
  cooking_started_at,
  brands ( slug ),
  order_items (
    id,
    item_name,
    quantity,
    size,
    toppings,
    price
  )
`

export type FetchKdsCookingOrdersResult =
  | { success: true; orders: unknown[] }
  | { success: false; error: string }

/** Все заказы со статусом `cooking` для выбранного бренда (начальная загрузка KDS). */
export async function fetchKdsCookingOrdersPos(
  brandId: string,
): Promise<FetchKdsCookingOrdersResult> {
  const staff = await getCurrentStaff()
  if (!staff) {
    return { success: false, error: "Сессия кассира недействительна" }
  }
  const bid = brandId.trim()
  if (!bid) {
    return { success: false, error: "Бренд не указан" }
  }

  let supabase
  try {
    supabase = createServiceRoleClient()
  } catch {
    return { success: false, error: "Сервер временно недоступен" }
  }

  const { data, error } = await supabase
    .from("orders")
    .select(KDS_ORDER_SELECT)
    .eq("brand_id", bid)
    .eq("status", "cooking")

  if (error) {
    console.error("[fetchKdsCookingOrdersPos]", error.message)
    return { success: false, error: "Не удалось загрузить заказы" }
  }

  return { success: true, orders: data ?? [] }
}

export type FetchKdsOrderByIdResult =
  | { success: true; order: unknown }
  | { success: false; error: string }

/** Одна строка заказа с позициями — для подтягивания после события Realtime. */
export async function fetchKdsOrderByIdPos(
  orderId: string,
): Promise<FetchKdsOrderByIdResult> {
  const staff = await getCurrentStaff()
  if (!staff) {
    return { success: false, error: "Сессия кассира недействительна" }
  }
  const oid = orderId.trim()
  if (!oid) {
    return { success: false, error: "Заказ не указан" }
  }

  let supabase
  try {
    supabase = createServiceRoleClient()
  } catch {
    return { success: false, error: "Сервер временно недоступен" }
  }

  const { data, error } = await supabase
    .from("orders")
    .select(KDS_ORDER_SELECT)
    .eq("id", oid)
    .maybeSingle()

  if (error) {
    console.error("[fetchKdsOrderByIdPos]", error.message)
    return { success: false, error: "Не удалось загрузить заказ" }
  }

  return { success: true, order: data }
}
