"use server"

import { geocodeAddress } from "@/lib/actions/check-delivery-zone"
import { getCurrentStaff } from "@/lib/actions/pos/auth"
import { refreshCourierOrderTelegramMessage } from "@/lib/actions/pos/courier-telegram-message"
import {
  calcPosBonusRateCap,
  calcPosOrderTotalBani,
  computePosOrderDiscountBreakdown,
  mapPaidOrderItemsForDiscount,
  paidOrderItemsPriceSumBani,
  purgePosOrderGiftItems,
  type PosOrderDiscountBreakdown,
} from "@/lib/pos/order-discount-breakdown"
import { getBonusSettings } from "@/lib/bonus"
import { createServiceRoleClient } from "@/lib/supabase/service-role"

export type UpdateOrderDetailsPosInput = {
  orderId: string
  userName: string
  userPhone: string
  deliveryMode: "delivery" | "pickup" | "aggregator"
  /** Улица и дом */
  deliveryAddress?: string
  addressEntrance?: string | null
  addressFloor?: string | null
  addressApartment?: string | null
  addressIntercom?: string | null
  paymentMethod: "cash" | "card" | "aggregator_card" | "mixed"
  changeFrom?: number
  /** Бани; только при payment_method = mixed. */
  cashAmount?: number | null
  /** Бани; только при payment_method = mixed. */
  cardAmount?: number | null
  comment?: string
  kitchen_note?: string | null
  /** Доставка: `asap` или `HH:MM`; для самовывоза/агрегатора не задаётся (NULL в БД). */
  scheduled_time?: string | null
  promoCode?: string
  discount: number
  deliveryFee: number
  /** JSON массив применённых правил скидок (для `orders.discount_rules_applied`). */
  discountRulesApplied?: string | null
  /** Не передавать — не менять `orders.profile_id`. */
  profileId?: string | null
  delivery_lat?: number | null
  delivery_lng?: number | null
  /** Множитель начисления бонусов (POS / движок скидок). */
  bonus_multiplier?: number
  /**
   * Пункты списания для `orders.total` и `orders.bonuses_redeemed` (1 п. = 100 бань).
   * Передаётся из POS-мастера; если не указано — только значение из БД (совместимость).
   */
  bonusesRedeemedPoints?: number
}

export type UpdateOrderDetailsPosResult =
  | { success: true }
  | { success: false; error: string }

export type UpdateOrderDeliveryModePosResult =
  | {
      success: true
      deliveryMode: "delivery" | "pickup"
      deliveryAddress: string | null
      deliveryFee: number
      total: number
    }
  | { success: false; error: string }

export async function updateOrderDeliveryModePos(
  orderId: string,
  deliveryMode: "delivery" | "pickup",
): Promise<UpdateOrderDeliveryModePosResult> {
  const staff = await getCurrentStaff()
  if (!staff) {
    return { success: false, error: "Сессия кассира недействительна" }
  }

  let supabase
  try {
    supabase = createServiceRoleClient()
  } catch {
    return { success: false, error: "Сервер временно недоступен" }
  }

  const { data: orderRow, error: loadError } = await supabase
    .from("orders")
    .select(
      "id, delivery_address, delivery_fee, discount, bonuses_redeemed, payment_method",
    )
    .eq("id", orderId)
    .maybeSingle()

  if (loadError || !orderRow) {
    console.error("[updateOrderDeliveryModePos] load", loadError?.message)
    return { success: false, error: "Заказ не найден" }
  }

  const { data: itemRows, error: itemsError } = await supabase
    .from("order_items")
    .select("price")
    .eq("order_id", orderId)

  if (itemsError) {
    console.error("[updateOrderDeliveryModePos] items", itemsError.message)
    return { success: false, error: "Не удалось пересчитать заказ" }
  }

  const subtotalBani = (itemRows ?? []).reduce(
    (s, r) => s + Math.round((r as { price: number }).price ?? 0),
    0,
  )
  const row = orderRow as {
    delivery_address: string | null
    delivery_fee: number | null
    discount: number | null
    bonuses_redeemed: number | null
    payment_method: string | null
  }
  const safeDiscount = Math.min(
    Math.max(0, Math.round(row.discount ?? 0)),
    subtotalBani,
  )
  const bonusBani = Math.max(0, Math.floor(row.bonuses_redeemed ?? 0)) * 100
  const deliveryFee = deliveryMode === "pickup" ? 0 : Math.max(0, row.delivery_fee ?? 0)
  const deliveryAddress =
    deliveryMode === "pickup"
      ? "Самовывоз — bd. Dacia 27"
      : row.delivery_address === "Самовывоз — bd. Dacia 27"
        ? null
        : row.delivery_address
  const total = Math.max(0, subtotalBani - safeDiscount + deliveryFee - bonusBani)

  let payment_method: string = typeof row.payment_method === "string" ? row.payment_method : "cash"
  if (payment_method === "aggregator_card") {
    payment_method = "cash"
  }

  const { error: updateError } = await supabase
    .from("orders")
    .update({
      delivery_mode: deliveryMode,
      delivery_address: deliveryAddress,
      delivery_fee: deliveryFee,
      total,
      aggregator: null,
      prep_deadline_at: null,
      payment_method,
      ...(deliveryMode === "pickup" ? { scheduled_time: null as string | null } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId)

  if (updateError) {
    console.error("[updateOrderDeliveryModePos] update", updateError.message)
    return { success: false, error: "Не удалось сменить тип заказа" }
  }

  await refreshCourierOrderTelegramMessage(orderId, "delivery_mode")

  return { success: true, deliveryMode, deliveryAddress, deliveryFee, total }
}

export async function updateOrderDetailsPos(
  input: UpdateOrderDetailsPosInput,
): Promise<UpdateOrderDetailsPosResult> {
  const staff = await getCurrentStaff()
  if (!staff) {
    return { success: false, error: "Сессия кассира недействительна" }
  }

  const name = input.userName.trim()
  const phone = input.userPhone.trim()
  if (input.deliveryMode !== "aggregator") {
    if (!phone) return { success: false, error: "Укажите телефон" }
  }

  const deliveryFeeBani = Math.max(0, Math.round(input.deliveryFee))
  const isAggregator = input.deliveryMode === "aggregator"

  const deliveryAddress: string | null =
    input.deliveryMode === "pickup"
      ? "Самовывоз — bd. Dacia 27"
      : input.deliveryMode === "aggregator"
        ? null
        : (input.deliveryAddress?.trim() ?? "")

  if (input.deliveryMode === "delivery" && !deliveryAddress?.trim()) {
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
    .select("id, brand_id, bonuses_redeemed")
    .eq("id", input.orderId)
    .maybeSingle()

  const brandId = (orderRow as { brand_id: string | null } | null)?.brand_id

  if (loadError || !orderRow) {
    console.error("[updateOrderDetailsPos] load", loadError?.message)
    return { success: false, error: "Заказ не найден" }
  }

  const existingBonusPointsRaw = (orderRow as { bonuses_redeemed: unknown })
    .bonuses_redeemed
  const bonusPtsFromDb =
    typeof existingBonusPointsRaw === "number" &&
    Number.isFinite(existingBonusPointsRaw)
      ? Math.max(0, Math.floor(existingBonusPointsRaw))
      : Math.max(0, Math.floor(Number(existingBonusPointsRaw) || 0))

  const bonusPtsFromInput =
    input.bonusesRedeemedPoints !== undefined
      ? Math.max(0, Math.floor(Number(input.bonusesRedeemedPoints)))
      : null

  const { data: itemRows, error: itemsError } = await supabase
    .from("order_items")
    .select("menu_item_id, variant_id, quantity, price, is_gift")
    .eq("order_id", input.orderId)

  if (itemsError) {
    console.error("[updateOrderDetailsPos] items", itemsError.message)
    return { success: false, error: "Не удалось пересчитать заказ" }
  }

  const paidItemRows = (itemRows ?? []) as Array<{
    menu_item_id: string
    variant_id: string | null
    quantity: number
    price: number
    is_gift?: boolean
  }>

  const itemsPriceSumBani = paidOrderItemsPriceSumBani(paidItemRows)

  let discountBreakdown: PosOrderDiscountBreakdown = {
    subtotalBani: 0,
    itemDiscountBani: 0,
    promoDiscountBani: 0,
    discountBani: 0,
    discountRulesApplied: [],
    promoCodeSaved: null,
    bonusExcludedNetBani: 0,
    hasBonusRedeemablePaidItems: false,
  }

  if (brandId) {
    try {
      discountBreakdown = await computePosOrderDiscountBreakdown(supabase, {
        brandId,
        orderItems: mapPaidOrderItemsForDiscount(paidItemRows),
        paidOrderItemRows: paidItemRows,
        promoCodeRaw: isAggregator ? null : input.promoCode,
        isAggregator,
      })
    } catch (e) {
      console.error(
        "[updateOrderDetailsPos] discount breakdown",
        e instanceof Error ? e.message : e,
      )
      return { success: false, error: "Не удалось пересчитать скидки" }
    }
  }

  const safeDiscount = Math.min(
    Math.max(0, Math.round(discountBreakdown.discountBani)),
    itemsPriceSumBani,
  )

  let bonusPointsForTotal =
    bonusPtsFromInput !== null ? bonusPtsFromInput : bonusPtsFromDb

  const grandBeforeBonusBani = calcPosOrderTotalBani({
    itemsPriceSumBani,
    discountBani: safeDiscount,
    deliveryFeeBani,
    bonusesRedeemedPoints: 0,
  })

  try {
    const { maxRedemptionRate } = await getBonusSettings()
    const maxFromRate = calcPosBonusRateCap({
      grandTotalBani: grandBeforeBonusBani,
      bonusExcludedNetBani: discountBreakdown.bonusExcludedNetBani,
      hasRedeemablePaidItems: discountBreakdown.hasBonusRedeemablePaidItems,
      maxRedemptionRate,
    })
    bonusPointsForTotal = Math.min(bonusPointsForTotal, maxFromRate)
  } catch (e) {
    console.error(
      "[updateOrderDetailsPos] bonus cap",
      e instanceof Error ? e.message : e,
    )
  }

  const totalBani = calcPosOrderTotalBani({
    itemsPriceSumBani,
    discountBani: safeDiscount,
    deliveryFeeBani,
    bonusesRedeemedPoints: bonusPointsForTotal,
  })
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
        const addrForGeo =
          typeof deliveryAddress === "string" ? deliveryAddress : ""
        const hit = await geocodeAddress(addrForGeo)
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

  let paymentMethod = input.paymentMethod
  if (
    input.deliveryMode !== "aggregator" &&
    paymentMethod === "aggregator_card"
  ) {
    paymentMethod = "cash"
  }

  let scheduled_time_db: string | null = null
  if (input.deliveryMode === "delivery") {
    const st =
      input.scheduled_time !== undefined && input.scheduled_time !== null
        ? String(input.scheduled_time).trim()
        : "asap"
    scheduled_time_db = st.length > 0 ? st : "asap"
  }

  const patch: Record<string, unknown> = {
    ...(input.deliveryMode === "aggregator"
      ? {
          ...(name ? { user_name: name } : {}),
          ...(phone ? { user_phone: phone } : {}),
        }
      : { user_name: name.length > 0 ? name : null, user_phone: phone }),
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
    payment_method: paymentMethod,
    change_from: changeFromBani,
    cash_amount: input.cashAmount ?? null,
    card_amount: input.cardAmount ?? null,
    total: totalBani,
    delivery_fee: deliveryFeeBani,
    subtotal: discountBreakdown.subtotalBani,
    item_discount: discountBreakdown.itemDiscountBani,
    promo_discount: discountBreakdown.promoDiscountBani,
    discount: safeDiscount,
    discount_rules_applied: discountBreakdown.discountRulesApplied,
    promo_code: isAggregator
      ? null
      : discountBreakdown.promoCodeSaved,
    comment: input.comment?.trim() || null,
    scheduled_time: scheduled_time_db,
    updated_at: updatedAt,
    delivery_lat,
    delivery_lng,
    bonus_multiplier: input.bonus_multiplier ?? 1,
  }

  if (input.kitchen_note !== undefined) {
    patch.kitchen_note =
      input.kitchen_note == null || input.kitchen_note === ""
        ? null
        : String(input.kitchen_note).trim() || null
  }

  if (bonusPtsFromInput !== null) {
    patch.bonuses_redeemed = bonusPointsForTotal
  }

  if (input.profileId !== undefined) {
    patch.profile_id = input.profileId
  }

  if (input.deliveryMode === "aggregator") {
    patch.aggregator = "glovo"
  } else {
    patch.aggregator = null
    patch.prep_deadline_at = null
  }

  const { error: updateError } = await supabase
    .from("orders")
    .update(patch)
    .eq("id", input.orderId)

  if (updateError) {
    console.error("[updateOrderDetailsPos] update", updateError.message)
    return { success: false, error: "Не удалось сохранить изменения" }
  }

  const purgeGifts = await purgePosOrderGiftItems(supabase, input.orderId)
  if (!purgeGifts.success) {
    return { success: false, error: purgeGifts.error }
  }

  await refreshCourierOrderTelegramMessage(input.orderId, "details")

  return { success: true }
}
