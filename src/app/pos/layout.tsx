import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { PosAppShell } from "@/components/pos/pos-app-shell"
import { getCurrentStaff } from "@/lib/actions/pos/auth"
import { ensureActiveShift } from "@/lib/actions/pos/shifts"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export default async function PosLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = (await headers()).get("x-pathname") ?? ""
  const isPosLogin = pathname === "/pos/login"

  const staff = await getCurrentStaff()

  if (!isPosLogin && !staff) {
    redirect("/pos/login")
  }

  if (isPosLogin && staff) {
    redirect("/pos")
  }

  if (isPosLogin) {
    return <>{children}</>
  }

  const { id: shiftLogId, clock_in } = await ensureActiveShift()

  const supabase = await createClient()
  const { data: cashSession } = await (supabase.from("cash_sessions") as any)
    .select("id, status")
    .eq("shift_log_id", shiftLogId)
    .eq("status", "open")
    .maybeSingle()

  return (
    <PosAppShell
      staffName={staff!.name}
      staffId={staff!.id}
      shiftStart={clock_in}
      shiftLogId={shiftLogId}
      hasCashSession={!!cashSession}
      cashSessionId={cashSession?.id ?? null}
    >
      {children}
    </PosAppShell>
  )
}
