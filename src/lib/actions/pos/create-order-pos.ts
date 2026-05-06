"use server"

import { getCurrentStaff } from "@/lib/actions/pos/auth"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import type { OrderStatus } from "@/types/database"

export type CreateOrderPosItem = {
  menuItemId: string
  name: string
  /** Текст размера / снимок варианта для `order_items.size` */
  size: string | null
  price: number
  qty: number
  toppings?: { name: string; price: number }[]
  variantId?: string | null
}

export type CreateOrderPosInput = {
  brandSlug: string
  items: CreateOrderPosItem[]
  userName: string
  userPhone: string
  deliveryMode: "delivery" | "pickup"
  deliveryAddress?: string
  addressEntrance?: string | null
  addressFloor?: string | null
  addressApartment?: string | null
  addressIntercom?: string | null
  paymentMethod: "cash" | "card"
  /** Сдача с (бани), только при оплате наличными */
  changeFrom?: number
  comment?: string
  promoCode?: string
  /** Скидка в бани */
  discount?: number
  /** Доставка в бани */
  deliveryFee?: number
  /** Стартовый статус заказа. По умолчанию `new`. */
  initialStatus?: OrderStatus
}

export type CreateOrderPosResult =
  | { success: true; orderId: string; orderNumber: number }
  | { success: false; error: string }

async function getBrandIdBySlug(slug: string): Promise<string | null> {
  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from("brands")
    .select("id")
    .eq("slug", slug.trim())
    .maybeSingle()

  if (error) {
    console.error("[createOrderPos] brand", error.message)
    return null
  }
  return (data as { id: string } | null)?.id ?? null
}

export async function createOrderPos(
  input: CreateOrderPosInput,
): Promise<CreateOrderPosResult> {
  const staff = await getCurrentStaff()
  if (!staff) {
    return { success: false, error: "Сессия кассира недействительна" }
  }

  const brandId = await getBrandIdBySlug(input.brandSlug)
  if (!brandId) {
    return { success: false, error: "Бренд не найден" }
  }

  if (!input.items.length) {
    return { success: false, error: "Добавьте позиции в заказ" }
  }

  const effectiveDeliveryMode = input.deliveryMode

  const name = input.userName.trim()
  const phone = input.userPhone.trim()
  if (!name) return { success: false, error: "Укажите имя" }
  if (!phone) return { success: false, error: "Укажите телефон" }

  const deliveryFeeBani = Math.max(0, Math.round(input.deliveryFee ?? 0))
  const discountBani = Math.max(0, Math.round(input.discount ?? 0))
  const subtotalBani = input.items.reduce(
    (sum, it) => sum + Math.round(it.price) * it.qty,
    0,
  )
  const totalBani = subtotalBani - discountBani + deliveryFeeBani
  if (totalBani < 0) {
    return { success: false, error: "Некорректная сумма заказа" }
  }

  const deliveryAddress =
    effectiveDeliveryMode === "pickup"
      ? "Самовывоз — bd. Dacia 27"
      : (input.deliveryAddress?.trim() ?? "")

  if (effectiveDeliveryMode === "delivery" && !deliveryAddress) {
    return { success: false, error: "Укажите адрес доставки" }
  }

  const initialStatus: OrderStatus = input.initialStatus ?? "new"

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

  const cookingStartedAtIso =
    initialStatus === "cooking" ? new Date().toISOString() : null

  const insertRow: Record<string, unknown> = {
    brand_id: brandId,
    operator_id: staff.id,
    source: "pos",
    user_name: name,
    user_phone: phone,
    status: initialStatus,
    delivery_mode: effectiveDeliveryMode,
    delivery_address: deliveryAddress,
    payment_method: input.paymentMethod,
    change_from: changeFromBani,
    total: totalBani,
    delivery_fee: deliveryFeeBani,
    discount: discountBani,
    promo_code: input.promoCode?.trim() || null,
    scheduled_time: "asap",
    comment: input.comment?.trim() || null,
    address_entrance:
      input.addressEntrance != null
        ? String(input.addressEntrance).trim() || null
        : null,
    address_floor:
      input.addressFloor != null ? String(input.addressFloor).trim() || null : null,
    address_apartment:
      input.addressApartment != null
        ? String(input.addressApartment).trim() || null
        : null,
    address_intercom:
      input.addressIntercom != null
        ? String(input.addressIntercom).trim() || null
        : null,
    ...(cookingStartedAtIso != null
      ? { cooking_started_at: cookingStartedAtIso }
      : {}),
  }

  const { data: orderRow, error: orderError } = await supabase
    .from("orders")
    .insert(insertRow)
    .select("id, order_number")
    .single()

  if (orderError || !orderRow) {
    console.error("[createOrderPos] insert", orderError?.message)
    return { success: false, error: "Не удалось сохранить заказ" }
  }

  const orderId = (orderRow as { id: string }).id
  const orderNumber = Number((orderRow as { order_number: number }).order_number)

  const itemRows = input.items.map((it) => ({
    order_id: orderId,
    menu_item_id: it.menuItemId,
    lunch_set_id: null as string | null,
    variant_id: it.variantId ?? null,
    item_name: it.name,
    size: it.size,
    quantity: it.qty,
    toppings: (it.toppings ?? []) as { name: string; price: number }[],
    price: Math.round(it.price) * it.qty,
  }))

  const { error: itemsError } = await supabase.from("order_items").insert(itemRows)

  if (itemsError) {
    console.error("[createOrderPos] items", itemsError.message)
    await supabase.from("orders").delete().eq("id", orderId).eq("brand_id", brandId)
    return { success: false, error: "Не удалось сохранить состав заказа" }
  }

  return { success: true, orderId, orderNumber }
}
