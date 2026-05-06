import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { sendMessage } from "@/lib/telegram/bot"

type TelegramUser = {
  id: number
  is_bot?: boolean
  first_name?: string
}

type TelegramChat = {
  id: number
  type: string
}

type TelegramLocation = {
  latitude: number
  longitude: number
  horizontal_accuracy?: number
}

type TelegramMessage = {
  message_id: number
  from?: TelegramUser
  chat: TelegramChat
  text?: string
  location?: TelegramLocation
}

type TelegramUpdate = {
  update_id: number
  message?: TelegramMessage
  edited_message?: TelegramMessage
}

function json200(body: object) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  })
}

export async function POST(request: Request) {
  const secret = process.env.TELEGRAM_COURIER_WEBHOOK_SECRET?.trim()
  const header =
    request.headers.get("x-telegram-bot-api-secret-token") ??
    request.headers.get("X-Telegram-Bot-Api-Secret-Token")

  if (!secret || header !== secret) {
    return new Response("Forbidden", { status: 403 })
  }

  let update: TelegramUpdate
  try {
    update = (await request.json()) as TelegramUpdate
  } catch {
    return json200({ ok: true })
  }

  const msg = update.edited_message ?? update.message

  try {
    if (msg?.location && msg.from) {
      await handleLiveLocationUpdate(msg)
      return json200({ ok: true })
    }

    if (msg?.text?.startsWith("/start ")) {
      await handleStartCommand(msg)
      return json200({ ok: true })
    }

    if (msg?.text === "/shift_start") {
      await handleShiftStart(msg)
      return json200({ ok: true })
    }

    if (msg?.text === "/shift_end") {
      await handleShiftEnd(msg)
      return json200({ ok: true })
    }
  } catch (e) {
    console.error("[telegram webhook]", e)
  }

  return json200({ ok: true })
}

async function handleStartCommand(msg: TelegramMessage) {
  const text = msg.text
  const chatId = msg.chat.id
  if (!text) return

  const parts = text.trim().split(/\s+/)
  if (parts.length < 2) return

  const token = parts[1]
  if (!token) return

  const supabase = createServiceRoleClient()
  const { data: staff, error } = await supabase
    .from("staff")
    .select("id, name, role, tg_link_token_expires_at")
    .eq("tg_link_token", token)
    .maybeSingle()

  if (error) {
    console.error("[telegram /start]", error.message)
    await sendMessage(chatId, "❌ Ссылка недействительна.")
    return
  }

  if (!staff) {
    await sendMessage(chatId, "❌ Ссылка недействительна.")
    return
  }

  const expiresAt = staff.tg_link_token_expires_at
  if (
    !expiresAt ||
    Number.isNaN(new Date(expiresAt).getTime()) ||
    new Date(expiresAt).getTime() < Date.now()
  ) {
    await sendMessage(
      chatId,
      "❌ Ссылка устарела. Запросите новую у менеджера.",
    )
    return
  }

  const fromId = msg.from?.id
  if (fromId == null) return

  const { error: upErr } = await supabase
    .from("staff")
    .update({
      tg_chat_id: fromId,
      tg_link_token: null,
      tg_link_token_expires_at: null,
    })
    .eq("id", staff.id)

  if (upErr) {
    console.error("[telegram /start] update", upErr.message)
    await sendMessage(chatId, "❌ Ссылка недействительна.")
    return
  }

  await sendMessage(
    chatId,
    `✅ Привет, ${staff.name}! Ты успешно подключён как курьер.\n\nКоманды:\n/shift_start — начать смену\n/shift_end — завершить смену`,
  )
}

async function handleShiftStart(msg: TelegramMessage) {
  const chatId = msg.chat.id
  const fromId = msg.from?.id
  if (fromId == null) return

  const supabase = createServiceRoleClient()

  const { data: staff, error: staffErr } = await supabase
    .from("staff")
    .select("id, role")
    .eq("tg_chat_id", fromId)
    .maybeSingle()

  if (staffErr) {
    console.error("[telegram shift_start] staff", staffErr.message)
    await sendMessage(
      chatId,
      "❌ Ты не зарегистрирован. Обратись к менеджеру.",
    )
    return
  }

  if (!staff) {
    await sendMessage(
      chatId,
      "❌ Ты не зарегистрирован. Обратись к менеджеру.",
    )
    return
  }

  if (staff.role !== "courier") {
    await sendMessage(chatId, "❌ Эта команда только для курьеров.")
    return
  }

  const { data: activeLoc } = await supabase
    .from("courier_locations")
    .select("staff_id")
    .eq("staff_id", staff.id)
    .eq("is_on_shift", true)
    .maybeSingle()

  if (activeLoc) {
    await sendMessage(chatId, "⚠️ Смена уже активна.")
    return
  }

  const now = new Date().toISOString()

  const { error: locErr } = await supabase.from("courier_locations").upsert(
    {
      staff_id: staff.id,
      lat: 0,
      lng: 0,
      is_on_shift: true,
      updated_at: now,
      accuracy: null,
    },
    { onConflict: "staff_id" },
  )

  if (locErr) {
    console.error("[telegram shift_start] courier_locations", locErr.message)
    await sendMessage(chatId, "❌ Не удалось начать смену. Попробуй позже.")
    return
  }

  const { error: logErr } = await supabase.from("shift_logs").insert({
    staff_id: staff.id,
    clock_in: now,
  })

  if (logErr) {
    console.error("[telegram shift_start] shift_logs", logErr.message)
    await sendMessage(chatId, "❌ Не удалось начать смену. Попробуй позже.")
    return
  }

  await sendMessage(
    chatId,
    "✅ Смена начата! Не забудь поделиться геолокацией в реальном времени (📎 → Геопозиция → Транслировать).",
  )
}

async function handleShiftEnd(msg: TelegramMessage) {
  const chatId = msg.chat.id
  const fromId = msg.from?.id
  if (fromId == null) return

  const supabase = createServiceRoleClient()

  const { data: staff, error: staffErr } = await supabase
    .from("staff")
    .select("id")
    .eq("tg_chat_id", fromId)
    .maybeSingle()

  if (staffErr) {
    console.error("[telegram shift_end] staff", staffErr.message)
    await sendMessage(chatId, "❌ Ты не зарегистрирован.")
    return
  }

  if (!staff) {
    await sendMessage(chatId, "❌ Ты не зарегистрирован.")
    return
  }

  const now = new Date().toISOString()

  await supabase
    .from("courier_locations")
    .update({ is_on_shift: false, updated_at: now })
    .eq("staff_id", staff.id)

  const { data: openShift } = await supabase
    .from("shift_logs")
    .select("id")
    .eq("staff_id", staff.id)
    .is("clock_out", null)
    .order("clock_in", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (openShift?.id) {
    await supabase
      .from("shift_logs")
      .update({ clock_out: now })
      .eq("id", openShift.id)
  }

  await sendMessage(chatId, "✅ Смена завершена. Хорошего отдыха!")
}

async function handleLiveLocationUpdate(msg: TelegramMessage) {
  const fromId = msg.from?.id
  const loc = msg.location
  if (fromId == null || !loc) return

  const supabase = createServiceRoleClient()

  const { data: staff, error: staffErr } = await supabase
    .from("staff")
    .select("id")
    .eq("tg_chat_id", fromId)
    .maybeSingle()

  if (staffErr || !staff) {
    return
  }

  const now = new Date().toISOString()
  const accuracy =
    loc.horizontal_accuracy != null && !Number.isNaN(loc.horizontal_accuracy)
      ? loc.horizontal_accuracy
      : null

  const { data: existing } = await supabase
    .from("courier_locations")
    .select("is_on_shift")
    .eq("staff_id", staff.id)
    .maybeSingle()

  const { error: upsertErr } = await supabase.from("courier_locations").upsert(
    {
      staff_id: staff.id,
      lat: loc.latitude,
      lng: loc.longitude,
      accuracy,
      updated_at: now,
      is_on_shift: existing?.is_on_shift ?? false,
    },
    { onConflict: "staff_id" },
  )

  if (upsertErr) {
    console.error("[telegram location]", upsertErr.message)
  }
}
