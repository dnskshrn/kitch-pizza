"use client"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  getCashSession,
  type CashSessionPaymentBreakdownBucket,
  type CashSessionRecentManualTransaction,
} from "@/lib/actions/pos/cash-session"
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

function formatMdl(bani: number): string {
  return `${(bani / 100).toLocaleString("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} MDL`
}

function manualTxTypeLabel(
  type: CashSessionRecentManualTransaction["type"],
): string {
  switch (type) {
    case "expense":
      return "Расход"
    case "income":
      return "Доход"
    case "encashment":
      return "Инкассация"
    default:
      return type
  }
}

function capitalizeCategory(category: string | null): string {
  if (!category) return ""
  const labels: Record<string, string> = {
    ingredients: "Ingredients",
    salary: "Salary",
    utilities: "Utilities",
    other: "Other",
  }
  return labels[category.toLowerCase()] ?? category
}

function formatManualDetail(tx: CashSessionRecentManualTransaction): string {
  if (tx.type === "encashment") {
    const destination = tx.encashment_destination?.trim()
    if (destination) return destination
    const description = tx.description?.trim()
    if (description) return description
    return "—"
  }

  const description = tx.description?.trim()
  if (description) return description

  const category = capitalizeCategory(tx.category)
  if (category) return category

  return "—"
}

function formatManualJournalAmount(tx: CashSessionRecentManualTransaction): {
  text: string
  className: string
} {
  const lei = (Math.abs(tx.amount_bani) / 100).toLocaleString("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  const sign = tx.direction === "in" ? "+" : "−"
  const voided = tx.voided_at != null
  return {
    text: `${sign}${lei} MDL`,
    className: voided
      ? "tabular-nums font-medium"
      : tx.direction === "in"
        ? "tabular-nums font-medium text-[#16a34a]"
        : "tabular-nums font-medium text-[#dc2626]",
  }
}

function ManualJournalTransactionRow({
  tx,
}: {
  tx: CashSessionRecentManualTransaction
}) {
  const voided = tx.voided_at != null
  const time = new Date(tx.created_at).toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
  const detail = formatManualDetail(tx)
  const amount = formatManualJournalAmount(tx)

  return (
    <li
      className={`px-3 py-2 text-sm ${
        voided ? "text-muted-foreground line-through" : "text-[#242424]"
      }`}
    >
      <span
        className={
          voided ? "tabular-nums" : "tabular-nums text-muted-foreground"
        }
      >
        {time}
      </span>
      <span> · </span>
      <span>{manualTxTypeLabel(tx.type)}</span>
      <span> · </span>
      <span className={amount.className}>{amount.text}</span>
      <span> · </span>
      <span>{detail}</span>
      <span> · </span>
      <span>{tx.created_by_name ?? "—"}</span>
    </li>
  )
}

type LoadedData = NonNullable<
  Awaited<ReturnType<typeof getCashSession>>["data"]
>

function BreakdownRow({
  label,
  bucket,
}: {
  label: string
  bucket: CashSessionPaymentBreakdownBucket
}) {
  const muted = bucket.count === 0
  return (
    <div
      className={`flex justify-between gap-4 text-sm ${
        muted ? "text-muted-foreground" : "text-[#242424]"
      }`}
    >
      <span>{label}</span>
      <span className="text-right tabular-nums">
        {formatMdl(bucket.amount_bani)} · {bucket.count} шт
      </span>
    </div>
  )
}

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
  const paymentBreakdown = data?.payment_breakdown
  const manualBreakdown = data?.manual_breakdown
  const recentManualTransactions = data?.recent_manual_transactions ?? []
  const totalOrderPaymentsBani = paymentBreakdown
    ? paymentBreakdown.own_cash.amount_bani +
      paymentBreakdown.own_card.amount_bani +
      paymentBreakdown.glovo_cash.amount_bani
    : 0

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

          {!loading &&
          !error &&
          aggregates &&
          session &&
          paymentBreakdown &&
          manualBreakdown ? (
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

              <section className="flex flex-col gap-2">
                <h3 className="text-sm font-semibold text-[#242424]">
                  Оплаты заказов
                </h3>
                <div className="flex flex-col gap-2">
                  <BreakdownRow
                    label="Наличные"
                    bucket={paymentBreakdown.own_cash}
                  />
                  <BreakdownRow
                    label="Картой"
                    bucket={paymentBreakdown.own_card}
                  />
                  <BreakdownRow
                    label="Glovo наличные"
                    bucket={paymentBreakdown.glovo_cash}
                  />
                  <div className="flex justify-between gap-4 pt-1 text-sm font-bold text-[#242424]">
                    <span>Всего по заказам через кассу:</span>
                    <span className="text-right tabular-nums">
                      {formatMdl(totalOrderPaymentsBani)}
                    </span>
                  </div>
                </div>
              </section>

              <section className="flex min-h-0 flex-col gap-2">
                <h3 className="text-sm font-semibold text-[#242424]">
                  Операции за смену
                </h3>
                <div className="flex flex-col gap-2">
                  <BreakdownRow
                    label="Расходы"
                    bucket={manualBreakdown.expense}
                  />
                  <BreakdownRow
                    label="Доходы"
                    bucket={manualBreakdown.income}
                  />
                  <BreakdownRow
                    label="Инкассации"
                    bucket={manualBreakdown.encashment}
                  />
                </div>
                <div className="max-h-[280px] overflow-y-auto rounded-lg border border-black/10">
                  {recentManualTransactions.length === 0 ? (
                    <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                      Пока операций не было
                    </p>
                  ) : (
                    <ul className="divide-y divide-black/5">
                      {recentManualTransactions.map((tx) => (
                        <ManualJournalTransactionRow key={tx.id} tx={tx} />
                      ))}
                    </ul>
                  )}
                </div>
              </section>
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
