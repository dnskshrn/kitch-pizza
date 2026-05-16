"use server"

import { geocodeAddress } from "@/lib/actions/check-delivery-zone"
import { getCartItemPrice, type CartLang } from "@/lib/cart-helpers"
import { redeemBonus } from "@/lib/bonus"
import { getBrandId } from "@/lib/get-brand-id"
import { getMessages } from "@/lib/i18n/storefront"
import { createServiceSupabaseClient } from "@/lib/supabase/server"
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
  condimentOrderLines?: Array<{
    menu_item_id: string
    item_name: string
    quantity: number
    price: number
  }>
  /** Пункты лояльности, вычтенные из итога (1 п. = 100 bani); итог уже с вычетом в `grandTotalBani`. */
  bonuses_redeemed?: number
  /** Профиль витрины (если пользователь залогинен); нужен для списания бонусов при создании заказа. */
  profile_id?: string | null
  /** Координаты доставки (карта / геокод); при отсутствии — best-effort геокод по строке адреса. */
  delivery_lat?: number | null
  delivery_lng?: number | null
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

function orderItemSizeAndVariantForInsert(ci: CartItem): {
  size: string | null
  variant_id: string | null
} {
  if (!ci.menuItem.has_sizes) {
    return { size: null, variant_id: null }
  }
  if (ci.variantId) {
    return {
      size: ci.variantNameSnapshot?.trim() || null,
      variant_id: ci.variantId,
    }
  }
  if (ci.selectedSize === "s" || ci.selectedSize === "l") {
    return { size: ci.selectedSize, variant_id: null }
  }
  return { size: null, variant_id: null }
}

function deliveryCoordsAreUsable(
  lat: number | null | undefined,
  lng: number | null | undefined,
): boolean {
  return (
    lat != null &&
    lng != null &&
    Number.isFinite(Number(lat)) &&
    Number.isFinite(Number(lng))
  )
}

async function sendTelegramNotification(order: {
  orderNumber: number
  brandName: string
  userPhone: string
  userName: string | null
  deliveryAddress: string
  deliveryMode: string
  paymentMethod: string
  total: number
  discount: number
  deliveryFee: number
  comment: string | null
  items: Array<{
    item_name: string
    quantity: number
    price: number
    size?: string
  }>
}) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID
  if (!token || !chatId) return

  const modeLabel =
    order.deliveryMode === "pickup" ? "🏃 Самовывоз" : "🚗 Доставка"
  const payLabel =
    order.paymentMethod === "card" ? "💳 Карта" : "💵 Наличные"
  const itemLines = order.items
    .map(
      (i) =>
        `• ${i.item_name}${i.size ? ` (${i.size})` : ""} × ${i.quantity} — ${((i.price * i.quantity) / 100).toFixed(0)} MDL`,
    )
    .join("\n")

  const text = [
    `🆕 Заказ #${order.orderNumber} — ${order.brandName}`,
    ``,
    `👤 ${order.userName || "Без имени"} | 📞 ${order.userPhone}`,
    `${modeLabel} | ${payLabel}`,
    order.deliveryMode !== "pickup" ? `📍 ${order.deliveryAddress}` : null,
    order.comment ? `💬 ${order.comment}` : null,
    ``,
    itemLines,
    ``,
    order.discount > 0
      ? `🏷 Скидка: -${(order.discount / 100).toFixed(0)} MDL`
      : null,
    order.deliveryFee > 0
      ? `🚚 Доставка: ${(order.deliveryFee / 100).toFixed(0)} MDL`
      : null,
    `💰 Итого: ${(order.total / 100).toFixed(0)} MDL`,
  ]
    .filter(Boolean)
    .join("\n")

  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
  }).catch(() => {}) // не блокируем заказ если телеграм недоступен
}

/** Витрина: `resolveBrandId` = getBrandId; админ/POS: getAdminBrandId. */
export async function executeCreateOrder(
  payload: CreateOrderPayload,
  resolveBrandId: () => Promise<string>,
): Promise<CreateOrderResult> {
  const phone = payload.userPhone.trim()
  const name = payload.userName.trim()
  const t = getMessages(payload.lang)
  if (!name) {
    return { success: false, error: t.orderErrors.nameRequired }
  }
  if (!phone) {
    return { success: false, error: t.orderErrors.phoneRequired }
  }
  if (!payload.items.length) {
    return { success: false, error: t.orderErrors.emptyCart }
  }

  const scheduledTime =
    payload.deliveryTimeMode === "asap"
      ? "asap"
      : (payload.scheduledTimeSlot?.trim() ?? null)

  let supabase
  let brandId: string
  try {
    brandId = await resolveBrandId()
    supabase = createServiceSupabaseClient()
  } catch {
    return { success: false, error: t.orderErrors.serverUnavailable }
  }

  let delivery_lat: number | null = null
  let delivery_lng: number | null = null
  if (payload.deliveryMode === "delivery") {
    const latRaw = payload.delivery_lat
    const lngRaw = payload.delivery_lng
    if (deliveryCoordsAreUsable(latRaw, lngRaw)) {
      delivery_lat = Number(latRaw)
      delivery_lng = Number(lngRaw)
    } else {
      try {
        const hit = await geocodeAddress(payload.deliveryAddress)
        if (hit) {
          delivery_lat = hit.lat
          delivery_lng = hit.lng
        }
      } catch {
        delivery_lat = null
        delivery_lng = null
      }
    }
  }

  const insertRow = {
    brand_id: brandId,
    user_name: name,
    user_phone: phone,
    status: "new" as const,
    delivery_mode: payload.deliveryMode,
    delivery_address: payload.deliveryAddress.trim(),
    delivery_lat,
    delivery_lng,
    payment_method: payload.paymentMethod,
    change_from: payload.changeFromBani,
    total: payload.grandTotalBani,
    delivery_fee: payload.deliveryFeeBani,
    discount: payload.discountBani,
    promo_code: payload.promoCode?.trim() || null,
    scheduled_time: scheduledTime,
    comment: payload.comment?.trim() || null,
    bonuses_redeemed: payload.bonuses_redeemed ?? 0,
    bonuses_earned: 0,
    profile_id: payload.profile_id?.trim() || null,
  }

  const { data: orderRow, error: orderError } = await supabase
    .from("orders")
    .insert(insertRow)
    .select("id, order_number")
    .single()

  if (orderError || !orderRow) {
    console.error("[createOrder] orders insert", orderError?.message)
    return { success: false, error: t.orderErrors.saveOrderFailed }
  }

  const orderId = orderRow.id as string
  const orderNumber = orderRow.order_number as number
  const lang = payload.lang

  const rows = payload.items.map((ci) => {
    const unitBani = getCartItemPrice(ci)
    const lineTotalBani = unitBani * ci.quantity
    const { size, variant_id } = orderItemSizeAndVariantForInsert(ci)
    return {
      order_id: orderId,
      menu_item_id: ci.menuItem.id,
      lunch_set_id: null as string | null,
      variant_id,
      item_name:
        lang === "RO" ? ci.menuItem.name_ro : ci.menuItem.name_ru,
      size,
      quantity: ci.quantity,
      toppings: toppingsPayload(ci, lang),
      price: lineTotalBani,
    }
  })

  const condimentRows = (payload.condimentOrderLines ?? []).map((line) => ({
    order_id: orderId,
    menu_item_id: line.menu_item_id,
    lunch_set_id: null as string | null,
    variant_id: null as string | null,
    item_name: line.item_name,
    size: null as null,
    quantity: line.quantity,
    toppings: [] as { name: string; price: number }[],
    price: line.price,
  }))

  const { error: itemsError } = await supabase
    .from("order_items")
    .insert([...rows, ...condimentRows])

  if (itemsError) {
    console.error("[createOrder] order_items insert", itemsError.message)
    await supabase
      .from("orders")
      .delete()
      .eq("id", orderId)
      .eq("brand_id", brandId)
    return { success: false, error: t.orderErrors.saveItemsFailed }
  }

  const pid = payload.profile_id?.trim()
  if (pid && name) {
    try {
      const { error: profileNameError } = await supabase
        .from("profiles")
        .update({ name, updated_at: new Date().toISOString() })
        .eq("id", pid)
        .or("name.is.null,name.eq.")
      if (profileNameError) {
        console.error(
          "[createOrder] profile name backfill",
          profileNameError.message,
        )
      }
    } catch (e) {
      console.error(
        "[createOrder] profile name backfill",
        e instanceof Error ? e.message : e,
      )
    }
  }

  const redeemed = payload.bonuses_redeemed ?? 0
  if (redeemed > 0 && pid) {
    try {
      await redeemBonus(pid, orderId, redeemed)
    } catch (e) {
      console.error(
        "[createOrder] redeemBonus",
        e instanceof Error ? e.message : e,
      )
    }
  }

  const { data: brandRow } = await supabase
    .from("brands")
    .select("name")
    .eq("id", brandId)
    .maybeSingle()
  const brandName =
    (brandRow as { name: string } | null)?.name ?? "Заказ"

  void sendTelegramNotification({
    orderNumber,
    brandName,
    userPhone: phone,
    userName: name || null,
    deliveryAddress: payload.deliveryAddress.trim(),
    deliveryMode: payload.deliveryMode,
    paymentMethod: payload.paymentMethod,
    total: payload.grandTotalBani,
    discount: payload.discountBani,
    deliveryFee: payload.deliveryFeeBani,
    comment: payload.comment?.trim() ?? null,
    items: payload.items.map((ci) => {
      const unitBani = getCartItemPrice(ci)
      const { size } = orderItemSizeAndVariantForInsert(ci)
      let sizeTelegram: string | undefined
      if (typeof size === "string" && size.length > 0) {
        const lower = size.toLowerCase()
        if (lower === "s" || lower === "l") {
          sizeTelegram = lower === "s" ? "S" : "L"
        } else {
          sizeTelegram = size
        }
      }
      return {
        item_name:
          lang === "RO" ? ci.menuItem.name_ro : ci.menuItem.name_ru,
        quantity: ci.quantity,
        price: unitBani,
        ...(sizeTelegram ? { size: sizeTelegram } : {}),
      }
    }),
  }).catch(() => {})

  return { success: true, orderNumber }
}

export async function createOrder(
  payload: CreateOrderPayload,
): Promise<CreateOrderResult> {
  return executeCreateOrder(payload, getBrandId)
}
