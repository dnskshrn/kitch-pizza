"use server"

import { createClient } from "@/lib/supabase/server"
import type { MenuItemVariant } from "@/types/database"

/** Варианты позиции для витрины (публичное меню); порядок — `sort_order`. */
export async function fetchStorefrontMenuItemVariants(
  menuItemId: string,
): Promise<MenuItemVariant[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("menu_item_variants")
    .select("*")
    .eq("menu_item_id", menuItemId)
    .order("sort_order", { ascending: true })

  if (error) {
    console.error("[fetchStorefrontMenuItemVariants]", error.message)
    return []
  }
  return (data ?? []) as MenuItemVariant[]
}
