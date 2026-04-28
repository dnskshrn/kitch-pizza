"use client"

import { PosClockWidget } from "@/components/pos/pos-clock-widget"
import { PosLogoutButton } from "@/components/pos/pos-logout-button"
import { PosShiftTimer } from "@/components/pos/pos-shift-timer"

type PosAppShellProps = {
  children: React.ReactNode
  staffName: string
  shiftStart: string
}

/** Один клиентский корень для шапки с хуками — избегаем invalid hook call при RSC+Turbopack. */
export function PosAppShell({
  children,
  staffName,
  shiftStart,
}: PosAppShellProps) {
  return (
    <div className="bg-white text-foreground flex min-h-dvh min-w-0 flex-col">
      <div className="shrink-0 p-4 pb-0">
        <header className="flex h-14 min-w-0 shrink-0 items-center gap-2 rounded-2xl bg-[#f2f2f2] px-4">
          <div className="flex min-w-0 flex-1 items-center">
            <span className="text-foreground text-sm font-bold sm:text-base">
              Kitch POS
            </span>
          </div>
          <div className="flex flex-none items-center justify-center px-2 sm:px-4">
            <PosClockWidget />
          </div>
          <div className="flex min-w-0 flex-1 items-center justify-end gap-2 sm:gap-3">
            <span className="text-foreground truncate text-sm font-semibold">
              {staffName}
            </span>
            <PosShiftTimer shiftStart={shiftStart} />
            <PosLogoutButton className="h-9 shrink-0 rounded-lg border-0 bg-white font-semibold text-foreground shadow-sm hover:bg-zinc-50" />
          </div>
        </header>
      </div>
      <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {children}
      </main>
    </div>
  )
}
