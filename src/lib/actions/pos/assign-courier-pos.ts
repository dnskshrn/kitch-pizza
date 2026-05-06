"use server"

import { sendMessage } from "@/lib/telegram/bot"
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

    const row = order as {
      order_number: number
      total: number
      delivery_address: string | null
      address_floor: string | null
      address_apartment: string | null
      address_entrance: string | null
      address_intercom: string | null
      user_phone: string | null
    }

    if (courier.tg_chat_id) {
      const addressParts = [
        row.delivery_address ?? "—",
        row.address_entrance ? `, подъезд ${row.address_entrance}` : "",
        row.address_floor ? `, эт. ${row.address_floor}` : "",
        row.address_apartment ? `, кв. ${row.address_apartment}` : "",
        row.address_intercom ? `, домофон ${row.address_intercom}` : "",
      ].join("")

      const text = [
        `🛵 Новый заказ #${row.order_number}`,
        "",
        `📍 ${addressParts}`,
        `📞 ${row.user_phone ?? "не указан"}`,
        `💵 ${(row.total / 100).toFixed(0)} MDL`,
      ].join("\n")

      try {
        await sendMessage(courier.tg_chat_id, text)
      } catch {
        // Не блокируем: заказ уже назначен даже если Telegram недоступен
      }
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
