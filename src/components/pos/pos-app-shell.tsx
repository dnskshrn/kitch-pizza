"use client"

import { CashSessionProvider } from "@/components/pos/cash-session-context"
import { CashSessionGate } from "@/components/pos/cash-session-gate"
import { CourierMapModal } from "@/components/pos/CourierMapModal"
import { PosActionsMenu } from "@/components/pos/pos-actions-menu"
import { PosClockWidget } from "@/components/pos/pos-clock-widget"
import { PosFoodServiceLogo } from "@/components/pos/pos-food-service-logo"
import { PosLogoutButton } from "@/components/pos/pos-logout-button"
import { PosShiftTimer } from "@/components/pos/pos-shift-timer"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { brands, normalizePosBrandSlug } from "@/brands/index"
import type { IncomingCallEvent } from "@/lib/pos/use-incoming-call"
import { useIncomingCall } from "@/lib/pos/use-incoming-call"
import { usePosOrderFromCallBridge } from "@/lib/store/pos-order-from-call-bridge"
import { MapPin, Phone } from "lucide-react"
import { useCallback, useMemo, useRef, useState } from "react"
import { toast } from "sonner"

type PosAppShellProps = {
  children: React.ReactNode
  staffName: string
  staffId: string
  shiftStart: string
  shiftLogId: string
  cashSessionId: string | null
}

function incomingCallBrandDisplayName(brandSlug: string | null): string {
  const raw = brandSlug?.trim()
  if (!raw) return "Не определён"
  const n = normalizePosBrandSlug(raw)
  const cfg = brands.find((b) => b.slug === n)
  return cfg?.name ?? raw
}

/** Окно подтверждения входящего (Realtime `pbx_calls`, cmd=event / INCOMING). */
function IncomingCallDialog({
  call,
  open,
  createBusy,
  onCancel,
  onCreateOrder,
}: {
  call: IncomingCallEvent | null
  open: boolean
  createBusy: boolean
  onCancel: () => void
  onCreateOrder: () => void
}) {
  const callerLine = useMemo(() => {
    if (!call) return "—"
    const name = call.profile_name?.trim()
    if (name) return name
    return call.caller?.trim() || "—"
  }, [call])

  const brandLine = useMemo(
    () => incomingCallBrandDisplayName(call?.brand_slug ?? null),
    [call?.brand_slug],
  )

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel()
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#ccff00] text-[#242424]">
              <Phone className="size-[18px]" aria-hidden />
            </span>
            Входящий звонок
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-2 text-sm">
          <p>
            <span className="text-muted-foreground">Звонит: </span>
            <span className="font-medium text-foreground">{callerLine}</span>
          </p>
          <p>
            <span className="text-muted-foreground">Бренд: </span>
            <span className="font-medium text-foreground">{brandLine}</span>
          </p>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={createBusy}
          >
            Отмена
          </Button>
          <Button
            type="button"
            className="bg-[#242424] text-white hover:bg-[#242424]/90"
            onClick={onCreateOrder}
            disabled={createBusy}
          >
            {createBusy ? "Создание…" : "Создать заказ"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
  const [modalCall, setModalCall] = useState<IncomingCallEvent | null>(null)
  const queueRef = useRef<IncomingCallEvent[]>([])
  const [createFromCallBusy, setCreateFromCallBusy] = useState(false)

  const handleIncomingCall = useCallback((ev: IncomingCallEvent) => {
    setModalCall((cur) => {
      if (!cur) return ev
      queueRef.current.push(ev)
      return cur
    })
  }, [])

  const handleDismissCall = useCallback((callid: string) => {
    setModalCall((m) => {
      const k = m?.callid?.trim()
      if (k === callid) {
        return queueRef.current.shift() ?? null
      }
      queueRef.current = queueRef.current.filter(
        (e) => (e.callid?.trim() ?? e.id) !== callid,
      )
      return m
    })
  }, [])

  useIncomingCall({
    onIncoming: handleIncomingCall,
    onDismiss: handleDismissCall,
  })

  const handleModalCancel = useCallback(() => {
    if (!modalCall) return
    handleDismissCall(modalCall.callid?.trim() || modalCall.id)
  }, [modalCall, handleDismissCall])

  const handleCreateOrderFromCall = useCallback(async () => {
    if (!modalCall) return
    const createFromCall = usePosOrderFromCallBridge.getState().createFromCall
    if (!createFromCall) {
      toast.error("Откройте страницу заказов POS")
      return
    }
    setCreateFromCallBusy(true)
    try {
      await createFromCall({
        brandSlug: modalCall.brand_slug,
        userPhone: modalCall.caller,
        profileId: modalCall.profile_id,
        userName: modalCall.profile_name,
      })
      handleDismissCall(modalCall.callid?.trim() || modalCall.id)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось создать заказ")
    } finally {
      setCreateFromCallBusy(false)
    }
  }, [modalCall, handleDismissCall])

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
      <IncomingCallDialog
        call={modalCall}
        open={modalCall !== null}
        createBusy={createFromCallBusy}
        onCancel={handleModalCancel}
        onCreateOrder={() => void handleCreateOrderFromCall()}
      />
      <CourierMapModal
        isOpen={courierMapOpen}
        onClose={() => setCourierMapOpen(false)}
      />
    </div>
  )
}
