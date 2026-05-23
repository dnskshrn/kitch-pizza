"use server"

import { getCurrentStaff } from "@/lib/actions/pos/auth"
import { refreshCourierOrderTelegramMessage } from "@/lib/actions/pos/courier-telegram-message"
import { posLinePayloadFromCartItem } from "@/lib/pos-cart-helpers"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import type { PosCartItem } from "@/types/pos"

type UpdateOrderItemsResult =
  | { success: true }
  | { success: false; error: string }

type OrderItemRow = {
  id: string
  quantity: number
  price: number
}

type OrderRow = {
  id: string
  delivery_fee: number
  discount: number
  /** Пункты лояльности; 1 п. = 100 бань к итогу (orders.total — нетто после вычета). */
  bonuses_redeemed: number | null
  order_items: OrderItemRow[] | null
}

function bonusesRedeemedToBani(points: number | null | undefined): number {
  if (typeof points !== "number" || !Number.isFinite(points)) return 0
  return Math.max(0, Math.floor(points)) * 100
}

function itemUnitPriceBani(item: OrderItemRow): number {
  if (item.quantity <= 0) return Math.round(item.price)
  return Math.round(item.price / item.quantity)
}

function nextTotalBani(
  order: OrderRow,
  items: OrderItemRow[],
  replacement?: OrderItemRow,
): number {
  const subtotal = items.reduce((sum, item) => {
    const row = replacement && item.id === replacement.id ? replacement : item
    return sum + row.price
  }, 0)

  const bonusBani = bonusesRedeemedToBani(order.bonuses_redeemed)
  return Math.max(0, subtotal - order.discount + order.delivery_fee - bonusBani)
}

async function loadOrder(orderId: string): Promise<OrderRow | null> {
  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, delivery_fee, discount, bonuses_redeemed, order_items(id, quantity, price)",
    )
    .eq("id", orderId)
    .maybeSingle()

  if (error) {
    console.error("[updateOrderItems] load order", error.message)
    return null
  }

  return data as OrderRow | null
}

export async function updateOrderItemQuantityPos({
  orderId,
  itemId,
  quantity,
}: {
  orderId: string
  itemId: string
  quantity: number
}): Promise<UpdateOrderItemsResult> {
  const staff = await getCurrentStaff()
  if (!staff) return { success: false, error: "Сессия кассира недействительна" }

  const nextQuantity = Math.round(quantity)
  if (nextQuantity < 1) {
    return { success: false, error: "Количество должно быть больше нуля" }
  }

  const order = await loadOrder(orderId)
  const items = order?.order_items ?? []
  const item = items.find((row) => row.id === itemId)
  if (!order || !item) return { success: false, error: "Позиция не найдена" }

  const nextItem: OrderItemRow = {
    ...item,
    quantity: nextQuantity,
    price: itemUnitPriceBani(item) * nextQuantity,
  }
  const supabase = createServiceRoleClient()

  const { error: itemError } = await supabase
    .from("order_items")
    .update({ quantity: nextItem.quantity, price: nextItem.price })
    .eq("id", itemId)
    .eq("order_id", orderId)

  if (itemError) {
    console.error("[updateOrderItems] quantity", itemError.message)
    return { success: false, error: "Не удалось обновить позицию" }
  }

  const { error: orderError } = await supabase
    .from("orders")
    .update({
      total: nextTotalBani(order, items, nextItem),
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId)

  if (orderError) {
    console.error("[updateOrderItems] order total", orderError.message)
    return { success: false, error: "Не удалось обновить сумму заказа" }
  }

  await refreshCourierOrderTelegramMessage(orderId, "items")

  return { success: true }
}

export async function removeOrderItemPos({
  orderId,
  itemId,
}: {
  orderId: string
  itemId: string
}): Promise<UpdateOrderItemsResult> {
  const staff = await getCurrentStaff()
  if (!staff) return { success: false, error: "Сессия кассира недействительна" }

  const order = await loadOrder(orderId)
  const items = order?.order_items ?? []
  const item = items.find((row) => row.id === itemId)
  if (!order || !item) return { success: false, error: "Позиция не найдена" }

  const nextItems = items.filter((row) => row.id !== itemId)
  const supabase = createServiceRoleClient()

  const { error: itemError } = await supabase
    .from("order_items")
    .delete()
    .eq("id", itemId)
    .eq("order_id", orderId)

  if (itemError) {
    console.error("[updateOrderItems] remove", itemError.message)
    return { success: false, error: "Не удалось удалить позицию" }
  }

  const { error: orderError } = await supabase
    .from("orders")
    .update({
      total: nextTotalBani(order, nextItems),
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId)

  if (orderError) {
    console.error("[updateOrderItems] order total", orderError.message)
    return { success: false, error: "Не удалось обновить сумму заказа" }
  }

  await refreshCourierOrderTelegramMessage(orderId, "items")

  return { success: true }
}

type PosOrderTotalsRow = {
  id: string
  delivery_mode: "delivery" | "pickup" | "aggregator"
  delivery_fee: number
  discount: number
  bonuses_redeemed: number | null
  order_items: OrderItemRow[] | null
}

function isAggregatorDeliveryMode(
  mode: string | null | undefined,
): boolean {
  return mode === "aggregator"
}

function orderItemInsertsFromCartLines(
  orderId: string,
  lines: PosCartItem[],
  isAggregator: boolean,
) {
  return lines.map((cartItem) => {
    const line = posLinePayloadFromCartItem(cartItem, isAggregator)
    return {
      order_id: orderId,
      menu_item_id: line.menuItemId,
      variant_id: line.variantId ?? null,
      lunch_set_id: null as string | null,
      item_name: line.name,
      size: line.size,
      quantity: line.qty,
      toppings: line.toppings,
      price: Math.round(line.unitPriceBani) * line.qty,
    }
  })
}

async function loadOrderForTotals(orderId: string): Promise<PosOrderTotalsRow | null> {
  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, delivery_mode, delivery_fee, discount, bonuses_redeemed, order_items(id, quantity, price)",
    )
    .eq("id", orderId)
    .maybeSingle()

  if (error) {
    console.error("[updateOrderItems] load order totals", error.message)
    return null
  }

  return data as PosOrderTotalsRow | null
}

function recomputedTotalBani(order: PosOrderTotalsRow, items: OrderItemRow[]): number {
  const subtotal = items.reduce((sum, row) => sum + row.price, 0)
  const bonusBani = bonusesRedeemedToBani(order.bonuses_redeemed)
  return Math.max(0, subtotal - order.discount + order.delivery_fee - bonusBani)
}

/** Дополнительные строки к уже сохранённому заказу (шаг POS «добавить к заказу»). */
export async function addOrderItemsPos({
  orderId,
  lines,
}: {
  orderId: string
  lines: PosCartItem[]
}): Promise<UpdateOrderItemsResult> {
  const staff = await getCurrentStaff()
  if (!staff) return { success: false, error: "Сессия кассира недействительна" }

  if (!lines.length) {
    return { success: false, error: "Нет позиций для добавления" }
  }

  const order = await loadOrderForTotals(orderId)
  if (!order) return { success: false, error: "Заказ не найден" }

  const isAggregator = isAggregatorDeliveryMode(order.delivery_mode)
  const inserts = orderItemInsertsFromCartLines(orderId, lines, isAggregator)

  const supabase = createServiceRoleClient()

  const { error: insertError } = await supabase.from("order_items").insert(inserts)

  if (insertError) {
    console.error("[updateOrderItems] add items", insertError.message)
    return { success: false, error: "Не удалось добавить позиции" }
  }

  const { data: refreshed, error: refreshError } = await supabase
    .from("orders")
    .select(
      "id, delivery_mode, delivery_fee, discount, bonuses_redeemed, order_items(id, quantity, price)",
    )
    .eq("id", orderId)
    .maybeSingle()

  if (refreshError || !refreshed) {
    console.error("[updateOrderItems] refresh after add", refreshError?.message)
    return { success: false, error: "Не удалось пересчитать заказ" }
  }

  const row = refreshed as PosOrderTotalsRow
  const total = recomputedTotalBani(row, row.order_items ?? [])

  const { error: orderError } = await supabase
    .from("orders")
    .update({
      total,
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId)

  if (orderError) {
    console.error("[updateOrderItems] total after add", orderError.message)
    return { success: false, error: "Не удалось обновить сумму заказа" }
  }

  await refreshCourierOrderTelegramMessage(orderId, "items")

  return { success: true }
}

/**
 * Полная замена строк заказа (мастер POS: сохранение шага «Оформление»).
 * Пустой `lines` очищает корзину в БД и пересчитывает total.
 */
export async function replaceOrderItemsPos({
  orderId,
  lines,
}: {
  orderId: string
  lines: PosCartItem[]
}): Promise<UpdateOrderItemsResult> {
  const staff = await getCurrentStaff()
  if (!staff) return { success: false, error: "Сессия кассира недействительна" }

  const order = await loadOrderForTotals(orderId)
  if (!order) return { success: false, error: "Заказ не найден" }

  const isAggregator = isAggregatorDeliveryMode(order.delivery_mode)
  const supabase = createServiceRoleClient()

  const { error: deleteError } = await supabase
    .from("order_items")
    .delete()
    .eq("order_id", orderId)

  if (deleteError) {
    console.error("[updateOrderItems] replace delete", deleteError.message)
    return { success: false, error: "Не удалось обновить позиции заказа" }
  }

  if (lines.length > 0) {
    const inserts = orderItemInsertsFromCartLines(orderId, lines, isAggregator)

    const { error: insertError } = await supabase.from("order_items").insert(inserts)

    if (insertError) {
      console.error("[updateOrderItems] replace insert", insertError.message)
      return { success: false, error: "Не удалось сохранить позиции" }
    }
  }

  const { data: refreshed, error: refreshError } = await supabase
    .from("orders")
    .select(
      "id, delivery_fee, discount, bonuses_redeemed, order_items(id, quantity, price)",
    )
    .eq("id", orderId)
    .maybeSingle()

  if (refreshError || !refreshed) {
    console.error("[updateOrderItems] replace refresh", refreshError?.message)
    return { success: false, error: "Не удалось пересчитать заказ" }
  }

  const row = refreshed as PosOrderTotalsRow
  const total = recomputedTotalBani(row, row.order_items ?? [])

  const { error: orderError } = await supabase
    .from("orders")
    .update({
      total,
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId)

  if (orderError) {
    console.error("[updateOrderItems] replace total", orderError.message)
    return { success: false, error: "Не удалось обновить сумму заказа" }
  }

  await refreshCourierOrderTelegramMessage(orderId, "items")

  return { success: true }
}

/** Замена состава строки заказа (размер, топпинги, количество, цена за единицу). */
export async function updateOrderItemCompositionPos({
  orderId,
  itemId,
  cartItem,
}: {
  orderId: string
  itemId: string
  cartItem: PosCartItem
}): Promise<UpdateOrderItemsResult> {
  const staff = await getCurrentStaff()
  if (!staff) return { success: false, error: "Сессия кассира недействительна" }

  const nextQuantity = Math.round(cartItem.qty)
  if (nextQuantity < 1) {
    return { success: false, error: "Количество должно быть больше нуля" }
  }

  const order = await loadOrderForTotals(orderId)
  const items = order?.order_items ?? []
  const exists = items.some((row) => row.id === itemId)
  if (!order || !exists) return { success: false, error: "Позиция не найдена" }

  const isAggregator = isAggregatorDeliveryMode(order.delivery_mode)
  const line = posLinePayloadFromCartItem(cartItem, isAggregator)
  const unit = Math.round(line.unitPriceBani)
  if (unit < 1) return { success: false, error: "Некорректная цена" }

  const linePrice = unit * nextQuantity
  const supabase = createServiceRoleClient()

  const { error: itemError } = await supabase
    .from("order_items")
    .update({
      menu_item_id: line.menuItemId,
      variant_id: line.variantId ?? null,
      item_name: line.name,
      size: line.size,
      quantity: nextQuantity,
      toppings: line.toppings,
      price: linePrice,
    })
    .eq("id", itemId)
    .eq("order_id", orderId)

  if (itemError) {
    console.error("[updateOrderItems] composition", itemError.message)
    return { success: false, error: "Не удалось обновить позицию" }
  }

  const { data: refreshed, error: refreshError } = await supabase
    .from("orders")
    .select(
      "id, delivery_fee, discount, bonuses_redeemed, order_items(id, quantity, price)",
    )
    .eq("id", orderId)
    .maybeSingle()

  if (refreshError || !refreshed) {
    return { success: false, error: "Не удалось пересчитать заказ" }
  }

  const row = refreshed as PosOrderTotalsRow
  const total = recomputedTotalBani(row, row.order_items ?? [])

  const { error: orderError } = await supabase
    .from("orders")
    .update({
      total,
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId)

  if (orderError) {
    console.error("[updateOrderItems] total after composition", orderError.message)
    return { success: false, error: "Не удалось обновить сумму заказа" }
  }

  await refreshCourierOrderTelegramMessage(orderId, "items")

  return { success: true }
}
