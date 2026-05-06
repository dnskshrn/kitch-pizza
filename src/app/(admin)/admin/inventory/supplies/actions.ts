"use server"

import { getAdminBrandId } from "@/lib/get-admin-brand-id"
import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export type CreateSupplyOrderItemInput = {
  ingredient_id: string
  quantity: number
  price_per_unit: number
  vat_rate: number
}

export type CreateSupplyOrderInput = {
  supplier_id: string
  delivery_date: string
  note: string | null
  items: CreateSupplyOrderItemInput[]
}

function round4(value: number): number {
  return Math.round(value * 10000) / 10000
}

export async function createSupplyOrder(payload: CreateSupplyOrderInput) {
  const brandId = await getAdminBrandId()
  const supabase = await createClient()

  const supplierId = (payload.supplier_id ?? "").trim()
  if (!supplierId) {
    throw new Error("Выберите поставщика")
  }

  const itemsRaw = payload.items ?? []
  if (itemsRaw.length === 0) {
    throw new Error("Добавьте хотя бы одну позицию")
  }

  const { data: supplierRow, error: supplierError } = await supabase
    .from("suppliers")
    .select("id")
    .eq("id", supplierId)
    .eq("brand_id", brandId)
    .eq("is_active", true)
    .maybeSingle()

  if (supplierError) throw new Error(supplierError.message)
  if (!supplierRow) {
    throw new Error("Поставщик не найден или неактивен")
  }

  const normalized = itemsRaw.map((row) => {
    const qty = Number(row.quantity)
    const price = Number(row.price_per_unit)
    const vat = Number(row.vat_rate)
    const ingredientId = (row.ingredient_id ?? "").trim()
    if (!ingredientId) {
      throw new Error("Укажите ингредиент в каждой строке")
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      throw new Error("Количество должно быть больше нуля")
    }
    if (!Number.isFinite(price) || price < 0) {
      throw new Error("Цена без НДС не может быть отрицательной")
    }
    if (!Number.isFinite(vat) || vat < 0) {
      throw new Error("Некорректная ставка НДС")
    }
    const priceWithVat = round4(price * (1 + vat / 100))
    return {
      ingredient_id: ingredientId,
      quantity: qty,
      price_per_unit: price,
      vat_rate: vat,
      price_per_unit_with_vat: priceWithVat,
      line_ex: qty * price,
      line_inc: qty * priceWithVat,
    }
  })

  const ingredientIds = [...new Set(normalized.map((n) => n.ingredient_id))]
  const { data: ingRows, error: ingError } = await supabase
    .from("ingredients")
    .select("id")
    .eq("brand_id", brandId)
    .in("id", ingredientIds)

  if (ingError) throw new Error(ingError.message)
  if (!ingRows || ingRows.length !== ingredientIds.length) {
    throw new Error("Один или несколько ингредиентов не найдены")
  }

  const totalCostExVat = normalized.reduce((s, r) => s + r.line_ex, 0)
  const totalCostIncVat = normalized.reduce((s, r) => s + r.line_inc, 0)

  const note =
    payload.note != null && String(payload.note).trim() !== ""
      ? String(payload.note).trim()
      : null

  const { data: orderRow, error: orderError } = await supabase
    .from("supply_orders")
    .insert({
      brand_id: brandId,
      supplier_id: supplierId,
      delivery_date: payload.delivery_date,
      note,
      total_cost_ex_vat: totalCostExVat,
      total_cost_inc_vat: totalCostIncVat,
    })
    .select("id")
    .single()

  if (orderError || !orderRow) {
    if (orderError) throw new Error(orderError.message)
    throw new Error("Не удалось создать заказ поставки")
  }

  const orderId = orderRow.id

  const itemRows = normalized.map((r) => ({
    supply_order_id: orderId,
    ingredient_id: r.ingredient_id,
    quantity: r.quantity,
    price_per_unit: r.price_per_unit,
    vat_rate: r.vat_rate,
    price_per_unit_with_vat: r.price_per_unit_with_vat,
  }))

  const { error: itemsError } = await supabase
    .from("supply_order_items")
    .insert(itemRows)

  if (itemsError) {
    await supabase.from("supply_orders").delete().eq("id", orderId)
    throw new Error(itemsError.message)
  }

  const ts = new Date().toISOString()

  for (const r of normalized) {
    const { data: stock, error: stockReadError } = await supabase
      .from("ingredient_stock")
      .select("quantity, avg_cost")
      .eq("ingredient_id", r.ingredient_id)
      .single()

    if (stockReadError) throw new Error(stockReadError.message)
    if (!stock) {
      throw new Error("Не найдена строка остатка для ингредиента")
    }

    const currentQty = Number(stock.quantity)
    const currentCost = Number(stock.avg_cost ?? 0)
    const incomingQty = r.quantity
    const incomingCost = r.price_per_unit

    const newQty = currentQty + incomingQty
    const newAvgCost =
      newQty > 0
        ? (currentQty * currentCost + incomingQty * incomingCost) / newQty
        : incomingCost

    const { error: stockUpError } = await supabase
      .from("ingredient_stock")
      .update({
        quantity: newQty,
        avg_cost: round4(newAvgCost),
        updated_at: ts,
      })
      .eq("ingredient_id", r.ingredient_id)

    if (stockUpError) throw new Error(stockUpError.message)
  }

  revalidatePath("/admin/inventory/supplies")
  revalidatePath("/admin/inventory/ingredients")
  revalidatePath("/admin/inventory/stock")
}
