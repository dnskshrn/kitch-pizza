import { getAdminBrandId } from "@/lib/get-admin-brand-id"
import { createClient } from "@/lib/supabase/server"
import type { MenuItem } from "@/types/database"
import { getToppingGroups } from "./actions"
import { MenuTable } from "./menu-table"

type MenuItemRow = MenuItem & {
  category: { id: string; name_ru: string; name_ro: string } | null
}

export default async function AdminMenuPage() {
  const brandId = await getAdminBrandId()
  const supabase = await createClient()

  const [{ data: items, error: itemsError }, { data: categories, error: catError }, toppingGroups] =
    await Promise.all([
      supabase
        .from("menu_items")
        .select("*, category:menu_categories(id, name_ru, name_ro)")
        .eq("brand_id", brandId)
        .order("sort_order", { ascending: true }),
      supabase
        .from("menu_categories")
        .select("id, name_ru, name_ro")
        .eq("brand_id", brandId)
        .order("sort_order", { ascending: true }),
      getToppingGroups(),
    ])

  if (itemsError || catError) {
    return (
      <p className="text-destructive">
        Не удалось загрузить данные:{" "}
        {itemsError?.message ?? catError?.message}
      </p>
    )
  }

  const rows = (items ?? []) as MenuItemRow[]
  const cats = categories ?? []

  return (
    <MenuTable items={rows} categories={cats} toppingGroups={toppingGroups} />
  )
}
