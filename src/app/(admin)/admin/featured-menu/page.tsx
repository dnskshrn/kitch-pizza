import { getAdminBrandId } from "@/lib/get-admin-brand-id"
import { createClient } from "@/lib/supabase/server"
import type { FeaturedMenuItemWithItem, MenuItem } from "@/types/database"
import { FeaturedMenuTable } from "./featured-menu-table"

type MenuItemWithCategory = MenuItem & {
  category: { id: string; name_ru: string; name_ro: string } | null
}

export default async function AdminFeaturedMenuPage() {
  const brandId = await getAdminBrandId()
  const supabase = await createClient()

  const [
    { data: featuredItems, error: featuredError },
    { data: menuItems, error: menuError },
  ] = await Promise.all([
    supabase
      .from("featured_menu_items")
      .select("*, menu_item:menu_items(*, category:menu_categories(id, name_ru, name_ro))")
      .eq("brand_id", brandId)
      .order("sort_order", { ascending: true }),
    supabase
      .from("menu_items")
      .select("*, category:menu_categories(id, name_ru, name_ro)")
      .eq("brand_id", brandId)
      .order("sort_order", { ascending: true }),
  ])

  if (featuredError || menuError) {
    return (
      <p className="text-destructive">
        Не удалось загрузить «Новое и популярное»:{" "}
        {featuredError?.message ?? menuError?.message}
      </p>
    )
  }

  return (
    <FeaturedMenuTable
      featuredItems={(featuredItems ?? []) as FeaturedMenuItemWithItem[]}
      menuItems={(menuItems ?? []) as MenuItemWithCategory[]}
    />
  )
}
