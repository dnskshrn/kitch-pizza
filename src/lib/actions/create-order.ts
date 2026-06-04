"use server"

import { geocodeAddress } from "@/lib/actions/check-delivery-zone"
import type { CartLang } from "@/lib/cart-helpers"
import { migrateCartToppingsFromLegacy } from "@/lib/cart-toppings"
import { redeemBonus } from "@/lib/bonus"
import { getBrandId } from "@/lib/get-brand-id"
import { getMessages, promoErrorMessage } from "@/lib/i18n/storefront"
import {
  calculateOrderPricing,
  type CartItem as PricingCartItem,
} from "@/lib/pricing"
import { createServiceSupabaseClient } from "@/lib/supabase/server"
import type { CartItem } from "@/types/cart"
import type { PromoCodeValidationError } from "@/types/database"

export type CreateOrderPayload = {
  lang: CartLang
  userName: string
  userPhone: string
  deliveryMode: "delivery" | "pickup"
  /** Полная строка адреса / самовывоза для сохранения в БД */
  deliveryAddress: string
  paymentMethod: "cash" | "card" | "online_card"
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
  /** Пункты лояльности, вычтенные из итога (1 п. = 100 bani); итог уже с вычетом в `grandTotalBani`. */
  bonuses_redeemed?: number
  /** Профиль витрины (если пользователь залогинен); нужен для списания бонусов при создании заказа. */
  profile_id?: string | null
  /** Координаты доставки (карта / геокод); при отсутствии — best-effort геокод по строке адреса. */
  delivery_lat?: number | null
  delivery_lng?: number | null
}

export type CreateOrderResult =
  | { success: true; orderNumber: number; orderId: string }
  | { success: false; error: string }

function toppingsPayload(cartItem: CartItem, lang: CartLang) {
  return migrateCartToppingsFromLegacy(cartItem).map((t) => ({
    id: t.id,
    name: lang === "RO" ? t.name_ro : t.name_ru,
    price: t.price,
    quantity: t.quantity,
  }))
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

function storefrontItemsToPricingItems(items: CartItem[]): PricingCartItem[] {
  return items.map((ci) => ({
    menu_item_id: ci.menuItem.id,
    quantity: ci.quantity,
    ...(ci.variantId ? { variant_id: ci.variantId } : {}),
  }))
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

function formatTelegramMdl(bani: number): string {
  return (Math.round(bani) / 100).toLocaleString("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
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
  /** Пункты лояльности, списанные при оформлении (1 п. = 100 бани). */
  bonusesRedeemed?: number
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
  if (!token || !chatId) {
    console.error("[createOrder] telegram env is not configured")
    return
  }

  const modeLabel =
    order.deliveryMode === "pickup" ? "🏃 Самовывоз" : "🚗 Доставка"
  const payLabel =
    order.paymentMethod === "card"
      ? "💳 Карта"
      : order.paymentMethod === "online_card"
        ? "💳 Онлайн"
        : "💵 Наличные"
  const itemLines = order.items
    .map(
      (i) =>
        `• ${i.item_name}${i.size ? ` (${i.size})` : ""} × ${i.quantity} — ${((i.price * i.quantity) / 100).toFixed(0)} MDL`,
    )
    .join("\n")

  const payableBani = Math.max(0, Math.round(order.total))
  const discountBani = Math.max(0, Math.round(order.discount))
  const bonusPts = Math.max(
    0,
    Math.floor(Number(order.bonusesRedeemed ?? 0) || 0),
  )

  const summaryPieces: string[] = []

  if (discountBani > 0) {
    const afterDiscountBani = Math.max(0, payableBani - discountBani)
    summaryPieces.push(
      `💰 После скидки: ${formatTelegramMdl(afterDiscountBani)} MDL`,
    )
  }
  if (bonusPts > 0) {
    summaryPieces.push(`🎁 Бонусы: -${bonusPts} MDL`)
  }
  /** Итого в заказе (уже с учётом скидки, доставки и бонусов). */
  summaryPieces.push(`💳 К оплате: ${formatTelegramMdl(payableBani)} MDL`)

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
    order.deliveryFee > 0
      ? `🚚 Доставка: ${formatTelegramMdl(order.deliveryFee)} MDL`
      : null,
    summaryPieces.join("\n"),
  ]
    .filter(Boolean)
    .join("\n")

  const response = await fetch(
    `https://api.telegram.org/bot${token}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    },
  )

  if (!response.ok) {
    const body = await response.text().catch(() => "")
    console.error(
      "[createOrder] telegram sendMessage",
      response.status,
      body,
    )
  }
}

function orderItemSizeForTelegram(
  size: string | null | undefined,
): string | undefined {
  if (typeof size !== "string" || size.length === 0) return undefined
  const lower = size.toLowerCase()
  if (lower === "s" || lower === "l") {
    return lower === "s" ? "S" : "L"
  }
  return size
}

export async function sendNewOrderTelegramNotification(
  orderId: string,
): Promise<void> {
  const supabase = createServiceSupabaseClient()

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select(
      "order_number, user_phone, user_name, delivery_address, delivery_mode, payment_method, total, discount, delivery_fee, bonuses_redeemed, comment, brand_id, brands(name)",
    )
    .eq("id", orderId)
    .maybeSingle()

  if (orderError || !order) {
    console.error(
      "[sendNewOrderTelegramNotification] order fetch",
      orderError?.message ?? "not found",
    )
    return
  }

  const { data: itemRows, error: itemsError } = await supabase
    .from("order_items")
    .select("item_name, quantity, price, size")
    .eq("order_id", orderId)

  if (itemsError) {
    console.error(
      "[sendNewOrderTelegramNotification] order_items",
      itemsError.message,
    )
    return
  }

  const brandJoin = order.brands as { name: string } | { name: string }[] | null
  const brandName = Array.isArray(brandJoin)
    ? (brandJoin[0]?.name ?? "Заказ")
    : (brandJoin?.name ?? "Заказ")

  await sendTelegramNotification({
    orderNumber: order.order_number as number,
    brandName,
    userPhone: (order.user_phone as string) ?? "",
    userName: (order.user_name as string | null) ?? null,
    deliveryAddress: (order.delivery_address as string) ?? "",
    deliveryMode: order.delivery_mode as string,
    paymentMethod: order.payment_method as string,
    total: Number(order.total),
    discount: Number(order.discount),
    deliveryFee: Number(order.delivery_fee),
    bonusesRedeemed: Number(order.bonuses_redeemed ?? 0),
    comment: (order.comment as string | null) ?? null,
    items: (itemRows ?? []).map((row) => {
      const qty = Math.max(1, Number(row.quantity))
      const unitBani = Math.round(Number(row.price) / qty)
      const sizeTelegram = orderItemSizeForTelegram(
        row.size as string | null | undefined,
      )
      return {
        item_name: row.item_name as string,
        quantity: qty,
        price: unitBani,
        ...(sizeTelegram ? { size: sizeTelegram } : {}),
      }
    }),
  })
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

  const profileId = payload.profile_id?.trim() || null
  const deliveryFeeBani =
    payload.deliveryMode === "pickup" ? 0 : payload.deliveryFeeBani

  let pricing
  try {
    pricing = await calculateOrderPricing(supabase, {
      cartItems: storefrontItemsToPricingItems(payload.items),
      brandId,
      promoCode: payload.promoCode,
      profileId,
      bonusesRequested: profileId ? (payload.bonuses_redeemed ?? 0) : 0,
      deliveryFeeBani,
    })
  } catch (e) {
    console.error(
      "[createOrder] pricing",
      e instanceof Error ? e.message : e,
    )
    return { success: false, error: t.orderErrors.serverUnavailable }
  }

  if (payload.promoCode?.trim() && pricing.promo_error) {
    return {
      success: false,
      error: promoErrorMessage(
        { code: pricing.promo_error as PromoCodeValidationError },
        payload.lang,
      ),
    }
  }

  const orderDiscountBani =
    pricing.item_discount_bani + pricing.promo_discount_bani
  const promoCodeSaved =
    pricing.promo_code_id != null
      ? payload.promoCode?.trim().toUpperCase() ?? null
      : null

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
    total: pricing.total_bani,
    subtotal: pricing.subtotal_bani,
    item_discount: pricing.item_discount_bani,
    promo_discount: pricing.promo_discount_bani,
    discount: orderDiscountBani,
    discount_rules_applied: pricing.discount_rules_applied,
    delivery_fee: pricing.delivery_fee_bani,
    promo_code: promoCodeSaved,
    scheduled_time: scheduledTime,
    comment: payload.comment?.trim() || null,
    bonuses_redeemed: pricing.bonuses_redeemed,
    bonuses_earned: 0,
    profile_id: profileId,
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

  const rows = payload.items.map((ci, index) => {
    const priced = pricing.items[index]
    if (!priced) {
      throw new Error("[createOrder] pricing items count mismatch")
    }
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
      price: priced.price_bani * priced.quantity,
      original_price: priced.original_price_bani * priced.quantity,
      item_discount_pct: priced.item_discount_pct,
    }
  })

  const { error: itemsError } = await supabase
    .from("order_items")
    .insert(rows)

  if (itemsError) {
    console.error("[createOrder] order_items insert", itemsError.message)
    await supabase
      .from("orders")
      .delete()
      .eq("id", orderId)
      .eq("brand_id", brandId)
    return { success: false, error: t.orderErrors.saveItemsFailed }
  }

  const pid = profileId
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

  const redeemed = pricing.bonuses_redeemed
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

  if (insertRow.payment_method !== "online_card") {
    try {
      await sendNewOrderTelegramNotification(orderId)
    } catch (e) {
      console.error(
        "[createOrder] telegram notification",
        e instanceof Error ? e.message : e,
      )
    }
  }

  return { success: true, orderNumber, orderId }
}

export async function createOrder(
  payload: CreateOrderPayload,
): Promise<CreateOrderResult> {
  return executeCreateOrder(payload, getBrandId)
}
