"use server"

import { geocodeAddress } from "@/lib/actions/check-delivery-zone"
import { getCurrentStaff } from "@/lib/actions/pos/auth"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import type { GiftCartItem } from "@/types/promotions"

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
  /** JSON массив применённых правил скидок (для `orders.discount_rules_applied`). */
  discountRulesApplied?: string | null
  /** Подарочные строки — синхронизируются после обновления заказа. */
  giftItems?: GiftCartItem[]
  /** Не передавать — не менять `orders.profile_id`. */
  profileId?: string | null
  delivery_lat?: number | null
  delivery_lng?: number | null
  /** Множитель начисления бонусов (POS / движок скидок). */
  bonus_multiplier?: number
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

  let delivery_lat: number | null = null
  let delivery_lng: number | null = null
  if (input.deliveryMode === "delivery") {
    const latIn = input.delivery_lat
    const lngIn = input.delivery_lng
    if (
      latIn != null &&
      lngIn != null &&
      Number.isFinite(Number(latIn)) &&
      Number.isFinite(Number(lngIn))
    ) {
      delivery_lat = Number(latIn)
      delivery_lng = Number(lngIn)
    } else {
      try {
        const hit = await geocodeAddress(deliveryAddress)
        if (hit) {
          delivery_lat = hit.lat
          delivery_lng = hit.lng
        }
      } catch {
        delivery_lat = null
        delivery_lng = null
      }
    }
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
    delivery_lat,
    delivery_lng,
    bonus_multiplier: input.bonus_multiplier ?? 1,
  }

  if (input.profileId !== undefined) {
    patch.profile_id = input.profileId
  }

  if (input.discountRulesApplied !== undefined) {
    patch.discount_rules_applied = input.discountRulesApplied
  }

  const { error: updateError } = await supabase
    .from("orders")
    .update(patch)
    .eq("id", input.orderId)

  if (updateError) {
    console.error("[updateOrderDetailsPos] update", updateError.message)
    return { success: false, error: "Не удалось сохранить изменения" }
  }

  const giftItems = input.giftItems ?? []
  const { error: delGiftError } = await (supabase.from("order_items") as any)
    .delete()
    .eq("order_id", input.orderId)
    .eq("is_gift", true)
  if (delGiftError) {
    console.error("[updateOrderDetailsPos] delete gift items", delGiftError.message)
  }

  if (giftItems.length > 0) {
    const giftRows = giftItems.map((g) => ({
      order_id: input.orderId,
      menu_item_id: g.menu_item_id,
      variant_id: g.variant_id,
      lunch_set_id: null as string | null,
      item_name: g.label_ru,
      size: null as string | null,
      quantity: g.quantity,
      toppings: [] as { name: string; price: number }[],
      price: 0,
      is_gift: true,
      gift_rule_id: g.rule_id,
    }))
    const { error: giftInsErr } = await (supabase.from("order_items") as any).insert(
      giftRows,
    )
    if (giftInsErr) {
      console.error("[updateOrderDetailsPos] gift items", giftInsErr.message)
      return { success: false, error: "Не удалось сохранить подарочные позиции" }
    }
  }

  return { success: true }
}
