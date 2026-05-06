import { getAdminBrandId } from "@/lib/get-admin-brand-id"
import { createClient } from "@/lib/supabase/server"
import type { Ingredient, Supplier } from "@/types/database"
import { SuppliesTable } from "./supplies-table"
import type { SupplyOrderViewModel } from "./supply-order-dialog"

type RawSupplyItemRow = {
  id: string
  ingredient_id: string
  quantity: number | string
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
  suppliers: unknown
  supply_order_items: RawSupplyItemRow[] | null
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
  const items = (row.supply_order_items ?? []).map((it) => {
    const ing = firstRelation<{ name: string; unit: string }>(it.ingredients)
    return {
      id: it.id,
      ingredient_id: it.ingredient_id,
      quantity: Number(it.quantity),
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
    total_cost_ex_vat:
      row.total_cost_ex_vat != null ? Number(row.total_cost_ex_vat) : null,
    total_cost_inc_vat:
      row.total_cost_inc_vat != null ? Number(row.total_cost_inc_vat) : null,
    items,
  }
}

export default async function AdminInventorySuppliesPage() {
  const brandId = await getAdminBrandId()
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
        suppliers ( name ),
        supply_order_items (
          id,
          ingredient_id,
          quantity,
          price_per_unit,
          vat_rate,
          price_per_unit_with_vat,
          ingredients ( name, unit )
        )
      `
      )
      .eq("brand_id", brandId)
      .order("created_at", { ascending: false }),
    supabase.from("suppliers").select("*").eq("brand_id", brandId).order("name"),
    supabase
      .from("ingredients")
      .select("*")
      .eq("brand_id", brandId)
      .order("name"),
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
  const suppliers = (suppliersRes.data ?? []) as Supplier[]
  const ingredients = (ingredientsRes.data ?? []) as Ingredient[]

  return (
    <SuppliesTable
      orders={orders}
      suppliers={suppliers}
      ingredients={ingredients}
    />
  )
}
