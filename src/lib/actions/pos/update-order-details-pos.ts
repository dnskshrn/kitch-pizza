"use server"

import { getCurrentStaff } from "@/lib/actions/pos/auth"
import { createServiceRoleClient } from "@/lib/supabase/service-role"

export type UpdateOrderDetailsPosInput = {
  orderId: string
  userName: string
  userPhone: string
  deliveryMode: "delivery" | "pickup"
  /** Улица и дом */
  deliveryAddress?: string
  addressEntrance?: string | null
  addressFloor?: string | null
  addressApartment?: string | null
  addressIntercom?: string | null
  paymentMethod: "cash" | "card"
  changeFrom?: number
  comment?: string
  promoCode?: string
  discount: number
  deliveryFee: number
}

export type UpdateOrderDetailsPosResult =
  | { success: true }
  | { success: false; error: string }

export async function updateOrderDetailsPos(
  input: UpdateOrderDetailsPosInput,
): Promise<UpdateOrderDetailsPosResult> {
  const staff = await getCurrentStaff()
  if (!staff) {
    return { success: false, error: "Сессия кассира недействительна" }
  }

  const name = input.userName.trim()
  const phone = input.userPhone.trim()
  if (!name) return { success: false, error: "Укажите имя" }
  if (!phone) return { success: false, error: "Укажите телефон" }

  const deliveryFeeBani = Math.max(0, Math.round(input.deliveryFee))
  const discountBani = Math.max(0, Math.round(input.discount))

  const deliveryAddress =
    input.deliveryMode === "pickup"
      ? "Самовывоз — bd. Dacia 27"
      : (input.deliveryAddress?.trim() ?? "")

  if (input.deliveryMode === "delivery" && !deliveryAddress) {
    return { success: false, error: "Укажите адрес доставки" }
  }

  const changeFromBani =
    input.paymentMethod === "cash" && input.changeFrom != null
      ? Math.max(0, Math.round(input.changeFrom))
      : null

  let supabase
  try {
    supabase = createServiceRoleClient()
  } catch {
    return { success: false, error: "Сервер временно недоступен" }
  }

  const { data: orderRow, error: loadError } = await supabase
    .from("orders")
    .select("id, brand_id")
    .eq("id", input.orderId)
    .maybeSingle()

  if (loadError || !orderRow) {
    console.error("[updateOrderDetailsPos] load", loadError?.message)
    return { success: false, error: "Заказ не найден" }
  }

  const { data: itemRows, error: itemsError } = await supabase
    .from("order_items")
    .select("price")
    .eq("order_id", input.orderId)

  if (itemsError) {
    console.error("[updateOrderDetailsPos] items", itemsError.message)
    return { success: false, error: "Не удалось пересчитать заказ" }
  }

  const subtotalBani = (itemRows ?? []).reduce(
    (s, r) => s + Math.round((r as { price: number }).price ?? 0),
    0,
  )

  const safeDiscount = Math.min(discountBani, subtotalBani)
  const totalBani = subtotalBani - safeDiscount + deliveryFeeBani
  if (totalBani < 0) {
    return { success: false, error: "Некорректная сумма заказа" }
  }

  const updatedAt = new Date().toISOString()

  const patch: Record<string, unknown> = {
    user_name: name,
    user_phone: phone,
    delivery_mode: input.deliveryMode,
    delivery_address: deliveryAddress,
    address_entrance:
      input.addressEntrance != null ? String(input.addressEntrance).trim() || null : null,
    address_floor:
      input.addressFloor != null ? String(input.addressFloor).trim() || null : null,
    address_apartment:
      input.addressApartment != null
        ? String(input.addressApartment).trim() || null
        : null,
    address_intercom:
      input.addressIntercom != null ? String(input.addressIntercom).trim() || null : null,
    payment_method: input.paymentMethod,
    change_from: changeFromBani,
    total: totalBani,
    delivery_fee: deliveryFeeBani,
    discount: safeDiscount,
    promo_code: input.promoCode?.trim() || null,
    comment: input.comment?.trim() || null,
    updated_at: updatedAt,
  }

  const { error: updateError } = await supabase
    .from("orders")
    .update(patch)
    .eq("id", input.orderId)

  if (updateError) {
    console.error("[updateOrderDetailsPos] update", updateError.message)
    return { success: false, error: "Не удалось сохранить изменения" }
  }

  return { success: true }
}
