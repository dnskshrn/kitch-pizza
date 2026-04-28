"use server"

import { getBrandId } from "@/lib/get-brand-id"
import { createClient } from "@/lib/supabase/server"
import type { Topping } from "@/types/database"

/** Загрузка топпингов для позиции меню (связь через группы). */
export async function fetchToppingsForMenuItem(menuItemId: string): Promise<Topping[]> {
  const brandId = await getBrandId()
  const supabase = await createClient()

  const { data: links, error: linksError } = await supabase
    .from("menu_item_topping_groups")
    .select("topping_group_id")
    .eq("menu_item_id", menuItemId)

  if (linksError || !links?.length) return []

  const groupIds = [...new Set(links.map((l) => l.topping_group_id as string))]

  const { data: toppings, error: toppingsError } = await supabase
    .from("toppings")
    .select("*")
    .eq("brand_id", brandId)
    .in("group_id", groupIds)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })

  if (toppingsError || !toppings?.length) return []

  const seen = new Set<string>()
  const result: Topping[] = []
  for (const row of toppings as Topping[]) {
    if (seen.has(row.id)) continue
    seen.add(row.id)
    result.push(row)
  }
  return result
}
