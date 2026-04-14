import { createClient } from "@/lib/supabase/server"
import type { Category, CategoryWithItems, MenuItem } from "@/types/database"

/** Меню витрины: активные категории по sort_order и активные позиции; пустые категории отбрасываются. */
export async function getStorefrontMenu(): Promise<CategoryWithItems[]> {
  const supabase = await createClient()

  const { data: categories, error: categoriesError } = await supabase
    .from("menu_categories")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })

  if (categoriesError) {
    console.error("getStorefrontMenu categories:", categoriesError.message)
    return []
  }

  if (!categories?.length) return []

  // `*` включает веса, size_s_label, size_l_label и прочие поля позиции
  const { data: items, error: itemsError } = await supabase
    .from("menu_items")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })

  if (itemsError) {
    console.error("getStorefrontMenu items:", itemsError.message)
    return []
  }

  const typedItems = (items ?? []) as MenuItem[]
  const byCategory = new Map<string, MenuItem[]>()

  for (const item of typedItems) {
    const list = byCategory.get(item.category_id) ?? []
    list.push(item)
    byCategory.set(item.category_id, list)
  }

  for (const list of byCategory.values()) {
    list.sort((a, b) => a.sort_order - b.sort_order)
  }

  const result: CategoryWithItems[] = []
  for (const cat of categories as Category[]) {
    const catItems = byCategory.get(cat.id)
    if (!catItems?.length) continue
    result.push({ category: cat, items: catItems })
  }

  return result
}
