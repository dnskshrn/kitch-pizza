"use server"

import { getCurrentStaff } from "@/lib/actions/pos/auth"
import { createServiceRoleClient } from "@/lib/supabase/service-role"

export type CreateOrderPosItem = {
  menuItemId: string
  name: string
  size: "s" | "l" | null
  price: number
  qty: number
  toppings?: { name: string; price: number }[]
}

export type CreateOrderPosInput = {
  brandSlug: string
  items: CreateOrderPosItem[]
  userName: string
  userPhone: string
  userBirthday?: string
  deliveryMode: "delivery" | "pickup"
  deliveryAddress?: string
  paymentMethod: "cash" | "card"
  /** Сдача с (бани), только при оплате наличными */
  changeFrom?: number
  comment?: string
  promoCode?: string
  /** Скидка в бани */
  discount?: number
  /** Доставка в бани */
  deliveryFee?: number
}

export type CreateOrderPosResult =
  | { success: true; orderId: string }
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

  const birthdayRaw = input.userBirthday?.trim()
  const userBirthday =
    birthdayRaw && birthdayRaw.length >= 8 ? birthdayRaw.slice(0, 10) : null

  let supabase
  try {
    supabase = createServiceRoleClient()
  } catch {
    return { success: false, error: "Сервер временно недоступен" }
  }

  const insertRow: Record<string, unknown> = {
    brand_id: brandId,
    operator_id: staff.id,
    source: "pos",
    user_name: name,
    user_phone: phone,
    status: "new",
    delivery_mode: input.deliveryMode,
    delivery_address: deliveryAddress,
    payment_method: input.paymentMethod,
    change_from: changeFromBani,
    total: totalBani,
    delivery_fee: deliveryFeeBani,
    discount: discountBani,
    promo_code: input.promoCode?.trim() || null,
    scheduled_time: "asap",
    comment: input.comment?.trim() || null,
  }

  if (userBirthday) {
    insertRow.user_birthday = userBirthday
  }

  const { data: orderRow, error: orderError } = await supabase
    .from("orders")
    .insert(insertRow)
    .select("id")
    .single()

  if (orderError || !orderRow) {
    console.error("[createOrderPos] insert", orderError?.message)
    return { success: false, error: "Не удалось сохранить заказ" }
  }

  const orderId = (orderRow as { id: string }).id

  const itemRows = input.items.map((it) => ({
    order_id: orderId,
    menu_item_id: it.menuItemId,
    lunch_set_id: null as string | null,
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

  return { success: true, orderId }
}
