function telegramBaseUrl(): string {
  const token = process.env.TELEGRAM_COURIER_BOT_TOKEN?.trim()
  if (!token) {
    throw new Error("TELEGRAM_COURIER_BOT_TOKEN is not set")
  }
  return `https://api.telegram.org/bot${token}/`
}

type TelegramMessageResult = {
  message_id: number
}

type TelegramApiResponse<T> = {
  ok?: boolean
  result?: T
  description?: string
}

export async function sendMessage(
  chatId: number | string,
  text: string,
  replyMarkup?: object,
): Promise<TelegramMessageResult> {
  const payload: Record<string, unknown> = { chat_id: chatId, text }
  if (replyMarkup !== undefined) {
    payload.reply_markup = replyMarkup
  }
  const res = await fetch(`${telegramBaseUrl()}sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  const json = (await res.json()) as TelegramApiResponse<TelegramMessageResult>
  if (!res.ok || json.ok !== true) {
    throw new Error(
      json.description ?? `Telegram sendMessage failed: HTTP ${res.status}`,
    )
  }
  if (typeof json.result?.message_id !== "number") {
    throw new Error("Telegram sendMessage returned no message_id")
  }
  return { message_id: json.result.message_id }
}

export async function editMessageText(
  chatId: number | string,
  messageId: number,
  text: string,
  replyMarkup?: object,
): Promise<void> {
  const payload: Record<string, unknown> = {
    chat_id: chatId,
    message_id: messageId,
    text,
  }
  if (replyMarkup !== undefined) {
    payload.reply_markup = replyMarkup
  }
  const res = await fetch(`${telegramBaseUrl()}editMessageText`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  const json = (await res.json()) as TelegramApiResponse<unknown>
  if (!res.ok || json.ok !== true) {
    throw new Error(
      json.description ?? `Telegram editMessageText failed: HTTP ${res.status}`,
    )
  }
}

export async function sendOrderNotification(
  chatId: number | string,
  order: {
    id: number
    delivery_address: string
    delivery_lat?: number | null
    delivery_lng?: number | null
    total?: number
  },
): Promise<void> {
  const lat = order.delivery_lat
  const lng = order.delivery_lng
  const mapUrl =
    lat != null &&
    lng != null &&
    typeof lat === "number" &&
    typeof lng === "number" &&
    !Number.isNaN(lat) &&
    !Number.isNaN(lng)
      ? `https://maps.google.com/maps?q=${lat},${lng}`
      : `https://maps.google.com/maps?q=${encodeURIComponent(order.delivery_address)}`

  const lines = [
    `🛵 Новый заказ #${order.id}`,
    `📍 Адрес: ${order.delivery_address}`,
  ]
  if (order.total != null) {
    lines.push(`💰 Сумма: ${(order.total / 100).toFixed(0)} MDL`)
  }
  const text = lines.join("\n")

  await sendMessage(chatId, text, {
    inline_keyboard: [[{ text: "🗺 Открыть карту", url: mapUrl }]],
  })
}
