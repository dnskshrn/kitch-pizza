import { checkDeliveryZoneByAddress } from "@/lib/actions/pos/check-delivery-zone-pos"
import { posCheckoutAddressFieldsFromOrder } from "@/lib/pos/split-composite-delivery-address"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { editMessageText, sendLocation, sendMessage } from "@/lib/telegram/bot"
import type { PaymentMethod } from "@/types/database"

export const COURIER_ORDER_ASSIGNMENT_SELECT =
  "id, status, delivery_mode, created_at, courier_id, order_number, total, delivery_fee, user_name, delivery_address, delivery_lat, delivery_lng, address_floor, address_apartment, address_entrance, address_intercom, user_phone, payment_method, change_from, brands(slug), order_items(item_name, quantity, price)"

export const COURIER_ORDER_TELEGRAM_SELECT =
  "id, status, delivery_mode, created_at, courier_id, courier_tg_chat_id, courier_tg_message_id, courier_tg_message_updated_at, order_number, total, delivery_fee, user_name, delivery_address, delivery_lat, delivery_lng, address_floor, address_apartment, address_entrance, address_intercom, user_phone, payment_method, change_from, brands(slug), order_items(item_name, quantity, price)"

export type CourierOrderTelegramFields = {
  id?: string
  status?: string | null
  delivery_mode?: string | null
  created_at?: string | null
  courier_id?: string | null
  courier_tg_chat_id?: string | null
  courier_tg_message_id?: number | string | null
  courier_tg_message_updated_at?: string | null
  order_number: number
  total: number
  delivery_fee: number
  user_name: string | null
  delivery_address: string | null
  delivery_lat: number | null
  delivery_lng: number | null
  address_floor: string | null
  address_apartment: string | null
  address_entrance: string | null
  address_intercom: string | null
  user_phone: string | null
  payment_method: PaymentMethod | null
  change_from: number | null
  order_items: CourierOrderTelegramItem[] | null
  brands: { slug: string | null } | { slug: string | null }[] | null
}

type CourierOrderTelegramItem = {
  item_name: string | null
  quantity: number | null
  price: number | null
}

export type SentCourierTelegramMessage = {
  chatId: string
  messageId: number
}

function hasDeliveryCoords(
  row: CourierOrderTelegramFields,
): row is CourierOrderTelegramFields & {
  delivery_lat: number
  delivery_lng: number
} {
  const lat = row.delivery_lat
  const lng = row.delivery_lng
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng)
  )
}

async function sendCourierDeliveryLocation(
  tgChatId: string | number,
  row: CourierOrderTelegramFields,
  replyToMessageId?: number,
) {
  if (!hasDeliveryCoords(row)) return
  try {
    await sendLocation(
      tgChatId,
      row.delivery_lat,
      row.delivery_lng,
      replyToMessageId,
    )
  } catch (e) {
    console.error(
      "[courierTelegram] send location",
      e instanceof Error ? e.message : e,
    )
  }
}

function orderBrandSlug(row: CourierOrderTelegramFields): string | null {
  const brands = row.brands
  if (Array.isArray(brands)) return brands[0]?.slug?.trim() || null
  return brands?.slug?.trim() || null
}

async function withResolvedDeliveryCoords(
  row: CourierOrderTelegramFields,
): Promise<CourierOrderTelegramFields> {
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

function formatMdl(bani: number): string {
  return (bani / 100).toFixed(2)
}

function paymentMethodLabel(method: PaymentMethod | null | undefined): string {
  switch (method) {
    case "cash":
      return "Наличными"
    case "card":
      return "Картой"
    case "mixed":
      return "Смешанная оплата"
    default:
      return "Не указан"
  }
}

function formatCourierDeliveryAddress(row: CourierOrderTelegramFields): string {
  const { deliveryAddress, entrance, floor, apartment } =
    posCheckoutAddressFieldsFromOrder({
      delivery_mode: "delivery",
      delivery_address: row.delivery_address,
      address_entrance: row.address_entrance,
      address_floor: row.address_floor,
      address_apartment: row.address_apartment,
      address_intercom: row.address_intercom,
    })

  const parts = [
    deliveryAddress,
    entrance ? `подъезд ${entrance}` : "",
    floor ? `эт. ${floor}` : "",
    apartment ? `кв. ${apartment}` : "",
  ].filter((p) => p.length > 0)

  return parts.length > 0 ? parts.join(", ") : "—"
}

function orderItemsBlock(items: CourierOrderTelegramItem[] | null): string {
  const rows = (items ?? []).filter((item) => item.item_name?.trim())
  if (!rows.length) return "—"

  return rows
    .map((item) => {
      const qty = Math.max(1, Math.round(item.quantity ?? 1))
      const priceBani = Math.max(0, Math.round(item.price ?? 0))
      return `• ${qty} x ${item.item_name?.trim()} — ${formatMdl(priceBani)} MDL`
    })
    .join("\n")
}

function estimatedDeliveryTime(createdAt: string | null | undefined): string {
  if (!createdAt) return "—"
  const date = new Date(new Date(createdAt).getTime() + 60 * 60 * 1000)
  return date.toLocaleTimeString("ru-RU", {
    timeZone: "Europe/Chisinau",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function paymentCollectionLines(
  row: CourierOrderTelegramFields,
  totalBani: number,
): string[] {
  const totalText = `${formatMdl(totalBani)} MDL`
  const method = row.payment_method
  const lines = [
    `💳 Оплата: ${paymentMethodLabel(method)}`,
    `💰 ИТОГОВАЯ СУММА: ${totalText}`,
  ]

  if (method === "cash") {
    const changeFromBani = Math.max(0, Math.round(row.change_from ?? 0))
    if (changeFromBani > totalBani) {
      lines.push(
        `👉 Взять у клиента: ${totalText}`,
        `💵 Клиент даст: ${formatMdl(changeFromBani)} MDL · Сдача: ${formatMdl(changeFromBani - totalBani)} MDL`,
      )
    } else {
      lines.push(`👉 Взять у клиента: ${totalText}`)
    }
    return lines
  }

  if (method === "card") {
    lines.push(`👉 Принять картой: ${totalText}`)
    return lines
  }

  lines.push(`👉 Сумма к получению: ${totalText}`)
  return lines
}

function buildCourierAssignmentMessage(row: CourierOrderTelegramFields): string {
  const totalBani = Math.max(0, Math.round(row.total ?? 0))
  const clientName = row.user_name?.trim() ?? ""
  const lines: string[] = [
    `🛵 Новый заказ #${row.order_number}`,
    "",
  ]

  if (clientName) {
    lines.push(`👤 ${clientName}`)
  }

  lines.push(
    `📞 ${row.user_phone?.trim() || "не указан"}`,
    `📍 ${formatCourierDeliveryAddress(row)}`,
    `🕐 Доставить до: ${estimatedDeliveryTime(row.created_at)}`,
    "",
    "Состав заказа:",
    orderItemsBlock(row.order_items),
    "",
    ...paymentCollectionLines(row, totalBani),
  )

  return lines.join("\n")
}

function telegramMessageId(raw: number | string | null | undefined): number | null {
  const parsed =
    typeof raw === "number"
      ? raw
      : typeof raw === "string"
        ? Number(raw)
        : NaN
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

function messageNotModified(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.message.toLowerCase().includes("message is not modified")
  )
}

function shouldSendUpdateNotice(lastUpdatedAt: string | null | undefined): boolean {
  if (!lastUpdatedAt) return true
  const timestamp = new Date(lastUpdatedAt).getTime()
  if (Number.isNaN(timestamp)) return true
  return Date.now() - timestamp > 60_000
}

export async function sendCourierAssignmentTelegram(
  tgChatId: string | null | undefined,
  row: CourierOrderTelegramFields,
): Promise<SentCourierTelegramMessage | null> {
  if (!tgChatId) return null
  const rowWithCoords = await withResolvedDeliveryCoords(row)
  const text = buildCourierAssignmentMessage(rowWithCoords)
  const message = await sendMessage(tgChatId, text)
  await sendCourierDeliveryLocation(tgChatId, rowWithCoords, message.message_id)
  return { chatId: String(tgChatId), messageId: message.message_id }
}

export async function editPreviousCourierAssignmentTelegram(
  row: CourierOrderTelegramFields,
  nextCourierName?: string | null,
): Promise<void> {
  const chatId = row.courier_tg_chat_id?.trim()
  const messageId = telegramMessageId(row.courier_tg_message_id)
  if (!chatId || messageId == null) return

  const text = [
    `Заказ #${row.order_number} передан другому курьеру.`,
    nextCourierName?.trim() ? `Новый курьер: ${nextCourierName.trim()}.` : null,
  ]
    .filter(Boolean)
    .join("\n")

  try {
    await editMessageText(chatId, messageId, text, { inline_keyboard: [] })
  } catch (e) {
    if (!messageNotModified(e)) {
      console.error(
        "[courierTelegram] edit previous assignment",
        e instanceof Error ? e.message : e,
      )
    }
  }
}

export async function refreshCourierOrderTelegramMessage(
  orderId: string,
  reason: "items" | "details" | "delivery_mode" = "items",
): Promise<void> {
  try {
    const supabase = createServiceRoleClient()
    const { data, error } = await supabase
      .from("orders")
      .select(COURIER_ORDER_TELEGRAM_SELECT)
      .eq("id", orderId)
      .maybeSingle()

    if (error || !data) {
      console.error("[courierTelegram] load order", error?.message)
      return
    }

    const row = data as CourierOrderTelegramFields
    const chatId = row.courier_tg_chat_id?.trim()
    const messageId = telegramMessageId(row.courier_tg_message_id)
    if (row.status !== "delivery" || !row.courier_id || !chatId || messageId == null) {
      return
    }

    const rowWithCoords = await withResolvedDeliveryCoords(row)
    const text = buildCourierAssignmentMessage(rowWithCoords)

    try {
      await editMessageText(chatId, messageId, text)
    } catch (e) {
      if (messageNotModified(e)) return
      throw e
    }

    if (reason === "details") {
      await sendCourierDeliveryLocation(chatId, rowWithCoords, messageId)
    }

    const sendUpdateNotice = shouldSendUpdateNotice(
      row.courier_tg_message_updated_at,
    )
    const now = new Date().toISOString()
    await supabase
      .from("orders")
      .update({ courier_tg_message_updated_at: now })
      .eq("id", orderId)

    if (!sendUpdateNotice) return

    const reasonText =
      reason === "details"
        ? "изменились детали заказа"
        : reason === "delivery_mode"
          ? "изменился тип заказа"
          : "изменился состав или сумма"
    await sendMessage(
      chatId,
      `⚠️ Заказ #${row.order_number} обновлён: ${reasonText}. Проверь актуальное сообщение выше.`,
    ).catch((e) => {
      console.error(
        "[courierTelegram] update notice",
        e instanceof Error ? e.message : e,
      )
    })
  } catch (e) {
    console.error(
      "[courierTelegram] refresh",
      e instanceof Error ? e.message : e,
    )
  }
}
