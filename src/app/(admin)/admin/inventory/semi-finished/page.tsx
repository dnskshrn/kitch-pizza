import { getAdminBrandId } from "@/lib/get-admin-brand-id"
import { createClient } from "@/lib/supabase/server"
import type { SemiFinishedItem } from "@/types/database"
import type { IngredientSelectOption, SemiFinishedWithItems } from "./types"
import { SemiFinishedTable } from "./semi-finished-table"

function normalizeSemiFinished(row: Record<string, unknown>): SemiFinishedWithItems {
  const raw = row.semi_finished_items
  const list = !raw ? [] : Array.isArray(raw) ? raw : [raw]
  const items = list.map((item) => {
    const i = item as Record<string, unknown>
    const ing = i.ingredients
    const ingredients = Array.isArray(ing)
      ? (ing[0] as { name: string; unit: "g" | "ml" | "pcs" } | null) ??
        null
      : (ing as { name: string; unit: "g" | "ml" | "pcs" } | null) ?? null
    const copy = { ...i }
    delete copy.ingredients
    return {
      ...(copy as SemiFinishedItem),
      ingredients,
    }
  })

  const copy = { ...row }
  delete copy.semi_finished_items
  return {
    ...(copy as Omit<SemiFinishedWithItems, "semi_finished_items">),
    semi_finished_items: items,
  }
}

export default async function AdminSemiFinishedPage() {
  const brandId = await getAdminBrandId()
  const supabase = await createClient()

  const [semiRes, ingRes] = await Promise.all([
    supabase
      .from("semi_finished")
      .select("*, semi_finished_items(*, ingredients(name, unit))")
      .eq("brand_id", brandId)
      .order("name"),
    supabase
      .from("ingredients")
      .select("id, name, unit")
      .eq("brand_id", brandId)
      .order("name"),
  ])

  if (semiRes.error) {
    return (
      <p className="text-destructive">
        Не удалось загрузить полуфабрикаты: {semiRes.error.message}
      </p>
    )
  }

  if (ingRes.error) {
    return (
      <p className="text-destructive">
        Не удалось загрузить ингредиенты: {ingRes.error.message}
      </p>
    )
  }

  const rows = (semiRes.data ?? []).map((r) =>
    normalizeSemiFinished(r as Record<string, unknown>)
  )

  const ingredientOptions = (ingRes.data ?? []) as IngredientSelectOption[]

  return (
    <SemiFinishedTable
      rows={rows}
      ingredientOptions={ingredientOptions}
    />
  )
}
