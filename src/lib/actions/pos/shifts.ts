"use server"

import { getCurrentStaff } from "@/lib/actions/pos/auth"
import { createServiceRoleClient } from "@/lib/supabase/service-role"

export async function ensureActiveShift(): Promise<{ clock_in: string }> {
  const staff = await getCurrentStaff()
  if (!staff) {
    throw new Error("Unauthorized")
  }

  const supabase = createServiceRoleClient()

  // Берём самую свежую открытую смену (их может быть несколько из-за дублей)
  const { data: openRows, error: openErr } = await supabase
    .from("shift_logs")
    .select("id, clock_in")
    .eq("staff_id", staff.id)
    .is("clock_out", null)
    .order("clock_in", { ascending: false })
    .limit(1)

  if (openErr) {
    console.error("[ensureActiveShift]", openErr.message)
    throw new Error(openErr.message)
  }

  const open = openRows?.[0] ?? null

  if (open?.clock_in) {
    return { clock_in: open.clock_in as string }
  }

  const now = new Date().toISOString()
  const { data: inserted, error: insErr } = await supabase
    .from("shift_logs")
    .insert({ staff_id: staff.id, clock_in: now })
    .select("clock_in")
    .single()

  if (insErr || !inserted?.clock_in) {
    console.error("[ensureActiveShift] insert", insErr?.message)
    throw new Error(insErr?.message ?? "insert failed")
  }

  return { clock_in: inserted.clock_in as string }
}

export async function closeShift(): Promise<void> {
  const staff = await getCurrentStaff()
  if (!staff) {
    throw new Error("Unauthorized")
  }

  const supabase = createServiceRoleClient()
  const { error } = await supabase
    .from("shift_logs")
    .update({ clock_out: new Date().toISOString() })
    .eq("staff_id", staff.id)
    .is("clock_out", null)

  if (error) {
    console.error("[closeShift]", error.message)
    throw new Error(error.message)
  }
}
