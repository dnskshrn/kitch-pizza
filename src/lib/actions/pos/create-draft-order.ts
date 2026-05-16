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
  deliveryMode?: "delivery" | "pickup"
}

export async function createDraftOrder(
  options?: CreateDraftOrderOptions,
): Promise<CreateDraftOrderResult> {
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

  const insertRow = {
    status: "draft" as const,
    source: "pos" as const,
    operator_id: staff.id,
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
    scheduled_time: null,
    comment: null,
    change_from: null,
    cancel_reason: null,
    address_entrance: null,
    address_floor: null,
    address_apartment: null,
    address_intercom: null,
  }

  const { data, error } = await (supabase.from("orders") as any)
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
