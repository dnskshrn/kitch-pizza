"use server"

import { getCurrentStaff } from "@/lib/actions/pos/auth"
import { createServiceRoleClient } from "@/lib/supabase/service-role"

export type UpdateOrderBrandPosResult =
  | { success: true }
  | { success: false; error: string }

export async function updateOrderBrandPos(input: {
  orderId: string
  brandSlug: string
}): Promise<UpdateOrderBrandPosResult> {
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

  const slug = input.brandSlug.trim()
  if (!slug) {
    return { success: false, error: "Бренд не указан" }
  }

  const { data: brandRow, error: brandErr } = await supabase
    .from("brands")
    .select("id")
    .eq("slug", slug)
    .maybeSingle()

  if (brandErr || !brandRow) {
    console.error("[updateOrderBrandPos] brand", brandErr?.message)
    return { success: false, error: "Бренд не найден" }
  }

  const brandId = (brandRow as { id: string }).id
  const updatedAt = new Date().toISOString()

  const { error: updErr } = await supabase
    .from("orders")
    .update({
      brand_id: brandId,
      updated_at: updatedAt,
    })
    .eq("id", input.orderId)

  if (updErr) {
    console.error("[updateOrderBrandPos]", updErr.message)
    return { success: false, error: "Не удалось сохранить бренд" }
  }

  return { success: true }
}
