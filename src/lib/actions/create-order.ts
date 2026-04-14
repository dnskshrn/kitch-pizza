"use server"

import { getCartItemPrice, type CartLang } from "@/lib/cart-helpers"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import type { CartItem } from "@/types/cart"

export type CreateOrderPayload = {
  lang: CartLang
  userName: string
  userPhone: string
  deliveryMode: "delivery" | "pickup"
  /** Полная строка адреса / самовывоза для сохранения в БД */
  deliveryAddress: string
  paymentMethod: "cash" | "card"
  changeFromBani: number | null
  deliveryTimeMode: "asap" | "scheduled"
  /** При scheduled — время слота вида HH:mm */
  scheduledTimeSlot: string | null
  comment: string | null
  promoCode: string | null
  subtotalBani: number
  discountBani: number
  deliveryFeeBani: number
  grandTotalBani: number
  items: CartItem[]
}

export type CreateOrderResult =
  | { success: true; orderNumber: number }
  | { success: false; error: string }

function toppingsPayload(cartItem: CartItem, lang: CartLang) {
  return cartItem.selectedToppingIds
    .map((id) => {
      const t = cartItem.toppingsList.find((x) => x.id === id)
      if (!t) return null
      return {
        name: lang === "RO" ? t.name_ro : t.name_ru,
        price: t.price,
      }
    })
    .filter((x): x is { name: string; price: number } => x != null)
}

function sizeForOrderItem(cartItem: CartItem): "s" | "l" | null {
  if (!cartItem.menuItem.has_sizes) return null
  if (cartItem.selectedSize === "l" || cartItem.selectedSize === "s") {
    return cartItem.selectedSize
  }
  return null
}

export async function createOrder(
  payload: CreateOrderPayload,
): Promise<CreateOrderResult> {
  const phone = payload.userPhone.trim()
  const name = payload.userName.trim()
  if (!name) {
    return { success: false, error: "Укажите имя" }
  }
  if (!phone) {
    return { success: false, error: "Укажите телефон" }
  }
  if (!payload.items.length) {
    return { success: false, error: "Корзина пуста" }
  }

  const scheduledTime =
    payload.deliveryTimeMode === "asap"
      ? "asap"
      : (payload.scheduledTimeSlot?.trim() ?? null)

  let supabase
  try {
    supabase = createServiceRoleClient()
  } catch {
    return { success: false, error: "Сервер временно недоступен" }
  }

  const insertRow = {
    user_name: name,
    user_phone: phone,
    status: "new" as const,
    delivery_mode: payload.deliveryMode,
    delivery_address: payload.deliveryAddress.trim(),
    payment_method: payload.paymentMethod,
    change_from: payload.changeFromBani,
    total: payload.grandTotalBani,
    delivery_fee: payload.deliveryFeeBani,
    discount: payload.discountBani,
    promo_code: payload.promoCode?.trim() || null,
    scheduled_time: scheduledTime,
    comment: payload.comment?.trim() || null,
  }

  const { data: orderRow, error: orderError } = await supabase
    .from("orders")
    .insert(insertRow)
    .select("id, order_number")
    .single()

  if (orderError || !orderRow) {
    console.error("[createOrder] orders insert", orderError?.message)
    return { success: false, error: "Не удалось сохранить заказ" }
  }

  const orderId = orderRow.id as string
  const orderNumber = orderRow.order_number as number
  const lang = payload.lang

  const rows = payload.items.map((ci) => {
    const unitBani = getCartItemPrice(ci)
    const lineTotalBani = unitBani * ci.quantity
    return {
      order_id: orderId,
      menu_item_id: ci.menuItem.id,
      lunch_set_id: null as string | null,
      item_name:
        lang === "RO" ? ci.menuItem.name_ro : ci.menuItem.name_ru,
      size: sizeForOrderItem(ci),
      quantity: ci.quantity,
      toppings: toppingsPayload(ci, lang),
      price: lineTotalBani,
    }
  })

  const { error: itemsError } = await supabase.from("order_items").insert(rows)

  if (itemsError) {
    console.error("[createOrder] order_items insert", itemsError.message)
    await supabase.from("orders").delete().eq("id", orderId)
    return { success: false, error: "Не удалось сохранить состав заказа" }
  }

  return { success: true, orderNumber }
}
