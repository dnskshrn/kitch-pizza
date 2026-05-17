"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { payOrder } from "@/lib/actions/pos/cash-session"
import { useEffect, useState } from "react"

type PayOrderModalProps = {
  open: boolean
  orderId: string
  orderTotal: number
  paymentMethod: "cash" | "card" | "aggregator_card" | "mixed"
  /** Для split: суммы из заказа (бани). */
  cashAmount?: number | null
  cardAmount?: number | null
  /** Заказ Glovo (delivery_mode = aggregator): подписи и оплата «картой» без кассы. */
  isAggregatorOrder?: boolean
  cashSessionId: string
  staffId: string
  onClose: () => void
  onSuccess: () => void
}

function formatPayError(error: string): string {
  switch (error) {
    case "invalid_order_status":
      return "Нельзя оплатить заказ в текущем статусе."
    case "already_paid":
      return "Заказ уже оплачен."
    case "session_not_open":
      return "Кассовая сессия закрыта."
    case "server_unavailable":
      return "Сервер недоступен."
    default:
      return error
  }
}

function paymentMethodForToggle(
  m: PayOrderModalProps["paymentMethod"],
): "cash" | "card" {
  if (m === "aggregator_card") return "card"
  if (m === "mixed") return "cash"
  return m
}

export function PayOrderModal({
  open,
  orderId,
  orderTotal,
  paymentMethod,
  cashAmount = null,
  cardAmount = null,
  isAggregatorOrder = false,
  cashSessionId,
  staffId,
  onClose,
  onSuccess,
}: PayOrderModalProps) {
  const [selectedMethod, setSelectedMethod] = useState<"cash" | "card">(
    paymentMethodForToggle(paymentMethod),
  )
  const [error, setError] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)

  const isSplit =
    paymentMethod === "mixed" &&
    (cashAmount ?? 0) > 0 &&
    (cardAmount ?? 0) > 0

  useEffect(() => {
    if (open) {
      setSelectedMethod(paymentMethodForToggle(paymentMethod))
      setError(null)
    }
  }, [open, paymentMethod])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setIsPending(true)
    try {
      const result = await payOrder({
        orderId,
        cashSessionId,
        paymentMethod: isSplit ? "cash" : selectedMethod,
        createdByStaffId: staffId,
      })
      if (result.error || !result.data) {
        setError(formatPayError(result.error ?? "Ошибка оплаты"))
        return
      }
      onSuccess()
      onClose()
    } finally {
      setIsPending(false)
    }
  }

  const segmentBtn = (method: "cash" | "card", active: boolean) =>
    `flex-1 rounded-md px-2 py-2 text-sm font-medium transition-colors ${
      active
        ? "bg-[#242424] text-white"
        : "bg-white text-[#242424] hover:bg-zinc-50"
    }`

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Принять оплату</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <p className="text-center text-2xl font-bold tabular-nums text-[#242424]">
            {(orderTotal / 100).toFixed(2)} L
          </p>

          <div>
            <span className="mb-2 block text-sm font-medium text-[#242424]">
              Способ оплаты
            </span>
            {isAggregatorOrder ? (
              <span className="mb-2 inline-flex rounded-md border border-orange-300 bg-orange-100 px-2 py-0.5 text-[11px] font-semibold text-orange-900">
                Заказ Glovo
              </span>
            ) : null}
            <div className="flex flex-col gap-1">
              {isSplit ? (
                <div className="flex flex-col gap-1.5 rounded-lg bg-muted/50 p-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">💵 Наличными</span>
                    <span className="font-medium">
                      {(cashAmount! / 100).toFixed(0)} MDL
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">💳 Картой</span>
                    <span className="font-medium">
                      {(cardAmount! / 100).toFixed(0)} MDL
                    </span>
                  </div>
                </div>
              ) : paymentMethod === "mixed" ? (
                <p className="px-0.5 text-center text-[11px] text-muted-foreground">
                  Оплата частями по суммам из заказа (наличные + карта)
                </p>
              ) : (
                <div className="flex rounded-lg border border-black/10 p-0.5">
                  <button
                    type="button"
                    className={segmentBtn("cash", selectedMethod === "cash")}
                    onClick={() => setSelectedMethod("cash")}
                  >
                    Наличные
                  </button>
                  <button
                    type="button"
                    className={segmentBtn("card", selectedMethod === "card")}
                    onClick={() => setSelectedMethod("card")}
                  >
                    Карта
                  </button>
                </div>
              )}
              {isAggregatorOrder ? (
                <div className="grid grid-cols-2 gap-2 px-0.5">
                  <span className="block min-h-[2rem] text-center text-[11px] leading-snug text-[#808080]" />
                  <span className="block text-center text-[11px] leading-snug text-[#808080]">
                    Карта Glovo (без записи в кассу)
                  </span>
                </div>
              ) : null}
            </div>
          </div>

          {error ? (
            <p className="text-sm font-medium text-red-600" role="alert">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={isPending}
            className="flex w-full items-center justify-center rounded-xl bg-[#ccff00] px-4 py-3 text-sm font-semibold text-[#242424] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? "Обрабатываем…" : "Подтвердить оплату"}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
