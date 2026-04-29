"use server"

import { getCurrentStaff } from "@/lib/actions/pos/auth"
import { createServiceRoleClient } from "@/lib/supabase/service-role"

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
  order_items: OrderItemRow[] | null
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

  return Math.max(0, subtotal - order.discount + order.delivery_fee)
}

async function loadOrder(orderId: string): Promise<OrderRow | null> {
  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from("orders")
    .select("id, delivery_fee, discount, order_items(id, quantity, price)")
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
  if (items.length <= 1) {
    return { success: false, error: "В заказе должна остаться хотя бы одна позиция" }
  }

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

  return { success: true }
}
