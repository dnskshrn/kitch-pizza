"use client"

import { CashSessionProvider } from "@/components/pos/cash-session-context"
import { CashSessionGate } from "@/components/pos/cash-session-gate"
import { CourierMapModal } from "@/components/pos/CourierMapModal"
import { PosActionsMenu } from "@/components/pos/pos-actions-menu"
import { PosClockWidget } from "@/components/pos/pos-clock-widget"
import { PosFoodServiceLogo } from "@/components/pos/pos-food-service-logo"
import { PosLogoutButton } from "@/components/pos/pos-logout-button"
import { PosShiftTimer } from "@/components/pos/pos-shift-timer"
import type { IncomingCallEvent } from "@/lib/pos/use-incoming-call"
import { useIncomingCall } from "@/lib/pos/use-incoming-call"
import { MapPin, Phone, X } from "lucide-react"
import { useCallback, useMemo, useState } from "react"

type PosAppShellProps = {
  children: React.ReactNode
  staffName: string
  staffId: string
  shiftStart: string
  shiftLogId: string
  cashSessionId: string | null
}

/** Плавающий стек карточек входящего (Realtime `pbx_calls`, cmd=event / INCOMING). */
function IncomingCallsStack({
  entries,
  onDismiss,
}: {
  entries: IncomingCallEvent[]
  onDismiss: (callid: string) => void
}) {
  if (entries.length === 0) return null

  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-[90] flex max-h-[min(520px,calc(100vh-140px))] w-[min(calc(100vw-24px),320px)] flex-col gap-2 overflow-y-auto pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      {entries.map((ev) => {
        const callid =
          typeof ev.callid === "string" && ev.callid.trim()
            ? ev.callid.trim()
            : ev.id
        return (
          <div
            key={callid}
            className="pointer-events-auto flex shrink-0 flex-col gap-2 rounded-2xl border border-[#3a3a3a] bg-[#242424] p-4 text-white shadow-xl"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#ccff00] text-[#242424]">
                  <Phone className="size-[18px]" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="text-[13px] font-bold leading-tight text-[#ccff00]">
                    Входящий звонок
                  </p>
                  <p className="truncate font-mono text-[17px] font-bold tabular-nums">
                    {ev.caller?.trim() || "—"}
                  </p>
                  {ev.profile_name ? (
                    <p className="truncate text-[13px] font-medium text-[#e4e4e4]">
                      {ev.profile_name}
                    </p>
                  ) : null}
                </div>
              </div>
              <button
                type="button"
                aria-label="Скрыть"
                className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-white transition-colors hover:bg-white/20"
                onClick={() => onDismiss(callid)}
              >
                <X className="size-[18px]" />
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
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
  const [incomingCallsByCallId, setIncomingCallsByCallId] = useState<
    Map<string, IncomingCallEvent>
  >(() => new Map())

  const handleIncomingCall = useCallback((ev: IncomingCallEvent) => {
    const key =
      typeof ev.callid === "string" && ev.callid.trim()
        ? ev.callid.trim()
        : ev.id
    setIncomingCallsByCallId((prev) => {
      const next = new Map(prev)
      next.set(key, ev)
      return next
    })
  }, [])

  const handleDismissCall = useCallback((callid: string) => {
    setIncomingCallsByCallId((prev) => {
      const next = new Map(prev)
      next.delete(callid)
      return next
    })
  }, [])

  useIncomingCall({
    onIncoming: handleIncomingCall,
    onDismiss: handleDismissCall,
  })

  const incomingSorted = useMemo(() => {
    return [...incomingCallsByCallId.values()].sort((a, b) =>
      String(b.created_at).localeCompare(String(a.created_at)),
    )
  }, [incomingCallsByCallId])

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
      <IncomingCallsStack
        entries={incomingSorted}
        onDismiss={handleDismissCall}
      />
      <CourierMapModal
        isOpen={courierMapOpen}
        onClose={() => setCourierMapOpen(false)}
      />
    </div>
  )
}
