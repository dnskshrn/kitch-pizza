import type { Staff } from "@/lib/actions/staff/staff-actions"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { StaffClient } from "@/components/admin/staff/StaffClient"

export default async function AdminStaffPage() {
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

  const { data, error } = await supabase
    .from("staff")
    .select(
      "id, name, phone, role, is_active, tg_chat_id, tg_link_token, tg_link_token_expires_at, created_at",
    )
    .order("created_at", { ascending: false })

  if (error) {
    return (
      <p className="text-destructive">
        Не удалось загрузить персонал: {error.message}
      </p>
    )
  }

  const staff = (data ?? []) as Staff[]

  return <StaffClient staff={staff} />
}
