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

export type UpdateSupplyOrderInput = CreateSupplyOrderInput

type NormalizedSupplyItem = {
  ingredient_id: string
  quantity: number
  received_qty: number | null
  stock_qty: number
  price_per_unit: number
  vat_rate: number
  price_per_unit_with_vat: number
  line_ex: number
  line_inc: number
}

type StockRpcItem = {
  ingredient_id: string
  stock_qty: number
  price_per_unit: number
}

function round4(value: number): number {
  return Math.round(value * 10000) / 10000
}

function normalizeSupplyOrderItems(
  itemsRaw: CreateSupplyOrderItemInput[],
): NormalizedSupplyItem[] {
  if (itemsRaw.length === 0) {
    throw new Error("Добавьте хотя бы одну позицию")
  }

  return itemsRaw.map((row) => {
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
}

async function assertIngredientsExist(
  supabase: ReturnType<typeof createServiceRoleClient>,
  ingredientIds: string[],
) {
  const { data: ingRows, error: ingError } = await supabase
    .from("ingredients")
    .select("id")
    .in("id", ingredientIds)

  if (ingError) throw new Error(ingError.message)
  if (!ingRows || ingRows.length !== ingredientIds.length) {
    throw new Error("Один или несколько ингредиентов не найдены")
  }
}

function toStockRpcPayload(items: NormalizedSupplyItem[]): StockRpcItem[] {
  return items.map((r) => ({
    ingredient_id: r.ingredient_id,
    stock_qty: r.stock_qty,
    price_per_unit: r.price_per_unit,
  }))
}

function revalidateSupplyPaths() {
  revalidatePath("/admin/inventory/supplies")
  revalidatePath("/admin/inventory/ingredients")
  revalidatePath("/admin/inventory/stock")
}

export async function createSupplyOrder(payload: CreateSupplyOrderInput) {
  const supabase = createServiceRoleClient()

  const supplierId = (payload.supplier_id ?? "").trim()
  if (!supplierId) {
    throw new Error("Выберите поставщика")
  }

  const normalized = normalizeSupplyOrderItems(payload.items ?? [])
  const ingredientIds = [...new Set(normalized.map((n) => n.ingredient_id))]

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

  await assertIngredientsExist(supabase, ingredientIds)

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

  const { error: stockRpcError } = await supabase.rpc(
    "apply_supply_order_stock_items",
    {
      p_order_id: orderId,
      p_items: toStockRpcPayload(normalized),
      p_note: null,
    },
  )

  if (stockRpcError) {
    await supabase
      .from("supply_order_items")
      .delete()
      .eq("supply_order_id", orderId)
    await supabase.from("supply_orders").delete().eq("id", orderId)
    throw new Error(stockRpcError.message)
  }

  revalidateSupplyPaths()
}

type SupplyOrderItemRow = {
  ingredient_id: string
  quantity: number | string
  received_qty: number | string | null
  price_per_unit: number | string
  vat_rate?: number | string
  price_per_unit_with_vat?: number | string
}

function normalizeExistingSupplyItems(
  itemRows: SupplyOrderItemRow[],
): NormalizedSupplyItem[] {
  return itemRows.map((row) => {
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
      quantity: qty,
      received_qty: receivedQty,
      stock_qty: stockQty,
      price_per_unit: price,
      vat_rate: 0,
      price_per_unit_with_vat: price,
      line_ex: stockQty * price,
      line_inc: stockQty * price,
    }
  })
}

export async function updateSupplyOrder(
  orderId: string,
  payload: UpdateSupplyOrderInput,
) {
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
    throw new Error("Нельзя редактировать аннулированную поставку")
  }

  const supplierId = (payload.supplier_id ?? "").trim()
  if (!supplierId) {
    throw new Error("Выберите поставщика")
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

  const { data: oldItemRows, error: oldItemsError } = await supabase
    .from("supply_order_items")
    .select(
      "ingredient_id, quantity, received_qty, price_per_unit, vat_rate, price_per_unit_with_vat",
    )
    .eq("supply_order_id", id)

  if (oldItemsError) throw new Error(oldItemsError.message)
  if (!oldItemRows || oldItemRows.length === 0) {
    throw new Error("У поставки нет позиций")
  }

  const oldNormalized = normalizeExistingSupplyItems(
    oldItemRows as SupplyOrderItemRow[],
  )
  const normalized = normalizeSupplyOrderItems(payload.items ?? [])
  const ingredientIds = [
    ...new Set([
      ...oldNormalized.map((r) => r.ingredient_id),
      ...normalized.map((r) => r.ingredient_id),
    ]),
  ]

  await assertIngredientsExist(supabase, ingredientIds)

  const totalCostExVat = normalized.reduce((s, r) => s + r.line_ex, 0)
  const totalCostIncVat = normalized.reduce((s, r) => s + r.line_inc, 0)
  const note =
    payload.note != null && String(payload.note).trim() !== ""
      ? String(payload.note).trim()
      : null

  const { error: orderUpError } = await supabase
    .from("supply_orders")
    .update({
      supplier_id: supplierId,
      delivery_date: payload.delivery_date,
      note,
      total_cost_ex_vat: totalCostExVat,
      total_cost_inc_vat: totalCostIncVat,
    })
    .eq("id", id)
    .is("annulled_at", null)

  if (orderUpError) throw new Error(orderUpError.message)

  const { error: deleteItemsError } = await supabase
    .from("supply_order_items")
    .delete()
    .eq("supply_order_id", id)

  if (deleteItemsError) throw new Error(deleteItemsError.message)

  const itemRows = normalized.map((r) => ({
    supply_order_id: id,
    ingredient_id: r.ingredient_id,
    quantity: r.quantity,
    received_qty: r.received_qty,
    price_per_unit: r.price_per_unit,
    vat_rate: r.vat_rate,
    price_per_unit_with_vat: r.price_per_unit_with_vat,
  }))

  const { error: insertItemsError } = await supabase
    .from("supply_order_items")
    .insert(itemRows)

  if (insertItemsError) throw new Error(insertItemsError.message)

  const { error: stockError } = await supabase.rpc(
    "replace_supply_order_stock_items",
    {
      p_order_id: id,
      p_revert_items: toStockRpcPayload(oldNormalized),
      p_apply_items: toStockRpcPayload(normalized),
      p_revert_note: "Редактирование поставки (откат)",
      p_apply_note: "Редактирование поставки (применение)",
    },
  )

  if (stockError) {
    await supabase.from("supply_order_items").delete().eq("supply_order_id", id)
    const restoreRows = (oldItemRows as SupplyOrderItemRow[]).map((row) => ({
      supply_order_id: id,
      ingredient_id: row.ingredient_id,
      quantity: Number(row.quantity),
      received_qty:
        row.received_qty != null && row.received_qty !== ""
          ? Number(row.received_qty)
          : null,
      price_per_unit: Number(row.price_per_unit),
      vat_rate: Number(row.vat_rate ?? 0),
      price_per_unit_with_vat: Number(
        row.price_per_unit_with_vat ?? row.price_per_unit,
      ),
    }))
    await supabase.from("supply_order_items").insert(restoreRows)
    throw new Error(stockError.message)
  }

  revalidateSupplyPaths()
  revalidatePath("/admin/finance/ledger")
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

  const normalized = normalizeExistingSupplyItems(
    itemRows as SupplyOrderItemRow[],
  )

  const { error: revertError } = await supabase.rpc(
    "revert_supply_order_stock_items",
    {
      p_order_id: id,
      p_items: toStockRpcPayload(normalized),
      p_note: "Аннулирование поставки",
    },
  )

  if (revertError) throw new Error(revertError.message)

  const ts = new Date().toISOString()

  const { error: annulError } = await supabase
    .from("supply_orders")
    .update({ annulled_at: ts })
    .eq("id", id)
    .is("annulled_at", null)

  if (annulError) throw new Error(annulError.message)

  revalidateSupplyPaths()
  revalidatePath("/admin/finance/ledger")
}
