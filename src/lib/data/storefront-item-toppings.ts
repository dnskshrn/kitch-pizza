"use server"

import { getBrandId } from "@/lib/get-brand-id"
import { createClient } from "@/lib/supabase/server"
import type { Topping } from "@/types/database"

/** Секция «группа топпингов + её позиции» для модалки витрины. */
export type StorefrontMenuItemToppingGroup = {
  id: string
  name_ru: string
  name_ro: string
  /** null — без лимита (множественный выбор). */
  max_selections: number | null
  toppings: Topping[]
}

type NestedGroup = {
  id: string
  brand_id: string
  name_ru: string
  name_ro: string
  sort_order: number
  max_selections: number | null
  toppings: Topping[] | null
}

function normalizeOne<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null
  return Array.isArray(v) ? (v[0] ?? null) : v
}

/** Загрузка топпингов по группам для позиции меню (порядок групп — `sort_order` группы). */
export async function fetchStorefrontMenuItemToppingGroups(
  menuItemId: string,
): Promise<StorefrontMenuItemToppingGroup[]> {
  const brandId = await getBrandId()
  const supabase = await createClient()

  const { data: links, error: linksError } = await supabase
    .from("menu_item_topping_groups")
    .select(
      `
      id,
      topping_groups (
        id,
        brand_id,
        name_ru,
        name_ro,
        sort_order,
        max_selections,
        toppings (
          id,
          group_id,
          name_ru,
          name_ro,
          price,
          image_url,
          is_active,
          sort_order,
          created_at,
          brand_id
        )
      )
    `,
    )
    .eq("menu_item_id", menuItemId)
    .order("id", { ascending: true })

  if (linksError || !links?.length) return []

  const byGroupId = new Map<
    string,
    { meta: NestedGroup; toppings: Topping[] }
  >()

  for (const row of links as {
    topping_groups: NestedGroup | NestedGroup[] | null
  }[]) {
    const g = normalizeOne(row.topping_groups)
    if (!g?.id || g.brand_id !== brandId) continue
    if (byGroupId.has(g.id)) continue

    const raw = g.toppings ?? []
    const toppings: Topping[] = raw
      .filter(
        (t) =>
          t.is_active !== false &&
          (t as Topping & { brand_id?: string }).brand_id === brandId,
      )
      .sort(
        (a, b) =>
          (a.sort_order ?? 0) - (b.sort_order ?? 0) ||
          pickLocalizedSortName(a).localeCompare(pickLocalizedSortName(b)),
      )

    if (toppings.length === 0) continue

    byGroupId.set(g.id, {
      meta: g,
      toppings,
    })
  }

  const sections = [...byGroupId.values()].sort(
    (a, b) =>
      (a.meta.sort_order ?? 0) - (b.meta.sort_order ?? 0) ||
      a.meta.id.localeCompare(b.meta.id),
  )

  return sections.map(({ meta, toppings }) => ({
    id: meta.id,
    name_ru: meta.name_ru,
    name_ro: meta.name_ro,
    max_selections: meta.max_selections ?? null,
    toppings,
  }))
}

function pickLocalizedSortName(t: Topping): string {
  const r = (t.name_ru ?? "").trim()
  const o = (t.name_ro ?? "").trim()
  return r || o || t.id
}
