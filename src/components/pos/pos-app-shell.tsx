"use client"

import { CashSessionProvider } from "@/components/pos/cash-session-context"
import { CashSessionGate } from "@/components/pos/cash-session-gate"
import { CourierMapModal } from "@/components/pos/CourierMapModal"
import { PosActionsMenu } from "@/components/pos/pos-actions-menu"
import { PosClockWidget } from "@/components/pos/pos-clock-widget"
import { PosFoodServiceLogo } from "@/components/pos/pos-food-service-logo"
import { PosLogoutButton } from "@/components/pos/pos-logout-button"
import { PosShiftTimer } from "@/components/pos/pos-shift-timer"
import { MapPin } from "lucide-react"
import { useState } from "react"

type PosAppShellProps = {
  children: React.ReactNode
  staffName: string
  staffId: string
  shiftStart: string
  shiftLogId: string
  cashSessionId: string | null
}

/** Один клиентский корень для шапки с хуками — избегаем invalid hook call при RSC+Turbopack. */
export function PosAppShell({
  children,
  staffName,
  staffId,
  shiftStart,
  shiftLogId,
  cashSessionId,
}: PosAppShellProps) {
  const [sessionId, setSessionId] = useState<string | null>(cashSessionId)
  const [courierMapOpen, setCourierMapOpen] = useState(false)

  if (!sessionId) {
    return (
      <CashSessionGate
        shiftLogId={shiftLogId}
        staffId={staffId}
        onSessionOpened={setSessionId}
      />
    )
  }

  return (
    <div className="flex h-screen min-h-0 min-w-0 flex-col overflow-hidden bg-white text-foreground">
      <div className="shrink-0 p-4 pb-0">
        <header className="flex h-14 min-w-0 shrink-0 items-center gap-2 rounded-2xl bg-[#f2f2f2] px-4">
          <div className="flex min-w-0 flex-1 items-center">
            <PosFoodServiceLogo />
          </div>
          <div className="flex flex-none items-center justify-center px-2 sm:px-4">
            <PosClockWidget />
          </div>
          <div className="flex min-w-0 flex-1 items-center justify-end gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => setCourierMapOpen(true)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-[#242424] shadow-sm transition-colors hover:bg-zinc-50"
              aria-label="Карта курьеров"
            >
              <MapPin className="size-4" />
            </button>
            <PosActionsMenu
              cashSessionId={sessionId}
              shiftLogId={shiftLogId}
              staffId={staffId}
            />
            <span className="text-foreground truncate text-sm font-semibold">
              {staffName}
            </span>
            <PosShiftTimer shiftStart={shiftStart} />
            <PosLogoutButton className="h-9 shrink-0 rounded-lg border-0 bg-white font-semibold text-foreground shadow-sm hover:bg-zinc-50" />
          </div>
        </header>
      </div>
      <main className="flex h-[calc(100vh_-_72px)] min-h-0 flex-col overflow-hidden">
        <CashSessionProvider cashSessionId={sessionId} staffId={staffId}>
          {children}
        </CashSessionProvider>
      </main>
      <CourierMapModal
        isOpen={courierMapOpen}
        onClose={() => setCourierMapOpen(false)}
      />
    </div>
  )
}
