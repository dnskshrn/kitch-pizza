"use server"

import { getAdminBrandId } from "@/lib/get-admin-brand-id"
import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export type PromoCodeFormInput = {
  code: string
  discount_type: "percent" | "fixed"
  discount_value: number
  min_order_bani: number | null
  max_uses: number | null
  valid_from: string | null
  valid_until: string | null
  is_active: boolean
  description: string | null
}

export async function createPromoCode(data: PromoCodeFormInput) {
  const brandId = await getAdminBrandId()
  const supabase = await createClient()
  const { error } = await supabase.from("promo_codes").insert({
    brand_id: brandId,
    code: data.code,
    discount_type: data.discount_type,
    discount_value: data.discount_value,
    min_order_bani: data.min_order_bani,
    max_uses: data.max_uses,
    valid_from: data.valid_from,
    valid_until: data.valid_until,
    is_active: data.is_active,
    description: data.description,
  })
  if (error) throw new Error(error.message)
  revalidatePath("/admin/promo-codes")
}

export async function updatePromoCode(id: string, data: PromoCodeFormInput) {
  const brandId = await getAdminBrandId()
  const supabase = await createClient()
  const { error } = await supabase
    .from("promo_codes")
    .update({
      code: data.code,
      discount_type: data.discount_type,
      discount_value: data.discount_value,
      min_order_bani: data.min_order_bani,
      max_uses: data.max_uses,
      valid_from: data.valid_from,
      valid_until: data.valid_until,
      is_active: data.is_active,
      description: data.description,
    })
    .eq("id", id)
    .eq("brand_id", brandId)
  if (error) throw new Error(error.message)
  revalidatePath("/admin/promo-codes")
}

export async function deletePromoCode(id: string) {
  const brandId = await getAdminBrandId()
  const supabase = await createClient()
  const { error } = await supabase
    .from("promo_codes")
    .delete()
    .eq("id", id)
    .eq("brand_id", brandId)
  if (error) throw new Error(error.message)
  revalidatePath("/admin/promo-codes")
}
