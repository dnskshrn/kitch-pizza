import { POS_MENU_ITEM_FOR_MODAL_SELECT } from "@/lib/pos/menu-item-modal-row"
import type { PosMenuItemModalSourceRow } from "@/lib/pos/menu-item-modal-row"
import { createClient } from "@/lib/supabase/client"
import { create } from "zustand"

export type PosMenuCategoryCacheRow = {
  id: string
  name_ru: string
  sort_order: number
  exclude_from_discounts: boolean
  exclude_from_bonus_redemption: boolean
}

export type PosMenuCacheBrand = {
  categories: PosMenuCategoryCacheRow[]
  itemsByCategory: Record<string, PosMenuItemModalSourceRow[]>
  itemsById: Record<string, PosMenuItemModalSourceRow>
  loadedAt: number
}

type PosMenuCacheState = {
  brands: Record<string, PosMenuCacheBrand>
  loadingBrandIds: Record<string, boolean>
  errors: Record<string, string | null>
  loadBrandMenu: (brandId: string) => Promise<boolean>
  loadBrandsMenu: (brandIds: string[]) => Promise<void>
  getBrandMenu: (brandId: string) => PosMenuCacheBrand | null
  clear: () => void
}

const inFlight = new Map<string, Promise<boolean>>()

async function fetchBrandMenu(brandId: string): Promise<PosMenuCacheBrand> {
  const supabase = createClient()
  const [categoriesResult, itemsResult] = await Promise.all([
    supabase
      .from("menu_categories")
      .select("id, name_ru, sort_order, exclude_from_discounts, exclude_from_bonus_redemption")
      .eq("brand_id", brandId)
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    supabase
      .from("menu_items")
      .select(POS_MENU_ITEM_FOR_MODAL_SELECT)
      .eq("brand_id", brandId)
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
  ])

  if (categoriesResult.error) {
    throw new Error(categoriesResult.error.message)
  }
  if (itemsResult.error) {
    throw new Error(itemsResult.error.message)
  }

  const categories = (categoriesResult.data ?? []).map((row) => {
    const r = row as {
      id: string
      name_ru: string
      sort_order: number
      exclude_from_discounts?: boolean | null
      exclude_from_bonus_redemption?: boolean | null
    }
    return {
      id: r.id,
      name_ru: r.name_ru,
      sort_order: r.sort_order,
      exclude_from_discounts: Boolean(r.exclude_from_discounts),
      exclude_from_bonus_redemption: Boolean(r.exclude_from_bonus_redemption),
    } satisfies PosMenuCategoryCacheRow
  })
  const items = (itemsResult.data ?? []) as PosMenuItemModalSourceRow[]
  const itemsByCategory: Record<string, PosMenuItemModalSourceRow[]> = {}
  const itemsById: Record<string, PosMenuItemModalSourceRow> = {}

  for (const item of items) {
    itemsById[item.id] = item
    itemsByCategory[item.category_id] = itemsByCategory[item.category_id] ?? []
    itemsByCategory[item.category_id]!.push(item)
  }

  return {
    categories,
    itemsByCategory,
    itemsById,
    loadedAt: Date.now(),
  }
}

export const usePosMenuCache = create<PosMenuCacheState>()((set, get) => ({
  brands: {},
  loadingBrandIds: {},
  errors: {},

  loadBrandMenu: async (brandId) => {
    if (get().brands[brandId]) return true

    const existing = inFlight.get(brandId)
    if (existing) return existing

    const promise = (async () => {
      set((state) => ({
        loadingBrandIds: { ...state.loadingBrandIds, [brandId]: true },
        errors: { ...state.errors, [brandId]: null },
      }))

      try {
        const menu = await fetchBrandMenu(brandId)
        set((state) => ({
          brands: { ...state.brands, [brandId]: menu },
          loadingBrandIds: { ...state.loadingBrandIds, [brandId]: false },
          errors: { ...state.errors, [brandId]: null },
        }))
        return true
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Не удалось загрузить меню"
        console.error("[pos-menu-cache]", message)
        set((state) => ({
          loadingBrandIds: { ...state.loadingBrandIds, [brandId]: false },
          errors: { ...state.errors, [brandId]: message },
        }))
        return false
      } finally {
        inFlight.delete(brandId)
      }
    })()

    inFlight.set(brandId, promise)
    return promise
  },

  loadBrandsMenu: async (brandIds) => {
    const uniqueIds = Array.from(new Set(brandIds.filter(Boolean)))
    await Promise.all(uniqueIds.map((brandId) => get().loadBrandMenu(brandId)))
  },

  getBrandMenu: (brandId) => get().brands[brandId] ?? null,

  clear: () => {
    inFlight.clear()
    set({ brands: {}, loadingBrandIds: {}, errors: {} })
  },
}))
