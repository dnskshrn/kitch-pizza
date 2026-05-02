import { getAdminBrandId } from "@/lib/get-admin-brand-id"
import { createClient } from "@/lib/supabase/server"
import { getToppingGroups } from "../menu/actions"
import { ensureCondimentCategory } from "./actions"
import { CondimentsTable } from "./condiments-table"
import type { CondimentMenuItemRow } from "./types"

export default async function AdminCondimentsPage() {
  const brandId = await getAdminBrandId()
  const condimentCategoryId = await ensureCondimentCategory()
  const supabase = await createClient()

  const [{ data: items, error: itemsError }, toppingGroups] = await Promise.all([
    supabase
      .from("menu_items")
      .select("*, category:menu_categories(id, name_ru, name_ro)")
      .eq("brand_id", brandId)
      .eq("category_id", condimentCategoryId)
      .order("sort_order", { ascending: true }),
    getToppingGroups(),
  ])

  if (itemsError) {
    return (
      <p className="text-destructive">
        Не удалось загрузить данные: {itemsError.message}
      </p>
    )
  }

  const rows = (items ?? []) as CondimentMenuItemRow[]

  return (
    <CondimentsTable
      items={rows}
      condimentCategoryId={condimentCategoryId}
      toppingGroups={toppingGroups}
    />
  )
}
