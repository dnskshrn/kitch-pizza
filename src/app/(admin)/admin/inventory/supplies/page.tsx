import { endOfMonth, format, startOfMonth } from "date-fns"
import { createClient } from "@/lib/supabase/server"
import type { Ingredient, Supplier } from "@/types/database"
import { SuppliesTable } from "./supplies-table"
import type { SupplyOrderViewModel, SupplyPeriodTotals } from "./types"

export const dynamic = "force-dynamic"

type PageProps = {
  searchParams?: {
    from?: string | string[]
    to?: string | string[]
  }
}

function toYmd(value: Date): string {
  return format(value, "yyyy-MM-dd")
}

function firstParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0]
  return value
}

function isValidYmd(value: string | undefined): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function resolveDateRange(searchParams: PageProps["searchParams"]): {
  from: string
  to: string
} {
  const now = new Date()
  const defaultFrom = toYmd(startOfMonth(now))
  const defaultTo = toYmd(endOfMonth(now))

  const from = firstParam(searchParams?.from)
  const to = firstParam(searchParams?.to)

  if (!isValidYmd(from) || !isValidYmd(to) || from > to) {
    return { from: defaultFrom, to: defaultTo }
  }

  return { from, to }
}

function deliveryDateYmd(deliveryDate: string): string {
  return (deliveryDate ?? "").slice(0, 10)
}

function isInPeriod(
  deliveryDate: string,
  from: string,
  to: string,
): boolean {
  const ymd = deliveryDateYmd(deliveryDate)
  if (!ymd) return false
  return ymd >= from && ymd <= to
}

function computePeriodTotals(orders: SupplyOrderViewModel[]): SupplyPeriodTotals {
  let orderCount = 0
  let annulledCount = 0
  let totalExVat = 0
  let totalIncVat = 0

  for (const o of orders) {
    if (o.annulled_at != null) {
      annulledCount += 1
      continue
    }
    orderCount += 1
    totalExVat += o.total_cost_ex_vat ?? 0
    totalIncVat += o.total_cost_inc_vat ?? 0
  }

  return { orderCount, annulledCount, totalExVat, totalIncVat }
}

type RawSupplyItemRow = {
  id: string
  ingredient_id: string
  quantity: number | string
  received_qty: number | string | null
  price_per_unit: number | string
  vat_rate: number | string
  price_per_unit_with_vat: number | string
  ingredients: unknown
}

type RawSupplyOrderRow = {
  id: string
  supplier_id: string | null
  delivery_date: string
  note: string | null
  total_cost_ex_vat: number | string | null
  total_cost_inc_vat: number | string | null
  annulled_at: string | null
  suppliers: unknown
  supply_order_items: RawSupplyItemRow[] | RawSupplyItemRow | null
}

function asRelationArray<T>(value: T | T[] | null | undefined): T[] {
  if (value == null) return []
  return Array.isArray(value) ? value : [value]
}

function firstRelation<T extends Record<string, unknown>>(
  rel: unknown
): T | null {
  if (rel == null) return null
  if (Array.isArray(rel)) {
    const x = rel[0]
    return x != null && typeof x === "object" ? (x as T) : null
  }
  if (typeof rel === "object") return rel as T
  return null
}

function toSupplyOrderViewModel(row: RawSupplyOrderRow): SupplyOrderViewModel {
  const items = asRelationArray(row.supply_order_items).map((it) => {
    const ing = firstRelation<{ name: string; unit: string }>(it.ingredients)
    return {
      id: it.id,
      ingredient_id: it.ingredient_id,
      quantity: Number(it.quantity),
      received_qty:
        it.received_qty != null && it.received_qty !== ""
          ? Number(it.received_qty)
          : null,
      price_per_unit: Number(it.price_per_unit),
      vat_rate: Number(it.vat_rate),
      price_per_unit_with_vat: Number(it.price_per_unit_with_vat),
      ingredient: {
        name: ing?.name ?? "—",
        unit: (ing?.unit ?? "g") as Ingredient["unit"],
      },
    }
  })
  return {
    id: row.id,
    supplier_id: row.supplier_id ?? "",
    delivery_date: row.delivery_date,
    note: row.note,
    annulled_at: row.annulled_at,
    total_cost_ex_vat:
      row.total_cost_ex_vat != null ? Number(row.total_cost_ex_vat) : null,
    total_cost_inc_vat:
      row.total_cost_inc_vat != null ? Number(row.total_cost_inc_vat) : null,
    items,
  }
}

export default async function AdminInventorySuppliesPage({
  searchParams,
}: PageProps) {
  const { from, to } = resolveDateRange(searchParams)
  const supabase = await createClient()

  const [ordersRes, suppliersRes, ingredientsRes] = await Promise.all([
    supabase
      .from("supply_orders")
      .select(
        `
        id,
        supplier_id,
        delivery_date,
        note,
        total_cost_ex_vat,
        total_cost_inc_vat,
        annulled_at,
        suppliers ( name ),
        supply_order_items (
          id,
          ingredient_id,
          quantity,
          received_qty,
          price_per_unit,
          vat_rate,
          price_per_unit_with_vat,
          ingredients ( name, unit )
        )
      `
      )
      .gte("delivery_date", from)
      .lte("delivery_date", to)
      .order("delivery_date", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase.from("suppliers").select("id, name, is_active").order("name"),
    supabase.from("ingredients").select("*").order("name"),
  ])

  if (ordersRes.error) {
    return (
      <p className="text-destructive">
        Не удалось загрузить поставки: {ordersRes.error.message}
      </p>
    )
  }
  if (suppliersRes.error) {
    return (
      <p className="text-destructive">
        Не удалось загрузить поставщиков: {suppliersRes.error.message}
      </p>
    )
  }
  if (ingredientsRes.error) {
    return (
      <p className="text-destructive">
        Не удалось загрузить ингредиенты: {ingredientsRes.error.message}
      </p>
    )
  }

  const orders = (ordersRes.data ?? []).map((row) =>
    toSupplyOrderViewModel(row as unknown as RawSupplyOrderRow)
  )
  const periodOrders = orders.filter((o) => isInPeriod(o.delivery_date, from, to))
  const periodTotals = computePeriodTotals(periodOrders)
  const suppliers = (suppliersRes.data ?? []) as Supplier[]
  const ingredients = (ingredientsRes.data ?? []) as Ingredient[]

  return (
    <SuppliesTable
      orders={periodOrders}
      suppliers={suppliers}
      ingredients={ingredients}
      dateFrom={from}
      dateTo={to}
      periodTotals={periodTotals}
    />
  )
}
