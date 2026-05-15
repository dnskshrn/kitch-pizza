import { createServiceRoleClient } from "@/lib/supabase/service-role"
import type { StorageUnit } from "@/lib/inventory-units"
import {
  LedgerTable,
  type StockLedgerListRow,
} from "./ledger-table"

function parseUnit(raw: string | undefined | null): StorageUnit {
  if (raw === "ml" || raw === "pcs") return raw
  return "g"
}

function firstIngredient(rel: unknown): { name: string; unit: string } | null {
  if (rel == null) return null
  if (Array.isArray(rel)) {
    const x = rel[0]
    if (x != null && typeof x === "object" && "name" in x) {
      return x as { name: string; unit: string }
    }
    return null
  }
  if (typeof rel === "object" && "name" in rel) {
    return rel as { name: string; unit: string }
  }
  return null
}

type RawLedgerRow = {
  id: string
  created_at: string
  ingredient_id: string
  movement_type: string
  quantity_delta: number | string
  cost_per_unit: number | string | null
  note: string | null
  ingredients: unknown
}

export default async function AdminFinanceLedgerPage() {
  let supabase: ReturnType<typeof createServiceRoleClient>
  try {
    supabase = createServiceRoleClient()
  } catch (e) {
    return (
      <p className="text-destructive">
        Не удалось подключиться к базе:{" "}
        {e instanceof Error ? e.message : "ошибка конфигурации"}
      </p>
    )
  }

  const { data, error } = await supabase
    .from("stock_ledger")
    .select(
      `
      id,
      created_at,
      ingredient_id,
      movement_type,
      quantity_delta,
      cost_per_unit,
      note,
      ingredients ( name, unit )
    `,
    )
    .order("created_at", { ascending: false })
    .limit(200)

  if (error) {
    return (
      <p className="text-destructive">
        Не удалось загрузить движения: {error.message}
      </p>
    )
  }

  const rows: StockLedgerListRow[] = (data ?? []).map((raw) => {
    const r = raw as RawLedgerRow
    const ing = firstIngredient(r.ingredients)
    const unit = parseUnit(ing?.unit)
    const qtyDelta = Number(r.quantity_delta)
    const cost =
      r.cost_per_unit == null || r.cost_per_unit === ""
        ? null
        : Number(r.cost_per_unit)

    return {
      id: r.id,
      created_at: r.created_at,
      ingredient_id: r.ingredient_id,
      movement_type: String(r.movement_type ?? ""),
      quantity_delta: Number.isFinite(qtyDelta) ? qtyDelta : 0,
      cost_per_unit:
        cost != null && Number.isFinite(cost) ? cost : null,
      note: r.note,
      ingredient_name: ing?.name?.trim() || "—",
      ingredient_unit: unit,
    }
  })

  return <LedgerTable rows={rows} />
}
