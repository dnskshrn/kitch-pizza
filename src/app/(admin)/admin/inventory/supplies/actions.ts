"use server"

import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { revalidatePath } from "next/cache"

export type CreateSupplyOrderItemInput = {
  ingredient_id: string
  quantity: number
  received_qty?: number | null
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
  const supabase = createServiceRoleClient()

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
    let receivedQty: number | null = null
    if (row.received_qty !== undefined && row.received_qty !== null) {
      const rq = Number(row.received_qty)
      if (!Number.isFinite(rq) || rq < 0) {
        throw new Error("Некорректное количество в поле «Получено»")
      }
      receivedQty = rq
    }
    const stockQty = receivedQty ?? qty
    if (!Number.isFinite(price) || price < 0) {
      throw new Error("Цена без НДС не может быть отрицательной")
    }
    if (!Number.isFinite(vat) || vat < 0) {
      throw new Error("Некорректная ставка НДС")
    }
    const priceWithVat = round4(price * (1 + vat / 100))
    const billingQty = stockQty
    return {
      ingredient_id: ingredientId,
      quantity: qty,
      received_qty: receivedQty,
      stock_qty: stockQty,
      price_per_unit: price,
      vat_rate: vat,
      price_per_unit_with_vat: priceWithVat,
      line_ex: billingQty * price,
      line_inc: billingQty * priceWithVat,
    }
  })

  const ingredientIds = [...new Set(normalized.map((n) => n.ingredient_id))]
  const { data: ingRows, error: ingError } = await supabase
    .from("ingredients")
    .select("id")
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
    received_qty: r.received_qty,
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

  const { data: stockRows, error: stockReadError } = await supabase
    .from("ingredient_stock")
    .select("ingredient_id, quantity, avg_cost")
    .in("ingredient_id", ingredientIds)

  if (stockReadError) throw new Error(stockReadError.message)

  const stockMap = new Map<string, { quantity: number; avg_cost: number }>()
  for (const row of stockRows ?? []) {
    stockMap.set(row.ingredient_id, {
      quantity: Number(row.quantity),
      avg_cost: Number(row.avg_cost ?? 0),
    })
  }

  const missingStockIds = ingredientIds.filter((id) => !stockMap.has(id))
  if (missingStockIds.length > 0) {
    const { error: insertStockError } = await supabase
      .from("ingredient_stock")
      .insert(
        missingStockIds.map((ingredient_id) => ({
          ingredient_id,
          quantity: 0,
          avg_cost: 0,
          updated_at: ts,
        })),
      )

    if (insertStockError) throw new Error(insertStockError.message)

    for (const ingredientId of missingStockIds) {
      stockMap.set(ingredientId, { quantity: 0, avg_cost: 0 })
    }
  }

  for (const r of normalized) {
    const stock = stockMap.get(r.ingredient_id)
    if (!stock) {
      throw new Error("Не найдена строка остатка для ингредиента")
    }

    const currentQty = stock.quantity
    const currentCost = stock.avg_cost
    const incomingQty = r.stock_qty
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

    stockMap.set(r.ingredient_id, {
      quantity: newQty,
      avg_cost: round4(newAvgCost),
    })

    const { error: ledgerError } = await supabase
      .from("stock_ledger")
      .insert({
        ingredient_id: r.ingredient_id,
        movement_type: "supply",
        reference_id: orderId,
        reference_type: "supply_order",
        quantity_delta: incomingQty,
        cost_per_unit: incomingCost,
        note: null,
      })

    if (ledgerError) throw new Error(ledgerError.message)
  }

  revalidatePath("/admin/inventory/supplies")
  revalidatePath("/admin/inventory/ingredients")
  revalidatePath("/admin/inventory/stock")
}

type SupplyOrderItemRow = {
  ingredient_id: string
  quantity: number | string
  received_qty: number | string | null
  price_per_unit: number | string
}

function reverseAvgCost(
  currentQty: number,
  currentCost: number,
  removeQty: number,
  removeCost: number,
): number {
  const nextQty = currentQty - removeQty
  if (nextQty > 0) {
    return round4((currentQty * currentCost - removeQty * removeCost) / nextQty)
  }
  return 0
}

export async function annulSupplyOrder(orderId: string) {
  const id = (orderId ?? "").trim()
  if (!id) {
    throw new Error("Не указана поставка")
  }

  const supabase = createServiceRoleClient()

  const { data: orderRow, error: orderError } = await supabase
    .from("supply_orders")
    .select("id, annulled_at")
    .eq("id", id)
    .maybeSingle()

  if (orderError) throw new Error(orderError.message)
  if (!orderRow) {
    throw new Error("Поставка не найдена")
  }
  if (orderRow.annulled_at != null) {
    throw new Error("Поставка уже аннулирована")
  }

  const { data: itemRows, error: itemsError } = await supabase
    .from("supply_order_items")
    .select("ingredient_id, quantity, received_qty, price_per_unit")
    .eq("supply_order_id", id)

  if (itemsError) throw new Error(itemsError.message)
  if (!itemRows || itemRows.length === 0) {
    throw new Error("У поставки нет позиций")
  }

  const normalized = (itemRows as SupplyOrderItemRow[]).map((row) => {
    const qty = Number(row.quantity)
    const receivedRaw = row.received_qty
    const receivedQty =
      receivedRaw != null && receivedRaw !== "" ? Number(receivedRaw) : null
    const stockQty =
      receivedQty != null && Number.isFinite(receivedQty) ? receivedQty : qty
    const price = Number(row.price_per_unit)

    if (!Number.isFinite(stockQty) || stockQty <= 0) {
      throw new Error("Некорректное количество в позиции поставки")
    }
    if (!Number.isFinite(price) || price < 0) {
      throw new Error("Некорректная цена в позиции поставки")
    }

    return {
      ingredient_id: row.ingredient_id,
      stock_qty: stockQty,
      price_per_unit: price,
    }
  })

  const ingredientIds = [...new Set(normalized.map((row) => row.ingredient_id))]

  const { data: stockRows, error: stockReadError } = await supabase
    .from("ingredient_stock")
    .select("ingredient_id, quantity, avg_cost")
    .in("ingredient_id", ingredientIds)

  if (stockReadError) throw new Error(stockReadError.message)

  const stockMap = new Map<string, { quantity: number; avg_cost: number }>()
  for (const row of stockRows ?? []) {
    stockMap.set(row.ingredient_id, {
      quantity: Number(row.quantity),
      avg_cost: Number(row.avg_cost ?? 0),
    })
  }

  const needByIngredient = new Map<string, number>()
  for (const row of normalized) {
    needByIngredient.set(
      row.ingredient_id,
      (needByIngredient.get(row.ingredient_id) ?? 0) + row.stock_qty,
    )
  }

  for (const [ingredientId, need] of needByIngredient) {
    const stock = stockMap.get(ingredientId)
    if (!stock) {
      throw new Error("Нет данных об остатке для одного из ингредиентов")
    }
    if (stock.quantity < need) {
      throw new Error(
        "Недостаточно остатка для аннулирования: часть товара уже списана или использована",
      )
    }
  }

  const ts = new Date().toISOString()

  for (const row of normalized) {
    const stock = stockMap.get(row.ingredient_id)
    if (!stock) {
      throw new Error("Нет данных об остатке для одного из ингредиентов")
    }

    const removeQty = row.stock_qty
    const removeCost = row.price_per_unit
    const newQty = stock.quantity - removeQty
    const newAvgCost = reverseAvgCost(
      stock.quantity,
      stock.avg_cost,
      removeQty,
      removeCost,
    )

    const { error: stockUpError } = await supabase
      .from("ingredient_stock")
      .update({
        quantity: newQty,
        avg_cost: newAvgCost,
        updated_at: ts,
      })
      .eq("ingredient_id", row.ingredient_id)

    if (stockUpError) throw new Error(stockUpError.message)

    stockMap.set(row.ingredient_id, {
      quantity: newQty,
      avg_cost: newAvgCost,
    })

    const { error: ledgerError } = await supabase.from("stock_ledger").insert({
      ingredient_id: row.ingredient_id,
      movement_type: "manual",
      reference_id: id,
      reference_type: "supply_order",
      quantity_delta: -removeQty,
      cost_per_unit: removeCost,
      note: "Аннулирование поставки",
    })

    if (ledgerError) throw new Error(ledgerError.message)
  }

  const { error: annulError } = await supabase
    .from("supply_orders")
    .update({ annulled_at: ts })
    .eq("id", id)
    .is("annulled_at", null)

  if (annulError) throw new Error(annulError.message)

  revalidatePath("/admin/inventory/supplies")
  revalidatePath("/admin/inventory/ingredients")
  revalidatePath("/admin/inventory/stock")
  revalidatePath("/admin/finance/ledger")
}
