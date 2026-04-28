import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { PosAppShell } from "@/components/pos/pos-app-shell"
import { getCurrentStaff } from "@/lib/actions/pos/auth"
import { ensureActiveShift } from "@/lib/actions/pos/shifts"

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

  const { clock_in } = await ensureActiveShift()

  return (
    <PosAppShell staffName={staff!.name} shiftStart={clock_in}>
      {children}
    </PosAppShell>
  )
}
