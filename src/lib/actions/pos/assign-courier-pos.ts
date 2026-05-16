"use server"

import { checkDeliveryZoneByAddress } from "@/lib/actions/pos/check-delivery-zone-pos"
import { sendMessage } from "@/lib/telegram/bot"
import { createServiceSupabaseClient } from "@/lib/supabase/server"

type OrderNotifyFields = {
  order_number: number
  total: number
  user_name: string | null
  delivery_address: string | null
  delivery_lat: number | null
  delivery_lng: number | null
  address_floor: string | null
  address_apartment: string | null
  address_entrance: string | null
  address_intercom: string | null
  user_phone: string | null
  payment_method: "cash" | "card" | null
  change_from: number | null
  order_items: OrderNotifyItem[] | null
  brands: { slug: string | null } | { slug: string | null }[] | null
}

type OrderNotifyItem = {
  item_name: string | null
  quantity: number | null
  price: number | null
}

function buildCourierMapButtons(row: OrderNotifyFields) {
  const lat = row.delivery_lat
  const lng = row.delivery_lng
  const hasCoords =
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng)
  const addressDestination = row.delivery_address?.trim()
    ? `${row.delivery_address.trim()}, Chișinău, Moldova`
    : ""
  const destination = hasCoords ? `${lat},${lng}` : addressDestination

  if (!destination) return undefined

  const encodedDestination = encodeURIComponent(destination)
  const yandexUrl = hasCoords
    ? `https://yandex.com/maps/?ll=${lng},${lat}&pt=${lng},${lat},pm2rdm&z=17&rtext=~${lat},${lng}&rtt=auto`
    : `https://yandex.com/maps/?text=${encodedDestination}`

  return {
    inline_keyboard: [
      [
        {
          text: "Google Maps",
          url: `https://www.google.com/maps/dir/?api=1&destination=${encodedDestination}`,
        },
        {
          text: "Yandex Maps",
          url: yandexUrl,
        },
      ],
    ],
  }
}

function orderBrandSlug(row: OrderNotifyFields): string | null {
  const brands = row.brands
  if (Array.isArray(brands)) return brands[0]?.slug?.trim() || null
  return brands?.slug?.trim() || null
}

async function withResolvedDeliveryCoords(
  row: OrderNotifyFields,
): Promise<OrderNotifyFields> {
  const lat = row.delivery_lat
  const lng = row.delivery_lng
  if (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng)
  ) {
    return row
  }

  const address = row.delivery_address?.trim()
  const brandSlug = orderBrandSlug(row)
  if (!address || !brandSlug) return row

  const result = await checkDeliveryZoneByAddress(address, brandSlug)
  if (result.status !== "in_zone" && result.status !== "out_of_zone") return row

  return {
    ...row,
    delivery_lat: result.lat,
    delivery_lng: result.lng,
  }
}

function paymentMethodLabel(row: OrderNotifyFields): string {
  if (row.payment_method === "card") return "Картой"
  if (row.payment_method === "cash") {
    return row.change_from != null && row.change_from > 0
      ? `Наличными, сдача с ${(row.change_from / 100).toFixed(0)} MDL`
      : "Наличными"
  }
  return "Не указан"
}

function orderItemsLines(items: OrderNotifyItem[] | null): string[] {
  const rows = (items ?? []).filter((item) => item.item_name?.trim())
  if (!rows.length) return ["—"]

  return rows.map((item) => {
    const qty = Math.max(1, Math.round(item.quantity ?? 1))
    const price = Math.max(0, Math.round(item.price ?? 0))
    const priceText = price > 0 ? ` — ${(price / 100).toFixed(0)} MDL` : ""
    return `• ${qty} x ${item.item_name?.trim()}${priceText}`
  })
}

function buildCourierAssignmentMessage(row: OrderNotifyFields): string {
  const addressParts = [
    row.delivery_address ?? "—",
    row.address_entrance ? `, подъезд ${row.address_entrance}` : "",
    row.address_floor ? `, эт. ${row.address_floor}` : "",
    row.address_apartment ? `, кв. ${row.address_apartment}` : "",
    row.address_intercom ? `, домофон ${row.address_intercom}` : "",
  ].join("")

  return [
    `🛵 Новый заказ #${row.order_number}`,
    "",
    `👤 ${row.user_name?.trim() || "Клиент не указан"}`,
    `💳 ${paymentMethodLabel(row)}`,
    "",
    `📍 ${addressParts}`,
    `📞 ${row.user_phone ?? "не указан"}`,
    `💵 ${(row.total / 100).toFixed(0)} MDL`,
    "",
    "Состав заказа:",
    ...orderItemsLines(row.order_items),
  ].join("\n")
}

async function notifyCourierTelegramIfLinked(
  tgChatId: string | null | undefined,
  row: OrderNotifyFields,
): Promise<void> {
  if (!tgChatId) return
  const rowWithCoords = await withResolvedDeliveryCoords(row)
  const text = buildCourierAssignmentMessage(rowWithCoords)
  const replyMarkup = buildCourierMapButtons(rowWithCoords)
  try {
    await sendMessage(tgChatId, text, replyMarkup)
  } catch {
    // Не блокируем: заказ уже назначен даже если Telegram недоступен
  }
}

export async function assignCourierPos({
  orderId,
  courierId,
}: {
  orderId: string
  courierId: string
}): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const supabase = createServiceSupabaseClient()

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select(
        "id, status, order_number, total, user_name, delivery_address, delivery_lat, delivery_lng, address_floor, address_apartment, address_entrance, address_intercom, user_phone, payment_method, change_from, brands(slug), order_items(item_name, quantity, price)",
      )
      .eq("id", orderId)
      .maybeSingle()

    if (orderError || !order) {
      return { success: false, error: "Заказ не найден" }
    }
    if (order.status !== "ready") {
      return {
        success: false,
        error: 'Заказ не в статусе "Готов"',
      }
    }

    const { data: courier, error: courierError } = await supabase
      .from("staff")
      .select("id, name, tg_chat_id")
      .eq("id", courierId)
      .maybeSingle()

    if (courierError || !courier) {
      return { success: false, error: "Курьер не найден" }
    }

    const { error: updateError } = await supabase
      .from("orders")
      .update({
        status: "delivery",
        courier_id: courierId,
        courier_assigned_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId)

    if (updateError) {
      return { success: false, error: updateError.message }
    }

    const row = order as OrderNotifyFields
    await notifyCourierTelegramIfLinked(courier.tg_chat_id, row)

    return { success: true }
  } catch (e) {
    return {
      success: false,
      error:
        e instanceof Error ? e.message : "Неизвестная ошибка",
    }
  }
}

/** Смена курьера у заказа уже в доставке (без смены статуса). */
export async function changeCourierPos({
  orderId,
  courierId,
}: {
  orderId: string
  courierId: string
}): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const supabase = createServiceSupabaseClient()

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select(
        "id, status, delivery_mode, courier_id, order_number, total, user_name, delivery_address, delivery_lat, delivery_lng, address_floor, address_apartment, address_entrance, address_intercom, user_phone, payment_method, change_from, brands(slug), order_items(item_name, quantity, price)",
      )
      .eq("id", orderId)
      .maybeSingle()

    if (orderError || !order) {
      return { success: false, error: "Заказ не найден" }
    }

    const o = order as {
      status: string
      delivery_mode: string
      courier_id: string | null
    }

    if (o.status !== "delivery") {
      return { success: false, error: "Курьера можно сменить только у заказа в доставке" }
    }
    if (o.delivery_mode !== "delivery") {
      return { success: false, error: "Курьер только для заказов с доставкой" }
    }
    if (o.courier_id == null) {
      return { success: false, error: "Курьер ещё не назначен" }
    }
    if (o.courier_id === courierId) {
      return { success: true }
    }

    const { data: newCourier, error: newCourierError } = await supabase
      .from("staff")
      .select("id, name, tg_chat_id")
      .eq("id", courierId)
      .maybeSingle()

    if (newCourierError || !newCourier) {
      return { success: false, error: "Курьер не найден" }
    }

    const { error: updateError } = await supabase
      .from("orders")
      .update({
        courier_id: courierId,
        courier_assigned_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId)

    if (updateError) {
      return { success: false, error: updateError.message }
    }

    const row = order as OrderNotifyFields
    await notifyCourierTelegramIfLinked(newCourier.tg_chat_id, row)

    return { success: true }
  } catch (e) {
    return {
      success: false,
      error:
        e instanceof Error ? e.message : "Неизвестная ошибка",
    }
  }
}
