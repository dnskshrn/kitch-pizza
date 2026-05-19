"use server"

import bcrypt from "bcryptjs"
import { SignJWT, jwtVerify } from "jose"
import { cookies } from "next/headers"
import { getPosJwtSecretKey } from "@/lib/pos/jwt-secret"
import { createServiceRoleClient } from "@/lib/supabase/service-role"

type StaffRow = {
  id: string
  name: string
  role: string
  pin_hash: string
}

export async function verifyPin(
  pin: string,
): Promise<
  | { success: true; staff: { id: string; name: string; role: string } }
  | { success: false; error: string }
> {
  if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
    return { success: false, error: "invalid_pin" }
  }

  let supabase
  try {
    supabase = createServiceRoleClient()
  } catch {
    return { success: false, error: "server" }
  }

  const { data: rows, error } = await supabase
    .from("staff")
    .select("id, name, role, pin_hash")
    .eq("is_active", true)

  if (error || !rows?.length) {
    console.error("[verifyPin]", error?.message)
    return { success: false, error: "invalid_pin" }
  }

  let match: StaffRow | null = null
  for (const row of rows as StaffRow[]) {
    const ok = await bcrypt.compare(pin, row.pin_hash)
    if (ok) {
      match = row
      break
    }
  }

  if (!match) {
    return { success: false, error: "invalid_pin" }
  }

  const secret = getPosJwtSecretKey()
  const token = await new SignJWT({
    staffId: match.id,
    name: match.name,
    role: match.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("12h")
    .sign(secret)

  const cookieStore = await cookies()
  cookieStore.set("pos-session", token, {
    path: "/pos",
    httpOnly: true,
    maxAge: 43200,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  })

  return {
    success: true,
    staff: { id: match.id, name: match.name, role: match.role },
  }
}

export async function logout(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete({ name: "pos-session", path: "/pos" })
}

export async function getCurrentStaff(): Promise<{
  id: string
  name: string
  role: string
} | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get("pos-session")?.value
  if (!token) return null

  try {
    const { payload } = await jwtVerify(token, getPosJwtSecretKey())
    const staffId = payload.staffId
    const name = payload.name
    const role = payload.role
    if (
      typeof staffId !== "string" ||
      typeof name !== "string" ||
      typeof role !== "string"
    ) {
      return null
    }
    return { id: staffId, name, role }
  } catch {
    return null
  }
}

export async function hasOpenShift(): Promise<boolean> {
  const cookieStore = await cookies()
  const token = cookieStore.get("pos-session")?.value
  if (!token) return false
  try {
    const { payload } = await jwtVerify(token, getPosJwtSecretKey())
    const staffId =
      typeof payload.staffId === "string"
        ? payload.staffId
        : String(payload.staffId ?? "")
    if (!staffId) return false
    const supabase = createServiceRoleClient()
    const { data } = await supabase
      .from("shift_logs")
      .select("id")
      .eq("staff_id", staffId)
      .is("clock_out", null)
      .maybeSingle()
    return !!data
  } catch {
    return false
  }
}

export async function verifyCurrentStaffPin(pin: string): Promise<boolean> {
  const cookieStore = await cookies()
  const token = cookieStore.get("pos-session")?.value
  if (!token) return false
  try {
    const { payload } = await jwtVerify(token, getPosJwtSecretKey())
    const staffId =
      typeof payload.staffId === "string"
        ? payload.staffId
        : String(payload.staffId ?? "")
    if (!staffId) return false
    const supabase = createServiceRoleClient()
    const { data: staff } = await supabase
      .from("staff")
      .select("pin_hash")
      .eq("id", staffId)
      .single()
    if (!staff?.pin_hash) return false
    return bcrypt.compare(pin, staff.pin_hash)
  } catch {
    return false
  }
}
