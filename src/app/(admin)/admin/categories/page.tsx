import { getAdminBrandId } from "@/lib/get-admin-brand-id"
import { createClient } from "@/lib/supabase/server"
import type { Category } from "@/types/database"
import { CategoriesTable } from "./categories-table"

export default async function AdminCategoriesPage() {
  const brandId = await getAdminBrandId()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("menu_categories")
    .select("*")
    .eq("brand_id", brandId)
    .order("sort_order", { ascending: true })

  if (error) {
    return (
      <p className="text-destructive">
        Не удалось загрузить категории: {error.message}
      </p>
    )
  }

  const categories = (data ?? []) as Category[]

  return <CategoriesTable categories={categories} />
}
