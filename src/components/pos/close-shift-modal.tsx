"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { closeCashSession } from "@/lib/actions/pos/cash-session"
import { logout } from "@/lib/actions/pos/auth"
import { closeShift } from "@/lib/actions/pos/shifts"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

type CloseShiftModalProps = {
  open: boolean
  cashSessionId: string
  onClose: () => void
}

export function CloseShiftModal({
  open,
  cashSessionId,
  onClose,
}: CloseShiftModalProps) {
  const router = useRouter()
  const [amount, setAmount] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)

  useEffect(() => {
    if (open) {
      setAmount("")
      setError(null)
    }
  }, [open])

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

    const closingBalanceActualBani = Math.round(lei * 100)

    setIsPending(true)
    try {
      const closeRes = await closeCashSession({
        cashSessionId,
        closingBalanceActualBani,
      })
      if (closeRes.error || !closeRes.data) {
        setError(closeRes.error ?? "Не удалось закрыть кассу.")
        return
      }

      await closeShift()
      await logout()
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
            {isPending ? "Закрываем…" : "Закрыть смену"}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
