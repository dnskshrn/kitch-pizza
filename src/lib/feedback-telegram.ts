import { createServiceRoleClient } from "@/lib/supabase/service-role"

export type NegativeFeedbackPayload = {
  feedback_id: string
  order_id: string
  brand_name: string
  customer_phone: string | null
  courier_name: string | null
  food_rating: number
  service_rating: number
  comment: string | null
  photo_urls?: string[] | null
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
}

function buildNegativeFeedbackMessage(payload: NegativeFeedbackPayload): string {
  const commentBlock = payload.comment
    ? `\n💬 ${escapeHtml(payload.comment)}`
    : ""

  return [
    `⚠️ Негативный отзыв — <b>${payload.brand_name}</b>`,
    "",
    `📞 ${payload.customer_phone ?? "нет номера"}`,
    `🚗 Курьер: ${payload.courier_name ?? "—"}`,
    `🍱 Продукт: ${payload.food_rating}/5`,
    `🚀 Сервис: ${payload.service_rating}/5`,
    commentBlock,
  ].join("\n")
}

async function sendTelegramPhoto(
  token: string,
  chatId: string,
  photoUrl: string,
): Promise<void> {
  const response = await fetch(
    `https://api.telegram.org/bot${token}/sendPhoto`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        photo: photoUrl,
        caption: "📸 Клиент прикрепил фото",
      }),
    },
  )

  const body = (await response.json().catch(() => null)) as {
    ok?: boolean
    description?: string
  } | null

  if (!response.ok || !body?.ok) {
    console.error(
      "feedback-telegram sendPhoto failed:",
      response.status,
      body?.description ?? body,
    )
  }
}

export async function sendNegativeFeedbackTelegram(
  payload: NegativeFeedbackPayload,
): Promise<number | null> {
  const token = process.env.TELEGRAM_FEEDBACK_BOT_TOKEN?.trim()
  const chatId = process.env.TELEGRAM_FEEDBACK_CHAT_ID?.trim()

  if (!token || !chatId) {
    console.warn(
      "feedback-telegram: TELEGRAM_FEEDBACK_BOT_TOKEN or TELEGRAM_FEEDBACK_CHAT_ID is not set",
    )
    return null
  }

  const text = buildNegativeFeedbackMessage(payload)

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: "HTML",
        }),
      },
    )

    const body = (await response.json().catch(() => null)) as {
      ok?: boolean
      result?: { message_id?: number }
      description?: string
    } | null

    if (!response.ok || !body?.ok) {
      console.error(
        "feedback-telegram sendMessage failed:",
        response.status,
        body?.description ?? body,
      )
      return null
    }

    const messageId = body.result?.message_id
    const firstPhoto = payload.photo_urls?.[0]?.trim()
    if (firstPhoto) {
      try {
        const supabase = createServiceRoleClient()
        const { data, error } = await supabase.storage
          .from("feedback-photos")
          .createSignedUrl(firstPhoto, 3600)

        if (error || !data?.signedUrl) {
          console.error(
            "feedback-telegram signed URL error:",
            error?.message ?? "missing url",
          )
        } else {
          await sendTelegramPhoto(token, chatId, data.signedUrl)
        }
      } catch (err) {
        console.error("feedback-telegram photo send error:", err)
      }
    }

    return typeof messageId === "number" ? messageId : null
  } catch (err) {
    console.error("feedback-telegram sendMessage error:", err)
    return null
  }
}
