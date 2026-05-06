"use client"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { getCashSession } from "@/lib/actions/pos/cash-session"
import { Loader2 } from "lucide-react"
import { useEffect, useState } from "react"

type ShiftDataModalProps = {
  open: boolean
  shiftLogId: string
  onClose: () => void
}

function formatLei(bani: number): string {
  return `${(Number(bani) / 100).toFixed(2)} L`
}

function txTypeLabel(type: string): string {
  switch (type) {
    case "opening":
      return "Открытие"
    case "order_payment":
      return "Оплата заказа"
    case "expense":
      return "Расход"
    case "income":
      return "Приход"
    case "encashment":
      return "Инкассация"
    default:
      return type
  }
}

type LoadedData = NonNullable<
  Awaited<ReturnType<typeof getCashSession>>["data"]
>

export function ShiftDataModal({
  open,
  shiftLogId,
  onClose,
}: ShiftDataModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<LoadedData | null>(null)

  useEffect(() => {
    if (!open) {
      return
    }

    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      setData(null)
      const res = await getCashSession({ shiftLogId })
      if (cancelled) return
      setLoading(false)
      if (res.error || !res.data) {
        setError(
          res.error === "not_found"
            ? "Кассовая сессия не найдена."
            : (res.error ?? "Ошибка загрузки"),
        )
        return
      }
      setData(res.data)
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [open, shiftLogId])

  const aggregates = data?.aggregates
  const session = data?.session
  const transactions = data?.transactions ?? []

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <DialogContent className="flex max-h-[90vh] max-w-md flex-col gap-0 sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Данные смены</DialogTitle>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2
                className="size-8 animate-spin text-[#242424]"
                aria-label="Загрузка"
              />
            </div>
          ) : null}

          {!loading && error ? (
            <p className="text-sm font-medium text-red-600" role="alert">
              {error}
            </p>
          ) : null}

          {!loading && !error && aggregates && session ? (
            <>
              <div className="flex flex-col gap-2 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Начало смены:</span>
                  <span className="text-right tabular-nums">
                    {formatLei(session.opening_balance_bani)}
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">
                    Наличные с заказов:
                  </span>
                  <span className="text-right tabular-nums text-[#16a34a]">
                    {formatLei(aggregates.cash_in_bani)}
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">
                    Картой с заказов:
                  </span>
                  <span className="text-right tabular-nums">
                    {formatLei(aggregates.card_revenue_bani)}
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Приходы:</span>
                  <span className="text-right tabular-nums text-[#16a34a]">
                    {formatLei(aggregates.income_bani)}
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Расходы:</span>
                  <span className="text-right tabular-nums text-[#dc2626]">
                    {formatLei(aggregates.expenses_bani)}
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Инкассация:</span>
                  <span className="text-right tabular-nums text-[#dc2626]">
                    {formatLei(aggregates.encashment_bani)}
                  </span>
                </div>

                <div className="my-1 h-px bg-[#f2f2f2]" />

                <div className="flex justify-between gap-4 text-base font-bold text-[#242424]">
                  <span>Ожидается в кассе:</span>
                  <span className="text-right tabular-nums">
                    {formatLei(aggregates.expected_in_drawer_bani)}
                  </span>
                </div>
              </div>

              <div className="max-h-64 overflow-y-auto rounded-lg border border-black/10">
                <ul className="divide-y divide-black/5">
                  {transactions.map((t) => {
                    const isIn = t.direction === "in"
                    const bani = Number(t.amount_bani) || 0
                    const lei = (Math.abs(bani) / 100).toFixed(2)
                    const sign = isIn ? "+" : "−"
                    const colorClass = isIn
                      ? "text-[#16a34a]"
                      : "text-[#dc2626]"
                    const time = new Date(t.created_at).toLocaleTimeString(
                      "ru-RU",
                      {
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: false,
                      },
                    )
                    return (
                      <li
                        key={t.id}
                        className="flex items-start justify-between gap-3 px-3 py-2 text-sm"
                      >
                        <div className="min-w-0">
                          <span className="tabular-nums text-muted-foreground">
                            {time}
                          </span>
                          <span className="ml-2 text-[#242424]">
                            {txTypeLabel(t.type)}
                          </span>
                        </div>
                        <span
                          className={`shrink-0 tabular-nums font-medium ${colorClass}`}
                        >
                          {sign}
                          {lei} L
                        </span>
                      </li>
                    )
                  })}
                </ul>
              </div>
            </>
          ) : null}
        </div>

        <Button
          type="button"
          variant="outline"
          className="mt-2 w-full"
          onClick={() => onClose()}
        >
          Закрыть
        </Button>
      </DialogContent>
    </Dialog>
  )
}
