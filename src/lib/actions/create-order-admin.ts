"use server"

import { executeCreateOrder } from "@/lib/actions/create-order"
import type { CreateOrderPayload, CreateOrderResult } from "@/lib/actions/create-order"
import { getAdminBrandId } from "@/lib/get-admin-brand-id"

/** Создание заказа в контексте выбранного в админке бренда (POS и т.п.). */
export async function createOrderAdmin(
  payload: CreateOrderPayload,
): Promise<CreateOrderResult> {
  return executeCreateOrder(payload, getAdminBrandId)
}
