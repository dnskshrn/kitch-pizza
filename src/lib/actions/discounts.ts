'use server'

import { getStorefrontCategories } from '@/lib/data/storefront-categories'
import { getBrandId } from '@/lib/get-brand-id'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import type { DiscountRule } from '@/types/promotions'
import type { PromoCode } from '@/types/database'

type PromoCodeRow = PromoCode & { brand_id: string }

export async function getStorefrontItemPercentCampaignRules(): Promise<DiscountRule[]> {
  const brandId = await getBrandId()
  const supabase = createServiceRoleClient()
  const { data, error } = await (supabase.from("discount_rules") as any)
    .select("*")
    .eq("brand_id", brandId)
    .eq("trigger_type", "auto")
    .eq("effect_type", "item_percent")
    .eq("is_active", true)
    .order("priority", { ascending: false })

  if (error) {
    console.error("[getStorefrontItemPercentCampaignRules]", error.message)
    return []
  }

  return (data ?? []) as DiscountRule[]
}

export async function getActiveDiscountRules(brandId: string): Promise<DiscountRule[]> {
  const supabase = createServiceRoleClient()
  const { data, error } = await (supabase.from('discount_rules') as any)
    .select('*')
    .eq('brand_id', brandId)
    .eq('is_active', true)
    .eq('trigger_type', 'auto')
    .order('priority', { ascending: false })

  if (error) {
    console.error('[getActiveDiscountRules]', error.message)
    return []
  }

  return (data ?? []) as DiscountRule[]
}

/** Витрина: авто-правила и id категорий с исключением из базы скидок для checkout/корзины. */
export async function getStorefrontCartPricingBootstrap(): Promise<{
  discountAutoRules: DiscountRule[]
  excludedDiscountCategoryIds: string[]
  storefrontExcludedDiscountCategories: Array<{
    id: string
    name_ru: string
    name_ro: string
  }>
}> {
  const brandId = await getBrandId()
  const [discountAutoRules, categories] = await Promise.all([
    getActiveDiscountRules(brandId),
    getStorefrontCategories(),
  ])
  const storefrontExcludedDiscountCategories = categories
    .filter((c) => c.exclude_from_discounts === true)
    .map((c) => ({ id: c.id, name_ru: c.name_ru, name_ro: c.name_ro }))
  const excludedDiscountCategoryIds = storefrontExcludedDiscountCategories.map((c) => c.id)
  return {
    discountAutoRules,
    excludedDiscountCategoryIds,
    storefrontExcludedDiscountCategories,
  }
}

export async function resolvePromoCode(
  brandId: string,
  rawCode: string
): Promise<{ rule: DiscountRule } | { error: string }> {
  const code = rawCode.trim().toUpperCase()
  if (!code) {
    return { error: 'Промокод не найден или недействителен' }
  }

  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from('promo_codes')
    .select('*')
    .eq('brand_id', brandId)
    .eq('code', code)
    .eq('is_active', true)
    .maybeSingle()

  if (error) {
    console.error('[resolvePromoCode]', error.message)
    return { error: 'Промокод не найден или недействителен' }
  }

  if (!data) {
    return { error: 'Промокод не найден или недействителен' }
  }

  const row = data as PromoCodeRow
  const now = new Date()

  if (row.valid_from) {
    const from = new Date(row.valid_from)
    if (now < from) {
      return { error: 'Промокод не найден или недействителен' }
    }
  }
  if (row.valid_until) {
    const until = new Date(row.valid_until)
    if (now > until) {
      return { error: 'Промокод не найден или недействителен' }
    }
  }
  if (row.max_uses != null && row.uses_count >= row.max_uses) {
    return { error: 'Промокод не найден или недействителен' }
  }

  const isPercent = row.discount_type === 'percent'
  const rule: DiscountRule = {
    id: row.id,
    brand_id: row.brand_id,
    name: row.code,
    label_ru: row.description ?? row.code,
    label_ro: null,
    effect_type: isPercent ? 'order_percent' : 'order_fixed',
    effect_value: isPercent ? row.discount_value / 100 : row.discount_value,
    gift_item_id: null,
    gift_item_variant_id: null,
    target_item_ids: null,
    target_category_ids: null,
    free_every_n: null,
    trigger_type: 'promo_code',
    promo_code_id: row.id,
    min_order_bani: row.min_order_bani ?? null,
    required_item_ids: null,
    required_item_min_qty: null,
    days_of_week: null,
    active_from: null,
    active_to: null,
    max_uses: row.max_uses ?? null,
    uses_count: row.uses_count,
    valid_from: row.valid_from ?? null,
    valid_until: row.valid_until ?? null,
    priority: 0,
    is_active: true,
    created_at: row.created_at ?? new Date().toISOString(),
  }

  return { rule }
}
