import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { ShiftsClient, type ShiftTableRow } from "@/components/admin/staff/ShiftsClient"

type StaffEmbed = { id: string; name: string; role: string }

type ShiftLogRaw = {
  id: string
  clock_in: string
  clock_out: string | null
  created_at: string
  staff: StaffEmbed | StaffEmbed[] | null
}

function normalizeStaff(
  staff: StaffEmbed | StaffEmbed[] | null,
): StaffEmbed | null {
  if (staff == null) return null
  return Array.isArray(staff) ? staff[0] ?? null : staff
}

export default async function AdminStaffShiftsPage() {
  let supabase: ReturnType<typeof createServiceRoleClient>
  try {
    supabase = createServiceRoleClient()
  } catch {
    return (
      <p className="text-destructive">
        Не настроены переменные окружения Supabase (service role).
      </p>
    )
  }

  const { data: rows, error } = await supabase
    .from("shift_logs")
    .select(
      `
      id,
      clock_in,
      clock_out,
      created_at,
      staff:staff_id (
        id,
        name,
        role
      )
    `,
    )
    .order("clock_in", { ascending: false })
    .limit(200)

  if (error) {
    return (
      <p className="text-destructive">
        Не удалось загрузить смены: {error.message}
      </p>
    )
  }

  const { data: orderCounts, error: ordersErr } = await supabase
    .from("orders")
    .select("courier_id, delivered_at")
    .eq("status", "done")
    .not("courier_id", "is", null)
    .not("delivered_at", "is", null)

  if (ordersErr) {
    return (
      <p className="text-destructive">
        Не удалось загрузить заказы: {ordersErr.message}
      </p>
    )
  }

  const orders = (orderCounts ?? []) as {
    courier_id: string
    delivered_at: string
  }[]

  const shifts: ShiftTableRow[] = ((rows ?? []) as ShiftLogRaw[]).map(
    (row) => {
      const staff = normalizeStaff(row.staff)
      const clockInMs = new Date(row.clock_in).getTime()
      const clockOutMs = row.clock_out
        ? new Date(row.clock_out).getTime()
        : null

      let orders_count = 0
      if (staff?.id) {
        for (const o of orders) {
          if (o.courier_id !== staff.id) continue
          const delMs = new Date(o.delivered_at).getTime()
          if (delMs < clockInMs) continue
          if (clockOutMs != null && delMs > clockOutMs) continue
          orders_count += 1
        }
      }

      return {
        id: row.id,
        clock_in: row.clock_in,
        clock_out: row.clock_out,
        created_at: row.created_at,
        staff,
        orders_count,
      }
    },
  )

  return <ShiftsClient shifts={shifts} />
}
