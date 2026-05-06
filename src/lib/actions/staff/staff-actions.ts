"use server"

import bcrypt from "bcryptjs"
import { randomUUID } from "crypto"
import { revalidatePath } from "next/cache"
import { createServiceRoleClient } from "@/lib/supabase/service-role"

export type StaffRole = "operator" | "cook" | "courier" | "manager"

export type Staff = {
  id: string
  name: string
  phone: string | null
  role: StaffRole
  is_active: boolean
  tg_chat_id: number | null
  tg_link_token: string | null
  tg_link_token_expires_at: string | null
  created_at: string
}

export type CreateStaffInput = {
  name: string
  phone?: string | null
  role: StaffRole
  pin: string
  is_active: boolean
}

export type UpdateStaffInput = {
  name: string
  phone?: string | null
  role: StaffRole
  pin?: string
  is_active: boolean
}

export async function createStaff(data: CreateStaffInput): Promise<Staff> {
  const supabase = createServiceRoleClient()
  const pin_hash = await bcrypt.hash(data.pin, 10)
  const phone =
    data.phone == null || String(data.phone).trim() === ""
      ? null
      : String(data.phone).trim()

  const { data: row, error } = await supabase
    .from("staff")
    .insert({
      name: data.name.trim(),
      phone,
      role: data.role,
      pin_hash,
      is_active: data.is_active,
    })
    .select(
      "id, name, phone, role, is_active, tg_chat_id, tg_link_token, tg_link_token_expires_at, created_at",
    )
    .single()

  if (error) throw new Error(error.message)
  revalidatePath("/admin/staff")
  return row as Staff
}

export async function updateStaff(id: string, data: UpdateStaffInput) {
  const supabase = createServiceRoleClient()
  const phone =
    data.phone == null || String(data.phone).trim() === ""
      ? null
      : String(data.phone).trim()

  const update: Record<string, unknown> = {
    name: data.name.trim(),
    phone,
    role: data.role,
    is_active: data.is_active,
  }
  const pin = data.pin?.trim()
  if (pin != null && pin.length > 0) {
    update.pin_hash = await bcrypt.hash(pin, 10)
  }
  const { error } = await supabase.from("staff").update(update).eq("id", id)
  if (error) throw new Error(error.message)
  revalidatePath("/admin/staff")
}

export async function generateTelegramLink(
  staffId: string,
): Promise<{ link: string }> {
  const bot = process.env.TELEGRAM_BOT_USERNAME?.trim()
  if (!bot) {
    throw new Error("TELEGRAM_BOT_USERNAME не задан")
  }
  const supabase = createServiceRoleClient()
  const token = randomUUID()
  const tg_link_token_expires_at = new Date(
    Date.now() + 7 * 24 * 60 * 60 * 1000,
  ).toISOString()

  const { error } = await supabase
    .from("staff")
    .update({
      tg_link_token: token,
      tg_link_token_expires_at,
    })
    .eq("id", staffId)

  if (error) throw new Error(error.message)

  return { link: `https://t.me/${bot}?start=${token}` }
}
