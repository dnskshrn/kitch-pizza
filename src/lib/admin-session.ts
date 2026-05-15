import { createClient } from "@/lib/supabase/server"

/** Сессия админки (Supabase Auth). `staffId` — идентификатор действующего администратора для аудита (UUID пользователя Auth). */
export async function getAdminSession(): Promise<{
  staffId: string
  email: string | null
} | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  return { staffId: user.id, email: user.email ?? null }
}
