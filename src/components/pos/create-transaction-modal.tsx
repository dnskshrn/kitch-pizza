"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { createCashTransaction } from "@/lib/actions/pos/cash-session"
import { useEffect, useState } from "react"

type CreateTransactionModalProps = {
  open: boolean
  cashSessionId: string
  staffId: string
  onClose: () => void
}

type TxKind = "expense" | "income" | "encashment"

const KIND_MAP: Record<
  TxKind,
  { type: "expense" | "income" | "encashment"; direction: "in" | "out" }
> = {
  expense: { type: "expense", direction: "out" },
  income: { type: "income", direction: "in" },
  encashment: { type: "encashment", direction: "out" },
}

type ExpenseCategory =
  | "ingredients"
  | "salary"
  | "utilities"
  | "other"

function formatCreateError(error: string): string {
  switch (error) {
    case "invalid_amount":
      return "Укажите сумму больше нуля."
    case "invalid_direction":
      return "Некорректный тип операции."
    case "session_not_open":
      return "Кассовая сессия закрыта."
    case "server_unavailable":
      return "Сервер недоступен."
    default:
      return error
  }
}

export function CreateTransactionModal({
  open,
  cashSessionId,
  staffId,
  onClose,
}: CreateTransactionModalProps) {
  const [kind, setKind] = useState<TxKind>("expense")
  const [amount, setAmount] = useState("")
  const [category, setCategory] = useState<ExpenseCategory>("ingredients")
  const [description, setDescription] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)

  useEffect(() => {
    if (open) {
      setKind("expense")
      setAmount("")
      setCategory("ingredients")
      setDescription("")
      setError(null)
    }
  }, [open])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const value = Number(amount.replace(",", "."))
    if (!Number.isFinite(value) || value <= 0) {
      setError("Введите сумму больше нуля.")
      return
    }

    const amountBani = Math.round(value * 100)
    if (amountBani <= 0) {
      setError("Введите сумму больше нуля.")
      return
    }

    const { type, direction } = KIND_MAP[kind]

    setIsPending(true)
    try {
      const result = await createCashTransaction({
        cashSessionId,
        type,
        direction,
        amountBani,
        category: type === "expense" ? category : null,
        description: description.trim() || null,
        createdByStaffId: staffId,
      })

      if (result.error || !result.data) {
        setError(formatCreateError(result.error ?? "Ошибка"))
        return
      }

      setKind("expense")
      setAmount("")
      setCategory("ingredients")
      setDescription("")
      onClose()
    } finally {
      setIsPending(false)
    }
  }

  const segmentBtn = (k: TxKind, active: boolean) =>
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
          <DialogTitle>Создать транзакцию</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <span className="mb-2 block text-sm font-medium text-[#242424]">
              Тип
            </span>
            <div className="flex rounded-lg border border-black/10 p-0.5">
              <button
                type="button"
                className={segmentBtn("expense", kind === "expense")}
                onClick={() => setKind("expense")}
              >
                Расход
              </button>
              <button
                type="button"
                className={segmentBtn("income", kind === "income")}
                onClick={() => setKind("income")}
              >
                Приход
              </button>
              <button
                type="button"
                className={segmentBtn("encashment", kind === "encashment")}
                onClick={() => setKind("encashment")}
              >
                Инкассация
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="tx-amount"
              className="text-sm font-medium text-[#242424]"
            >
              Сумма (лей)
            </label>
            <input
              id="tx-amount"
              type="number"
              inputMode="decimal"
              min={0.01}
              step={0.01}
              placeholder="0.00"
              value={amount}
              onChange={(ev) => setAmount(ev.target.value)}
              disabled={isPending}
              className="w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-base font-medium text-[#242424] outline-none ring-[#ccff00] transition-[box-shadow] focus-visible:ring-2 disabled:opacity-60"
            />
          </div>

          {kind === "expense" ? (
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="tx-category"
                className="text-sm font-medium text-[#242424]"
              >
                Категория
              </label>
              <select
                id="tx-category"
                value={category}
                onChange={(e) =>
                  setCategory(e.target.value as ExpenseCategory)
                }
                disabled={isPending}
                className="w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-base font-medium text-[#242424] outline-none ring-[#ccff00] focus-visible:ring-2 disabled:opacity-60"
              >
                <option value="ingredients">Ингредиенты</option>
                <option value="salary">Зарплата</option>
                <option value="utilities">Коммунальные</option>
                <option value="other">Прочее</option>
              </select>
            </div>
          ) : null}

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="tx-desc"
              className="text-sm font-medium text-[#242424]"
            >
              Комментарий (необязательно)
            </label>
            <input
              id="tx-desc"
              type="text"
              placeholder="Комментарий"
              value={description}
              onChange={(ev) => setDescription(ev.target.value)}
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
            {isPending ? "Создаём…" : "Создать"}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
