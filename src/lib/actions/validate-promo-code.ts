"use server"

import { createServiceRoleClient } from "@/lib/supabase/service-role"
import type { PromoCode, PromoCodeValidationResult } from "@/types/database"

export async function validatePromoCode(
  code: string,
  cartSubtotalBani: number,
): Promise<PromoCodeValidationResult> {
  const normalized = code.trim().toUpperCase()
  if (!normalized) {
    return { valid: false, error: "not_found" }
  }

  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from("promo_codes")
    .select("*")
    .eq("code", normalized)
    .maybeSingle()

  if (error) {
    console.error("[validatePromoCode]", error.message)
    return { valid: false, error: "not_found" }
  }

  if (!data) {
    return { valid: false, error: "not_found" }
  }

  const row = data as PromoCode

  if (!row.is_active) {
    return { valid: false, error: "inactive" }
  }

  const now = new Date()
  if (row.valid_from) {
    const from = new Date(row.valid_from)
    if (now < from) {
      return { valid: false, error: "not_started" }
    }
  }
  if (row.valid_until) {
    const until = new Date(row.valid_until)
    if (now > until) {
      return { valid: false, error: "expired" }
    }
  }
  if (row.max_uses != null && row.uses_count >= row.max_uses) {
    return { valid: false, error: "limit_reached" }
  }
  if (
    row.min_order_bani != null &&
    cartSubtotalBani < row.min_order_bani
  ) {
    return {
      valid: false,
      error: "min_order_not_met",
      min_order_bani: row.min_order_bani,
    }
  }

  return { valid: true, promo: row }
}
