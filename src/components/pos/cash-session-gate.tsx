"use client"

import { openCashSession } from "@/lib/actions/pos/cash-session"
import { useState } from "react"

type CashSessionGateProps = {
  shiftLogId: string
  staffId: string
  onSessionOpened: (sessionId: string) => void
}

function formatOpenError(error: string): string {
  switch (error) {
    case "session_already_exists":
      return "Касса для этой смены уже открыта."
    case "server_unavailable":
      return "Сервер недоступен. Попробуйте ещё раз."
    default:
      return error
  }
}

export function CashSessionGate({
  shiftLogId,
  staffId,
  onSessionOpened,
}: CashSessionGateProps) {
  const [amount, setAmount] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)

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

    const openingBalanceBani = Math.round(lei * 100)

    setIsPending(true)
    try {
      const result = await openCashSession({
        shiftLogId,
        openingBalanceBani,
        createdByStaffId: staffId,
      })
      if (result.error || !result.data) {
        setError(formatOpenError(result.error ?? "Не удалось открыть кассу."))
        return
      }
      onSessionOpened(result.data.id)
    } finally {
      setIsPending(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-white p-4 text-[#242424]">
      <div className="w-full max-w-md rounded-2xl bg-[#f2f2f2] p-8 shadow-sm">
        <h1 className="text-center text-xl font-bold tracking-tight">
          Открытие кассы
        </h1>
        <p className="mt-2 text-center text-sm text-[#242424]/80">
          Введите сумму в денежном ящике на начало смены
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <div>
            <label htmlFor="opening-balance" className="sr-only">
              Сумма, MDL
            </label>
            <input
              id="opening-balance"
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
            <p className="mt-1.5 text-xs text-[#242424]/60">леев (MDL)</p>
          </div>

          {error ? (
            <p className="text-sm font-medium text-red-600" role="alert">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={isPending}
            className="flex w-full items-center justify-center rounded-xl bg-[#ccff00] px-4 py-3 text-base font-semibold text-[#242424] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? "Открываем…" : "Открыть кассу"}
          </button>
        </form>
      </div>
    </div>
  )
}
