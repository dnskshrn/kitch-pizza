"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  closeCashSession,
  getActiveOrdersCountForShift,
  getExpectedInDrawerBani,
  type ActiveShiftOrderSummary,
} from "@/lib/actions/pos/cash-session"
import { logout } from "@/lib/actions/pos/auth"
import { closeShift } from "@/lib/actions/pos/shifts"
import { createClient } from "@/lib/supabase/client"
import { Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"

type CloseShiftModalProps = {
  open: boolean
  cashSessionId: string
  onClose: () => void
}

const STATUS_LABELS: Record<string, string> = {
  new: "новый",
  confirmed: "подтверждён",
  cooking: "готовится",
  ready: "готов",
  delivery: "в доставке",
}

function formatMdl(bani: number): string {
  return `${(bani / 100).toLocaleString("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} MDL`
}

function formatMdlFromLei(lei: number): string {
  return `${lei.toLocaleString("ru-RU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })} MDL`
}

function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status
}

function shortOrderId(id: string): string {
  return id.slice(0, 8)
}

function discrepancyColor(absDiscrepancyLei: number): string {
  if (absDiscrepancyLei <= 0.5) return "text-muted-foreground"
  if (absDiscrepancyLei <= 50) return "text-amber-600"
  return "text-red-600"
}

export function CloseShiftModal({
  open,
  cashSessionId,
  onClose,
}: CloseShiftModalProps) {
  const router = useRouter()
  const [amount, setAmount] = useState("")
  const [discrepancyReason, setDiscrepancyReason] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)
  const [expectedBalanceBani, setExpectedBalanceBani] = useState<number | null>(
    null,
  )
  const [expectedLoading, setExpectedLoading] = useState(false)
  const [activeOrdersCount, setActiveOrdersCount] = useState(0)
  const [activeOrders, setActiveOrders] = useState<ActiveShiftOrderSummary[]>(
    [],
  )
  const [activeOrdersLoading, setActiveOrdersLoading] = useState(false)

  useEffect(() => {
    if (!open) return

    setAmount("")
    setDiscrepancyReason("")
    setError(null)

    let cancelled = false

    async function load() {
      setExpectedLoading(true)
      setActiveOrdersLoading(true)

      const [expectedRes, ordersRes] = await Promise.all([
        getExpectedInDrawerBani(cashSessionId),
        getActiveOrdersCountForShift(cashSessionId),
      ])

      if (cancelled) return

      setExpectedBalanceBani(
        expectedRes.error == null ? expectedRes.data : null,
      )
      setExpectedLoading(false)

      setActiveOrdersCount(ordersRes.count)
      setActiveOrders(ordersRes.orders)
      setActiveOrdersLoading(false)
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [open, cashSessionId])

  const actualLei = useMemo(() => {
    const trimmed = amount.trim()
    if (trimmed === "") return NaN
    return Number(trimmed)
  }, [amount])

  const expectedLei =
    expectedBalanceBani != null ? expectedBalanceBani / 100 : null

  const discrepancyLei =
    expectedLei != null && Number.isFinite(actualLei)
      ? actualLei - expectedLei
      : null

  const absDiscrepancyLei =
    discrepancyLei != null ? Math.abs(discrepancyLei) : null

  const reasonRequired =
    absDiscrepancyLei != null && absDiscrepancyLei > 50

  const reasonValid =
    !reasonRequired ||
    discrepancyReason.replace(/\s/g, "").length >= 3

  const canSubmit =
    Number.isFinite(actualLei) &&
    actualLei >= 0 &&
    Number.isInteger(actualLei) &&
    reasonValid

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const trimmed = amount.trim()
    if (trimmed === "") {
      setError("Введите сумму в леях.")
      return
    }

    const lei = Number(trimmed)
    if (!Number.isFinite(lei) || lei < 0 || !Number.isInteger(lei)) {
      setError("Укажите целое неотрицательное число (MDL).")
      return
    }

    if (reasonRequired && !reasonValid) {
      setError("Укажите причину расхождения (минимум 3 символа).")
      return
    }

    const closingBalanceActualBani = Math.round(lei * 100)
    const trimmedReason = discrepancyReason.trim()
    const discrepancyReasonToSend =
      reasonRequired && trimmedReason.length > 0 ? trimmedReason : null

    setIsPending(true)
    try {
      const closeRes = await closeCashSession({
        cashSessionId,
        closingBalanceActualBani,
        discrepancyReason: discrepancyReasonToSend,
      })
      if (closeRes.error || !closeRes.data) {
        setError(closeRes.error ?? "Не удалось закрыть кассу.")
        return
      }

      await closeShift()
      await logout()
      await createClient().auth.signOut()
      onClose()
      router.push("/pos")
      router.refresh()
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Не удалось закрыть смену."
      setError(message)
    } finally {
      setIsPending(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Закрытие смены</DialogTitle>
          <DialogDescription>
            Пересчитайте деньги в ящике и введите фактическую сумму
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            После закрытия смены вы будете выведены из системы
          </p>

          {activeOrdersLoading ? (
            <div className="flex items-center gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
              Проверяем незавершённые заказы…
            </div>
          ) : activeOrdersCount > 0 ? (
            <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-950">
              <p className="font-semibold">
                Незавершённые заказы за смену: {activeOrdersCount}
              </p>
              <ul className="mt-2 max-h-32 space-y-1 overflow-y-auto font-mono text-xs">
                {activeOrders.map((order) => (
                  <li key={order.id}>
                    #{shortOrderId(order.id)} · {statusLabel(order.status)} ·{" "}
                    {order.brand_slug ?? "—"} · {formatMdl(order.total)}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-amber-900/70">
                Эти заказы не учтены в кассе. Можно закрыть смену сейчас — они
                перейдут в следующую.
              </p>
            </div>
          ) : null}

          <div className="rounded-xl bg-[#f2f2f2] px-4 py-3">
            <p className="text-sm text-muted-foreground">Ожидается в кассе</p>
            {expectedLoading ? (
              <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Загрузка…
              </div>
            ) : expectedBalanceBani != null ? (
              <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-[#242424]">
                {formatMdl(expectedBalanceBani)}
              </p>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">—</p>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            Если оставляешь сумму следующей смене (например 200 MDL) — инкассируй
            разницу до закрытия через ⋯ → Создать транзакцию.
          </p>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="close-shift-actual"
              className="text-sm font-medium text-[#242424]"
            >
              Сумма в кассе (лей)
            </label>
            <input
              id="close-shift-actual"
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              placeholder="200"
              value={amount}
              onChange={(ev) => setAmount(ev.target.value)}
              disabled={isPending}
              className="w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-base font-medium text-[#242424] outline-none ring-[#ccff00] transition-[box-shadow] focus-visible:ring-2 disabled:opacity-60"
            />
          </div>

          {discrepancyLei != null && expectedLei != null ? (
            <p
              className={`text-sm font-medium tabular-nums ${discrepancyColor(
                Math.abs(discrepancyLei),
              )}`}
            >
              Расхождение:{" "}
              {discrepancyLei >= 0 ? "+" : ""}
              {formatMdlFromLei(discrepancyLei)}
            </p>
          ) : null}

          {reasonRequired ? (
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="close-shift-discrepancy-reason"
                className="text-sm font-medium text-[#242424]"
              >
                Причина расхождения{" "}
                <span className="text-red-600" aria-hidden>
                  *
                </span>
              </label>
              <textarea
                id="close-shift-discrepancy-reason"
                rows={3}
                value={discrepancyReason}
                onChange={(ev) => setDiscrepancyReason(ev.target.value)}
                disabled={isPending}
                placeholder="Например: чаевые в кассе, забытый расход на упаковку, ошибка в стартовом балансе..."
                className="w-full resize-none rounded-xl border border-black/10 bg-white px-4 py-3 text-sm text-[#242424] outline-none ring-[#ccff00] focus-visible:ring-2 disabled:opacity-60"
              />
            </div>
          ) : null}

          {error ? (
            <p className="text-sm font-medium text-red-600" role="alert">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={isPending || !canSubmit}
            className="flex w-full items-center justify-center rounded-xl bg-[#ccff00] px-4 py-3 text-sm font-semibold text-[#242424] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? "Закрываем…" : "Закрыть смену"}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
