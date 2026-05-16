"use server"

import {
  COURIER_ORDER_TELEGRAM_SELECT,
  editPreviousCourierAssignmentTelegram,
  sendCourierAssignmentTelegram,
  type CourierOrderTelegramFields,
} from "@/lib/actions/pos/courier-telegram-message"
import { createServiceSupabaseClient } from "@/lib/supabase/server"

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
      .select(COURIER_ORDER_TELEGRAM_SELECT)
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
        courier_tg_chat_id: null,
        courier_tg_message_id: null,
        courier_tg_message_updated_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId)

    if (updateError) {
      return { success: false, error: updateError.message }
    }

    try {
      const row = order as CourierOrderTelegramFields
      const sent = await sendCourierAssignmentTelegram(courier.tg_chat_id, row)
      if (sent) {
        await supabase
          .from("orders")
          .update({
            courier_tg_chat_id: sent.chatId,
            courier_tg_message_id: sent.messageId,
            courier_tg_message_updated_at: new Date().toISOString(),
          })
          .eq("id", orderId)
      }
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

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select(COURIER_ORDER_TELEGRAM_SELECT)
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
        courier_tg_chat_id: null,
        courier_tg_message_id: null,
        courier_tg_message_updated_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId)

    if (updateError) {
      return { success: false, error: updateError.message }
    }

    try {
      const row = order as CourierOrderTelegramFields
      await editPreviousCourierAssignmentTelegram(row, newCourier.name)
      const sent = await sendCourierAssignmentTelegram(newCourier.tg_chat_id, row)
      if (sent) {
        await supabase
          .from("orders")
          .update({
            courier_tg_chat_id: sent.chatId,
            courier_tg_message_id: sent.messageId,
            courier_tg_message_updated_at: new Date().toISOString(),
          })
          .eq("id", orderId)
      }
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
