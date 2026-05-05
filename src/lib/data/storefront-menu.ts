import { getBrandId } from "@/lib/get-brand-id"
import { createClient } from "@/lib/supabase/server"
import type {
  Category,
  CategoryWithItems,
  MenuItem,
  MenuItemVariant,
} from "@/types/database"

/** Меню витрины: активные категории по sort_order и активные позиции; пустые категории отбрасываются. */
export async function getStorefrontMenu(): Promise<CategoryWithItems[]> {
  const brandId = await getBrandId()
  const supabase = await createClient()

  const { data: categories, error: categoriesError } = await supabase
    .from("menu_categories")
    .select("*")
    .eq("brand_id", brandId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })

  if (categoriesError) {
    console.error("getStorefrontMenu categories:", categoriesError.message)
    return []
  }

  if (!categories?.length) return []

  const { data: items, error: itemsError } = await supabase
    .from("menu_items")
    .select("*")
    .eq("brand_id", brandId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })

  if (itemsError) {
    console.error("getStorefrontMenu items:", itemsError.message)
    return []
  }

  const typedItems = (items ?? []) as MenuItem[]
  const itemIds = typedItems.map((i) => i.id)
  const variantsByItem = new Map<string, MenuItemVariant[]>()

  if (itemIds.length > 0) {
    const { data: variantsRows, error: vErr } = await supabase
      .from("menu_item_variants")
      .select("*")
      .in("menu_item_id", itemIds)
      .order("sort_order", { ascending: true })

    if (vErr) {
      console.error("getStorefrontMenu variants:", vErr.message)
    } else {
      for (const row of (variantsRows ?? []) as MenuItemVariant[]) {
        const list = variantsByItem.get(row.menu_item_id) ?? []
        list.push(row)
        variantsByItem.set(row.menu_item_id, list)
      }
    }
  }

  const withVariants: MenuItem[] = typedItems.map((item) => {
    const variants = variantsByItem.get(item.id)
    return variants?.length ? { ...item, variants } : item
  })

  const byCategory = new Map<string, MenuItem[]>()

  for (const item of withVariants) {
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
