"use server"

import { sendMessage } from "@/lib/telegram/bot"
import { createServiceSupabaseClient } from "@/lib/supabase/server"

type OrderNotifyFields = {
  order_number: number
  total: number
  delivery_address: string | null
  address_floor: string | null
  address_apartment: string | null
  address_entrance: string | null
  address_intercom: string | null
  user_phone: string | null
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
    `📍 ${addressParts}`,
    `📞 ${row.user_phone ?? "не указан"}`,
    `💵 ${(row.total / 100).toFixed(0)} MDL`,
  ].join("\n")
}

async function notifyCourierTelegramIfLinked(
  tgChatId: string | null | undefined,
  row: OrderNotifyFields,
): Promise<void> {
  if (!tgChatId) return
  const text = buildCourierAssignmentMessage(row)
  try {
    await sendMessage(tgChatId, text)
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
        "id, status, order_number, total, delivery_address, address_floor, address_apartment, address_entrance, address_intercom, user_phone",
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
        "id, status, delivery_mode, courier_id, order_number, total, delivery_address, address_floor, address_apartment, address_entrance, address_intercom, user_phone",
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

    const { data: prevCourier } = await supabase
      .from("staff")
      .select("tg_chat_id")
      .eq("id", o.courier_id)
      .maybeSingle()

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
    const prevTg = prevCourier?.tg_chat_id
    const prevHadTelegram =
      typeof prevTg === "string" && prevTg.trim().length > 0

    if (prevHadTelegram && newCourier.tg_chat_id) {
      await notifyCourierTelegramIfLinked(newCourier.tg_chat_id, row)
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
