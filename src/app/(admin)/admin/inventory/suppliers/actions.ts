"use server"

import { getAdminBrandId } from "@/lib/get-admin-brand-id"
import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export type SupplierPayload = {
  name: string
  contact_person: string | null
  phone: string | null
  note: string | null
  is_active: boolean
}

export async function createSupplier(payload: SupplierPayload) {
  const brandId = await getAdminBrandId()
  const supabase = await createClient()
  const { error } = await supabase.from("suppliers").insert({
    brand_id: brandId,
    name: payload.name.trim(),
    contact_person: payload.contact_person?.trim() || null,
    phone: payload.phone?.trim() || null,
    note: payload.note?.trim() || null,
    is_active: payload.is_active,
  })
  if (error) throw new Error(error.message)
  revalidatePath("/admin/inventory/suppliers")
}

export async function updateSupplier(id: string, payload: SupplierPayload) {
  const brandId = await getAdminBrandId()
  const supabase = await createClient()
  const { error } = await supabase
    .from("suppliers")
    .update({
      name: payload.name.trim(),
      contact_person: payload.contact_person?.trim() || null,
      phone: payload.phone?.trim() || null,
      note: payload.note?.trim() || null,
      is_active: payload.is_active,
    })
    .eq("id", id)
    .eq("brand_id", brandId)
  if (error) throw new Error(error.message)
  revalidatePath("/admin/inventory/suppliers")
}

export async function deleteSupplier(id: string) {
  const brandId = await getAdminBrandId()
  const supabase = await createClient()

  const { count, error: countError } = await supabase
    .from("supply_orders")
    .select("id", { count: "exact", head: true })
    .eq("supplier_id", id)

  if (countError) throw new Error(countError.message)
  if ((count ?? 0) > 0) {
    throw new Error(
      "Нельзя удалить поставщика: есть связанные заказы поставок"
    )
  }

  const { error } = await supabase
    .from("suppliers")
    .delete()
    .eq("id", id)
    .eq("brand_id", brandId)

  if (error) throw new Error(error.message)
  revalidatePath("/admin/inventory/suppliers")
}
