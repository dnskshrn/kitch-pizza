import type { Ingredient } from "@/types/database"

export type SupplyOrderViewModel = {
  id: string
  supplier_id: string
  delivery_date: string
  note: string | null
  annulled_at: string | null
  total_cost_ex_vat: number | null
  total_cost_inc_vat: number | null
  items: {
    id: string
    ingredient_id: string
    quantity: number
    received_qty: number | null
    price_per_unit: number
    vat_rate: number
    price_per_unit_with_vat: number
    ingredient: { name: string; unit: Ingredient["unit"] }
  }[]
}
