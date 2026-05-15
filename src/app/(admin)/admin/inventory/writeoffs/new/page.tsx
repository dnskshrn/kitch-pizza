import { createClient } from "@/lib/supabase/server"
import type { Ingredient } from "@/types/database"
import {
  WriteoffForm,
  type WriteoffIngredientOption,
} from "../writeoff-form"
import type { StorageUnit } from "@/lib/inventory-units"

function firstRelation<T extends Record<string, unknown>>(rel: unknown): T | null {
  if (rel == null) return null
  if (Array.isArray(rel)) {
    const x = rel[0]
    return x != null && typeof x === "object" ? (x as T) : null
  }
  if (typeof rel === "object") return rel as T
  return null
}

function parseUnit(u: string | undefined): StorageUnit {
  if (u === "ml" || u === "pcs") return u
  return "g"
}

export default async function NewWriteoffPage() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("ingredients")
    .select("id, name, unit, ingredient_stock(avg_cost)")
    .order("name")

  if (error) {
    return (
      <p className="text-destructive">
        Не удалось загрузить ингредиенты: {error.message}
      </p>
    )
  }

  const options: WriteoffIngredientOption[] = (data ?? []).map((raw) => {
    const r = raw as Ingredient & { ingredient_stock: unknown }
    const st = firstRelation<{ avg_cost?: unknown }>(r.ingredient_stock)
    const avgRaw = st?.avg_cost
    const avgCost =
      avgRaw != null && avgRaw !== ""
        ? Number(avgRaw)
        : null
    const avg =
      avgCost != null && Number.isFinite(avgCost) ? avgCost : null

    return {
      id: r.id,
      name: r.name,
      unit: parseUnit(r.unit),
      avgCost: avg,
    }
  })

  return <WriteoffForm ingredients={options} />
}
