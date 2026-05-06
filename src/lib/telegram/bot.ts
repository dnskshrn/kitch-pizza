const BASE = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/`

export async function sendMessage(
  chatId: number | string,
  text: string,
  replyMarkup?: object,
): Promise<void> {
  if (!process.env.TELEGRAM_BOT_TOKEN?.trim()) {
    throw new Error("TELEGRAM_BOT_TOKEN is not set")
  }
  const payload: Record<string, unknown> = { chat_id: chatId, text }
  if (replyMarkup !== undefined) {
    payload.reply_markup = replyMarkup
  }
  const res = await fetch(`${BASE}sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  const json = (await res.json()) as {
    ok?: boolean
    description?: string
  }
  if (!res.ok || json.ok !== true) {
    throw new Error(
      json.description ?? `Telegram sendMessage failed: HTTP ${res.status}`,
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
