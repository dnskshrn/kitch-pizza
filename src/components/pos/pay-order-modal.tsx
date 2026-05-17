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
  paymentMethod: "cash" | "card" | "aggregator_card"
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

export function PayOrderModal({
  open,
  orderId,
  orderTotal,
  paymentMethod,
  isAggregatorOrder = false,
  cashSessionId,
  staffId,
  onClose,
  onSuccess,
}: PayOrderModalProps) {
  const [selectedMethod, setSelectedMethod] = useState<"cash" | "card">(
    paymentMethod === "aggregator_card" ? "card" : paymentMethod,
  )
  const [error, setError] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)

  useEffect(() => {
    if (open) {
      setSelectedMethod(
        paymentMethod === "aggregator_card" ? "card" : paymentMethod,
      )
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
        paymentMethod: selectedMethod,
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
