"use server"

import { revalidatePath } from "next/cache"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import type { DiscountRule } from "@/types/promotions"

const REVALIDATE = "/admin/discount-rules"

function pickPayload(
  data: Partial<DiscountRule>,
  mode: "insert" | "update",
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    brand_id: data.brand_id,
    name: data.name,
    label_ru: data.label_ru ?? data.name ?? "",
    label_ro: data.label_ro ?? null,
    effect_type: data.effect_type,
    effect_value:
      data.effect_value === undefined ? null : data.effect_value,
    gift_item_id: data.gift_item_id ?? null,
    gift_item_variant_id: data.gift_item_variant_id ?? null,
    target_item_ids: data.target_item_ids ?? null,
    target_category_ids: data.target_category_ids ?? null,
    free_every_n: data.free_every_n ?? null,
    trigger_type: data.trigger_type,
    promo_code_id: data.promo_code_id ?? null,
    min_order_bani: data.min_order_bani ?? null,
    required_item_ids: data.required_item_ids ?? null,
    required_item_min_qty: data.required_item_min_qty ?? null,
    days_of_week: data.days_of_week ?? null,
    active_from: data.active_from ?? null,
    active_to: data.active_to ?? null,
    max_uses: data.max_uses ?? null,
    valid_from: data.valid_from ?? null,
    valid_until: data.valid_until ?? null,
    priority: data.priority ?? 0,
    is_active: data.is_active ?? true,
  }
  if (mode === "insert") {
    payload.uses_count = 0
  }
  return payload
}

export async function saveRule(data: Partial<DiscountRule>): Promise<DiscountRule> {
  const supabase = createServiceRoleClient()
  const id = data.id

  if (id) {
    const { data: row, error } = await (supabase.from("discount_rules") as any)
      .update(pickPayload(data, "update"))
      .eq("id", id)
      .select("*")
      .single()
    if (error) throw new Error(error.message)
    revalidatePath(REVALIDATE)
    return row as DiscountRule
  }

  const { data: row, error } = await (supabase.from("discount_rules") as any)
    .insert(pickPayload(data, "insert"))
    .select("*")
    .single()

  if (error) throw new Error(error.message)
  revalidatePath(REVALIDATE)
  return row as DiscountRule
}

export async function deleteRule(id: string): Promise<void> {
  const supabase = createServiceRoleClient()
  const { error } = await (supabase.from("discount_rules") as any)
    .delete()
    .eq("id", id)
  if (error) throw new Error(error.message)
  revalidatePath(REVALIDATE)
}

export async function toggleRuleActive(id: string, isActive: boolean): Promise<void> {
  const supabase = createServiceRoleClient()
  const { error } = await (supabase.from("discount_rules") as any)
    .update({ is_active: isActive })
    .eq("id", id)
  if (error) throw new Error(error.message)
  revalidatePath(REVALIDATE)
}

/** Строка для выбора подарочной позиции в форме правила. */
export type DiscountRuleGiftMenuPickRow = {
  id: string
  name_ru: string
  name_ro: string
  has_sizes: boolean
  variants: { id: string; name_ru: string; name_ro: string; sort_order: number }[]
}

/** Строка для выбора промокода в форме правила. */
export type DiscountRulePromoPickRow = {
  id: string
  code: string
  description: string | null
}

function escapeIlike(term: string): string {
  return term.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_")
}

function sortVariants(
  variants: DiscountRuleGiftMenuPickRow["variants"],
): DiscountRuleGiftMenuPickRow["variants"] {
  return [...variants].sort((a, b) => a.sort_order - b.sort_order)
}

function normalizeGiftRow(raw: Record<string, unknown>): DiscountRuleGiftMenuPickRow {
  const variantsRaw = raw.variants
  const variants: DiscountRuleGiftMenuPickRow["variants"] = []
  if (Array.isArray(variantsRaw)) {
    for (const v of variantsRaw) {
      if (!v || typeof v !== "object") continue
      const o = v as Record<string, unknown>
      const id = o.id
      if (typeof id !== "string") continue
      variants.push({
        id,
        name_ru: typeof o.name_ru === "string" ? o.name_ru : "",
        name_ro: typeof o.name_ro === "string" ? o.name_ro : "",
        sort_order: typeof o.sort_order === "number" ? o.sort_order : 0,
      })
    }
  }
  return {
    id: String(raw.id ?? ""),
    name_ru: typeof raw.name_ru === "string" ? raw.name_ru : "",
    name_ro: typeof raw.name_ro === "string" ? raw.name_ro : "",
    has_sizes: Boolean(raw.has_sizes),
    variants: sortVariants(variants),
  }
}

export async function searchGiftMenuItemsForDiscountRule(
  brandId: string,
  query: string,
): Promise<DiscountRuleGiftMenuPickRow[]> {
  const supabase = createServiceRoleClient()
  let q = supabase
    .from("menu_items")
    .select(
      "id, name_ru, name_ro, has_sizes, variants:menu_item_variants(id, name_ru, name_ro, sort_order)",
    )
    .eq("brand_id", brandId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .limit(40)

  const trimmed = query.trim()
  if (trimmed.length > 0) {
    const p = `%${escapeIlike(trimmed)}%`
    q = q.or(`name_ru.ilike.${p},name_ro.ilike.${p}`)
  }

  const { data, error } = await q
  if (error) throw new Error(error.message)
  const rows = (data ?? []) as Record<string, unknown>[]
  return rows.map((row) => normalizeGiftRow(row))
}

export async function fetchGiftMenuItemForDiscountRule(
  brandId: string,
  itemId: string,
): Promise<DiscountRuleGiftMenuPickRow | null> {
  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from("menu_items")
    .select(
      "id, name_ru, name_ro, has_sizes, variants:menu_item_variants(id, name_ru, name_ro, sort_order)",
    )
    .eq("brand_id", brandId)
    .eq("id", itemId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) return null
  return normalizeGiftRow(data as Record<string, unknown>)
}

export async function searchPromoCodesForDiscountRule(
  brandId: string,
  query: string,
): Promise<DiscountRulePromoPickRow[]> {
  const supabase = createServiceRoleClient()
  let q = supabase
    .from("promo_codes")
    .select("id, code, description")
    .eq("brand_id", brandId)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(40)

  const trimmed = query.trim()
  if (trimmed.length > 0) {
    const p = `%${escapeIlike(trimmed)}%`
    q = q.or(`code.ilike.${p},description.ilike.${p}`)
  }

  const { data, error } = await q
  if (error) throw new Error(error.message)
  return (data ?? []) as DiscountRulePromoPickRow[]
}

export async function fetchPromoCodeForDiscountRule(
  brandId: string,
  promoId: string,
): Promise<DiscountRulePromoPickRow | null> {
  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from("promo_codes")
    .select("id, code, description")
    .eq("brand_id", brandId)
    .eq("id", promoId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) return null
  return data as DiscountRulePromoPickRow
}

/** Позиция меню для выбора target_item_ids (item_percent). */
export type DiscountRuleTargetMenuItemRow = {
  id: string
  name_ru: string
  price: number | null
  category_id: string
  category_name_ru: string
  category_sort_order: number
  sort_order: number
}

/** Категория для выбора target_category_ids (cheapest_item_free). */
export type DiscountRuleCategoryPickRow = {
  id: string
  name_ru: string
  sort_order: number
}

function normalizeTargetMenuItemRow(raw: Record<string, unknown>): DiscountRuleTargetMenuItemRow {
  const categoryRaw = raw.category
  let category_id = ""
  let category_name_ru = "Без категории"
  let category_sort_order = 0
  if (categoryRaw && typeof categoryRaw === "object") {
    const c = categoryRaw as Record<string, unknown>
    category_id = typeof c.id === "string" ? c.id : ""
    category_name_ru =
      typeof c.name_ru === "string" && c.name_ru.trim() !== ""
        ? c.name_ru
        : "Без категории"
    category_sort_order =
      typeof c.sort_order === "number" ? c.sort_order : 0
  }
  return {
    id: String(raw.id ?? ""),
    name_ru: typeof raw.name_ru === "string" ? raw.name_ru : "",
    price: typeof raw.price === "number" ? raw.price : null,
    category_id,
    category_name_ru,
    category_sort_order,
    sort_order: typeof raw.sort_order === "number" ? raw.sort_order : 0,
  }
}

export async function fetchTargetMenuItemsForDiscountRule(
  brandId: string,
): Promise<DiscountRuleTargetMenuItemRow[]> {
  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from("menu_items")
    .select(
      "id, name_ru, price, sort_order, category_id, category:menu_categories(id, name_ru, sort_order)",
    )
    .eq("brand_id", brandId)
    .order("sort_order", { ascending: true })

  if (error) throw new Error(error.message)
  const rows = (data ?? []) as Record<string, unknown>[]
  return rows
    .map((row) => normalizeTargetMenuItemRow(row))
    .sort((a, b) => {
      const cat = a.category_sort_order - b.category_sort_order
      if (cat !== 0) return cat
      return a.sort_order - b.sort_order
    })
}

export async function fetchCategoriesForDiscountRule(
  brandId: string,
): Promise<DiscountRuleCategoryPickRow[]> {
  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from("menu_categories")
    .select("id, name_ru, sort_order")
    .eq("brand_id", brandId)
    .order("sort_order", { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []) as DiscountRuleCategoryPickRow[]
}
