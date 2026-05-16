"use server"

import {
  COURIER_ORDER_ASSIGNMENT_SELECT,
  COURIER_ORDER_TELEGRAM_SELECT,
  editPreviousCourierAssignmentTelegram,
  sendCourierAssignmentTelegram,
  type CourierOrderTelegramFields,
  type SentCourierTelegramMessage,
} from "@/lib/actions/pos/courier-telegram-message"
import { createServiceSupabaseClient } from "@/lib/supabase/server"

type ServiceSupabaseClient = ReturnType<typeof createServiceSupabaseClient>
type SupabaseErrorLike = { message?: string } | null

function isMissingCourierTelegramColumn(error: SupabaseErrorLike): boolean {
  const message = error?.message?.toLowerCase() ?? ""
  return message.includes("courier_tg_") && message.includes("does not exist")
}

async function loadCourierOrderForAssignment(
  supabase: ServiceSupabaseClient,
  orderId: string,
): Promise<
  | { order: CourierOrderTelegramFields; error: null }
  | { order: null; error: string }
> {
  const full = await supabase
    .from("orders")
    .select(COURIER_ORDER_TELEGRAM_SELECT)
    .eq("id", orderId)
    .maybeSingle()

  if (!full.error) {
    return full.data
      ? { order: full.data as CourierOrderTelegramFields, error: null }
      : { order: null, error: "Заказ не найден" }
  }

  if (!isMissingCourierTelegramColumn(full.error)) {
    console.error("[assignCourierPos] load order", full.error.message)
    return { order: null, error: "Не удалось загрузить заказ" }
  }

  console.error(
    "[assignCourierPos] courier telegram columns are missing; continuing without message tracking",
    full.error.message,
  )

  const fallback = await supabase
    .from("orders")
    .select(COURIER_ORDER_ASSIGNMENT_SELECT)
    .eq("id", orderId)
    .maybeSingle()

  if (fallback.error) {
    console.error("[assignCourierPos] fallback load order", fallback.error.message)
    return { order: null, error: "Не удалось загрузить заказ" }
  }

  return fallback.data
    ? { order: fallback.data as CourierOrderTelegramFields, error: null }
    : { order: null, error: "Заказ не найден" }
}

async function updateOrderCourierWithFallback(
  supabase: ServiceSupabaseClient,
  orderId: string,
  courierId: string,
  status: "delivery" | null,
): Promise<string | null> {
  const now = new Date().toISOString()
  const baseUpdate = {
    courier_id: courierId,
    courier_assigned_at: now,
    updated_at: now,
  }
  const fullUpdate = {
    ...baseUpdate,
    ...(status ? { status } : {}),
    courier_tg_chat_id: null,
    courier_tg_message_id: null,
    courier_tg_message_updated_at: null,
  }

  const { error } = await supabase
    .from("orders")
    .update(fullUpdate)
    .eq("id", orderId)

  if (!error) return null
  if (!isMissingCourierTelegramColumn(error)) return error.message

  console.error(
    "[assignCourierPos] update without courier telegram columns",
    error.message,
  )

  const fallbackUpdate = {
    ...baseUpdate,
    ...(status ? { status } : {}),
  }
  const { error: fallbackError } = await supabase
    .from("orders")
    .update(fallbackUpdate)
    .eq("id", orderId)

  return fallbackError?.message ?? null
}

async function saveCourierTelegramMessageRef(
  supabase: ServiceSupabaseClient,
  orderId: string,
  sent: SentCourierTelegramMessage | null,
): Promise<void> {
  if (!sent) return

  const { error } = await supabase
    .from("orders")
    .update({
      courier_tg_chat_id: sent.chatId,
      courier_tg_message_id: sent.messageId,
      courier_tg_message_updated_at: new Date().toISOString(),
    })
    .eq("id", orderId)

  if (error && !isMissingCourierTelegramColumn(error)) {
    console.error("[assignCourierPos] save telegram refs", error.message)
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

    const { order, error: orderLoadError } = await loadCourierOrderForAssignment(
      supabase,
      orderId,
    )

    if (orderLoadError || !order) {
      return { success: false, error: orderLoadError ?? "Заказ не найден" }
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

    const updateError = await updateOrderCourierWithFallback(
      supabase,
      orderId,
      courierId,
      "delivery",
    )

    if (updateError) {
      return { success: false, error: updateError }
    }

    try {
      const sent = await sendCourierAssignmentTelegram(courier.tg_chat_id, order)
      await saveCourierTelegramMessageRef(supabase, orderId, sent)
    } catch (e) {
      console.error(
        "[assignCourierPos] telegram",
        e instanceof Error ? e.message : e,
      )
    }

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

    const { order, error: orderLoadError } = await loadCourierOrderForAssignment(
      supabase,
      orderId,
    )

    if (orderLoadError || !order) {
      return { success: false, error: orderLoadError ?? "Заказ не найден" }
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

    const updateError = await updateOrderCourierWithFallback(
      supabase,
      orderId,
      courierId,
      null,
    )

    if (updateError) {
      return { success: false, error: updateError }
    }

    try {
      await editPreviousCourierAssignmentTelegram(order, newCourier.name)
      const sent = await sendCourierAssignmentTelegram(newCourier.tg_chat_id, order)
      await saveCourierTelegramMessageRef(supabase, orderId, sent)
    } catch (e) {
      console.error(
        "[changeCourierPos] telegram",
        e instanceof Error ? e.message : e,
      )
    }

    return { success: true }
  } catch (e) {
    return {
      success: false,
      error:
        e instanceof Error ? e.message : "Неизвестная ошибка",
    }
  }
}
