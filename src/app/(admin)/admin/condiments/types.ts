import type { MenuItem } from "@/types/database"
import type { LegacyMenuSizeColumns } from "../legacy-menu-sizes"

export type CondimentMenuItemRow = MenuItem &
  LegacyMenuSizeColumns & {
  category: { id: string; name_ru: string; name_ro: string } | null
  is_default_condiment?: boolean
  condiment_default_qty?: number | null
}
