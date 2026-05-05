import type { MenuItem, MenuItemVariant } from "@/types/database"

/** Ответ Supabase: `menu_items` с вложенными вариантами для POS-модалки. */
export type PosMenuItemModalSourceRow = Pick<
  MenuItem,
  | "id"
  | "category_id"
  | "name_ru"
  | "description_ru"
  | "price"
  | "has_sizes"
  | "image_url"
> & {
  menu_item_variants?: MenuItemVariant[] | null
  menu_item_topping_groups?: { id: string }[] | null
}

export function posVariantsFromMenuEmbed(
  row: PosMenuItemModalSourceRow,
): MenuItemVariant[] {
  const raw = row.menu_item_variants
  if (!Array.isArray(raw) || raw.length === 0) return []
  return [...raw].sort(
    (a, b) =>
      a.sort_order - b.sort_order || a.name_ru.localeCompare(b.name_ru),
  )
}

/** Строка для `PosProductModal`: `variants` вместо вложения `menu_item_variants`. */
export function posMenuRowForModal(
  row: PosMenuItemModalSourceRow,
): PosMenuItemModalSourceRow & { variants?: MenuItemVariant[] } {
  const v = posVariantsFromMenuEmbed(row)
  return v.length > 0 ? { ...row, variants: v } : { ...row }
}

/** Общая выборка для загрузки товара в модалку POS (категория нужна списку меню). */
export const POS_MENU_ITEM_FOR_MODAL_SELECT =
  "id, name_ru, description_ru, category_id, price, has_sizes, image_url, menu_item_topping_groups(id), menu_item_variants(id, menu_item_id, name_ru, name_ro, price, weight_grams, sort_order, created_at)"
