import type { MenuItem } from "@/types/database"

export type CondimentMenuItemRow = MenuItem & {
  category: { id: string; name_ru: string; name_ro: string } | null
  is_default_condiment?: boolean
  condiment_default_qty?: number | null
}
