"use server"

import { normalizePosBrandSlug } from "@/brands/index"
import { getCurrentStaff } from "@/lib/actions/pos/auth"
import { createServiceRoleClient } from "@/lib/supabase/service-role"

export type CreateDraftOrderResult =
  | { success: true; orderId: string }
  | { success: false; error: string }

export type CreateDraftOrderOptions = {
  brandSlug?: string | null
  userPhone?: string | null
  profileId?: string | null
  userName?: string | null
  deliveryMode?: "delivery" | "pickup" | "aggregator"
  /** Текст для `orders.scheduled_time` при создании черновика (`asap`, `HH:MM` и т.п.) */
  scheduledTime?: string | null
}

export async function createDraftOrder(
  options?: CreateDraftOrderOptions,
): Promise<CreateDraftOrderResult> {
  let operator_id: string | null = null
  try {
    const staff = await getCurrentStaff()
    if (staff) {
      operator_id = staff.id
    }
  } catch {
    operator_id = null
  }

  let supabase
  try {
    supabase = createServiceRoleClient()
  } catch {
    return { success: false, error: "Сервер временно недоступен" }
  }

  let brand_id: string | null = null
  const rawSlug = options?.brandSlug?.trim()
  if (rawSlug) {
    const slug = normalizePosBrandSlug(rawSlug)
    const { data: brandRow, error: brandErr } = await supabase
      .from("brands")
      .select("id")
      .eq("slug", slug)
      .maybeSingle()

    if (brandErr) {
      console.error("[createDraftOrder] brands lookup", brandErr.message)
      return { success: false, error: brandErr.message ?? "Бренд не найден" }
    }
    if (!brandRow) {
      return { success: false, error: "Бренд не найден" }
    }
    brand_id = (brandRow as { id: string }).id
  }

  const user_phone = options?.userPhone?.trim() || null
  const user_name = options?.userName?.trim() || null
  const profile_id =
    typeof options?.profileId === "string" && options.profileId.trim()
      ? options.profileId.trim()
      : null

  const scheduled_time_raw = options?.scheduledTime?.trim()
  const scheduled_time_insert =
    scheduled_time_raw && scheduled_time_raw.length > 0
      ? scheduled_time_raw
      : null

  let data: { id: string } | null
  let error: { message?: string } | null

  if (options?.deliveryMode === "aggregator") {
    const res = await (supabase.from("orders") as any)
      .insert({
        status: "new" as const,
        source: "pos" as const,
        operator_id,
        total: 0,
        delivery_mode: "aggregator" as const,
        aggregator: "glovo" as const,
        payment_method: "aggregator_card" as const,
        prep_deadline_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        delivery_fee: 0,
        discount: 0,
        brand_id,
        user_name,
        user_phone,
        profile_id,
        delivery_address: null,
        promo_code: null,
        scheduled_time: scheduled_time_insert,
        comment: null,
        kitchen_note: null,
        change_from: null,
        cancel_reason: null,
        address_entrance: null,
        address_floor: null,
        address_apartment: null,
        address_intercom: null,
      })
      .select("id")
      .single()
    data = res.data as { id: string } | null
    error = res.error
  } else {
    const res = await (supabase.from("orders") as any)
      .insert({
        status: "new" as const,
        source: "pos" as const,
        operator_id,
        total: 0,
        delivery_mode: options?.deliveryMode ?? ("delivery" as const),
        payment_method: "cash" as const,
        delivery_fee: 0,
        discount: 0,
        brand_id,
        user_name,
        user_phone,
        profile_id,
        delivery_address: null,
        promo_code: null,
        scheduled_time: scheduled_time_insert,
        comment: null,
        kitchen_note: null,
        change_from: null,
        cancel_reason: null,
        address_entrance: null,
        address_floor: null,
        address_apartment: null,
        address_intercom: null,
      })
      .select("id")
      .single()
    data = res.data as { id: string } | null
    error = res.error
  }

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

  return { success: true, orderId: data.id }
}

/** Alias for POS UI (то же самое, что `createDraftOrder`). */
export const createDraftOrderPos = createDraftOrder
