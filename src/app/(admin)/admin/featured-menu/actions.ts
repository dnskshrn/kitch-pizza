"use server"

import { getAdminBrandId } from "@/lib/get-admin-brand-id"
import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

const ADMIN_FEATURED_MENU_PATH = "/admin/featured-menu"

async function assertMenuItemBelongsToBrand(menuItemId: string, brandId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("menu_items")
    .select("id")
    .eq("id", menuItemId)
    .eq("brand_id", brandId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) throw new Error("Позиция меню не найдена в текущем бренде")
}

export async function addFeaturedMenuItem(menuItemId: string) {
  const brandId = await getAdminBrandId()
  const supabase = await createClient()

  await assertMenuItemBelongsToBrand(menuItemId, brandId)

  const { data: lastItem, error: orderError } = await supabase
    .from("featured_menu_items")
    .select("sort_order")
    .eq("brand_id", brandId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (orderError) throw new Error(orderError.message)

  const nextSortOrder =
    typeof lastItem?.sort_order === "number" ? lastItem.sort_order + 1 : 0

  const { error } = await supabase.from("featured_menu_items").insert({
    brand_id: brandId,
    menu_item_id: menuItemId,
    sort_order: nextSortOrder,
  })

  if (error) {
    if (error.code === "23505") {
      throw new Error("Эта позиция уже добавлена в «Новое и популярное»")
    }
    throw new Error(error.message)
  }

  revalidatePath(ADMIN_FEATURED_MENU_PATH)
  revalidatePath("/")
}

export async function removeFeaturedMenuItem(featuredItemId: string) {
  const brandId = await getAdminBrandId()
  const supabase = await createClient()
  const { error } = await supabase
    .from("featured_menu_items")
    .delete()
    .eq("id", featuredItemId)
    .eq("brand_id", brandId)

  if (error) throw new Error(error.message)

  revalidatePath(ADMIN_FEATURED_MENU_PATH)
  revalidatePath("/")
}

export async function updateFeaturedMenuItemsOrder(featuredItemIds: string[]) {
  const brandId = await getAdminBrandId()
  const uniqueIds = Array.from(new Set(featuredItemIds))

  if (featuredItemIds.length === 0) {
    revalidatePath(ADMIN_FEATURED_MENU_PATH)
    revalidatePath("/")
    return
  }

  if (uniqueIds.length !== featuredItemIds.length) {
    throw new Error("В списке есть дубли позиций")
  }

  const supabase = await createClient()
  const { data, error: readError } = await supabase
    .from("featured_menu_items")
    .select("id")
    .eq("brand_id", brandId)
    .in("id", featuredItemIds)

  if (readError) throw new Error(readError.message)
  if ((data ?? []).length !== featuredItemIds.length) {
    throw new Error("Не удалось подтвердить порядок для текущего бренда")
  }

  for (const [sortOrder, id] of featuredItemIds.entries()) {
    const { error } = await supabase
      .from("featured_menu_items")
      .update({ sort_order: sortOrder })
      .eq("id", id)
      .eq("brand_id", brandId)

    if (error) throw new Error(error.message)
  }

  revalidatePath(ADMIN_FEATURED_MENU_PATH)
  revalidatePath("/")
}
