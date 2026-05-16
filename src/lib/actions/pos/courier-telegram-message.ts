import { checkDeliveryZoneByAddress } from "@/lib/actions/pos/check-delivery-zone-pos"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { editMessageText, sendMessage } from "@/lib/telegram/bot"

export const COURIER_ORDER_TELEGRAM_SELECT =
  "id, status, delivery_mode, courier_id, courier_tg_chat_id, courier_tg_message_id, courier_tg_message_updated_at, order_number, total, user_name, delivery_address, delivery_lat, delivery_lng, address_floor, address_apartment, address_entrance, address_intercom, user_phone, payment_method, change_from, brands(slug), order_items(item_name, quantity, price)"

export type CourierOrderTelegramFields = {
  id?: string
  status?: string | null
  delivery_mode?: string | null
  courier_id?: string | null
  courier_tg_chat_id?: string | null
  courier_tg_message_id?: number | string | null
  courier_tg_message_updated_at?: string | null
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

function buildCourierMapButtons(row: CourierOrderTelegramFields) {
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

function paymentMethodLabel(row: CourierOrderTelegramFields): string {
  if (row.payment_method === "card") return "Картой"
  if (row.payment_method === "cash") {
    return row.change_from != null && row.change_from > 0
      ? `Наличными, сдача с ${(row.change_from / 100).toFixed(0)} MDL`
      : "Наличными"
  }
  return "Не указан"
}

function orderItemsLines(items: CourierOrderTelegramItem[] | null): string[] {
  const rows = (items ?? []).filter((item) => item.item_name?.trim())
  if (!rows.length) return ["—"]

  return rows.map((item) => {
    const qty = Math.max(1, Math.round(item.quantity ?? 1))
    const price = Math.max(0, Math.round(item.price ?? 0))
    const priceText = price > 0 ? ` — ${(price / 100).toFixed(0)} MDL` : ""
    return `• ${qty} x ${item.item_name?.trim()}${priceText}`
  })
}

function buildCourierAssignmentMessage(row: CourierOrderTelegramFields): string {
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
  const replyMarkup = buildCourierMapButtons(rowWithCoords)
  const message = await sendMessage(tgChatId, text, replyMarkup)
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
    const replyMarkup = buildCourierMapButtons(rowWithCoords)

    try {
      await editMessageText(chatId, messageId, text, replyMarkup)
    } catch (e) {
      if (messageNotModified(e)) return
      throw e
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
