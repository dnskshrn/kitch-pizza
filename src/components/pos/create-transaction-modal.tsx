"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { getExpenseCategories } from "@/lib/actions/admin/finance"
import { createCashTransaction } from "@/lib/actions/pos/cash-session"
import type { ExpenseCategory as FinanceExpenseCategory } from "@/types/finance"
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

type LegacyExpenseCategory =
  | "ingredients"
  | "salary"
  | "utilities"
  | "other"

const SALARY_ADVANCE_EXPENSE_CATEGORY_ID =
  "ec000001-0000-0000-0000-000000000004"
const SALARY_SETTLEMENT_EXPENSE_CATEGORY_ID =
  "ec000001-0000-0000-0000-000000000005"
const OTHER_EXPENSE_CATEGORY_ID = "ec000001-0000-0000-0000-000000000015"

function isSalaryExpenseCategoryId(expenseCategoryId: string): boolean {
  return (
    expenseCategoryId === SALARY_ADVANCE_EXPENSE_CATEGORY_ID ||
    expenseCategoryId === SALARY_SETTLEMENT_EXPENSE_CATEGORY_ID
  )
}

function toLegacyExpenseCategory(
  category: FinanceExpenseCategory | undefined,
): LegacyExpenseCategory | null {
  if (!category) return null

  const normalizedName = category.name.trim().toLowerCase()

  if (normalizedName.includes("зарплат")) {
    return "salary"
  }

  if (normalizedName.includes("коммун")) {
    return "utilities"
  }

  if (category.type === "variable") {
    return "ingredients"
  }

  return "other"
}

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
  const [expenseCategories, setExpenseCategories] = useState<
    FinanceExpenseCategory[]
  >([])
  const [expenseCategoryId, setExpenseCategoryId] = useState("")
  const [staffRecipient, setStaffRecipient] = useState("")
  const [description, setDescription] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [categoriesError, setCategoriesError] = useState<string | null>(null)
  const [isCategoriesLoading, setIsCategoriesLoading] = useState(true)
  const [isPending, setIsPending] = useState(false)

  const isExpense = kind === "expense"
  const selectedExpenseCategory = expenseCategories.find(
    (category) => category.id === expenseCategoryId,
  )
  const isSalaryCategory = isSalaryExpenseCategoryId(expenseCategoryId)
  const isDescriptionRequired =
    expenseCategoryId === OTHER_EXPENSE_CATEGORY_ID ||
    selectedExpenseCategory?.requires_description === true
  const expenseVariableCategories = expenseCategories.filter(
    (category) => category.type === "variable",
  )
  const expenseFixedCategories = expenseCategories.filter(
    (category) => category.type === "fixed",
  )
  const expenseOperationalCategories = expenseCategories.filter(
    (category) =>
      category.type === "operational" || category.type === "commission",
  )
  const isSubmitDisabled =
    isPending ||
    (isExpense &&
      (isCategoriesLoading ||
        !expenseCategoryId ||
        (isDescriptionRequired && !description.trim())))

  useEffect(() => {
    let isActive = true

    async function loadExpenseCategories(): Promise<void> {
      setIsCategoriesLoading(true)
      setCategoriesError(null)

      try {
        const categories = await getExpenseCategories()
        if (!isActive) return
        setExpenseCategories(categories)
      } catch (loadError) {
        if (!isActive) return
        setCategoriesError(
          loadError instanceof Error
            ? loadError.message
            : "Не удалось загрузить категории расходов.",
        )
      } finally {
        if (isActive) {
          setIsCategoriesLoading(false)
        }
      }
    }

    void loadExpenseCategories()

    return () => {
      isActive = false
    }
  }, [])

  useEffect(() => {
    if (open) {
      setKind("expense")
      setAmount("")
      setExpenseCategoryId("")
      setStaffRecipient("")
      setDescription("")
      setError(null)
    }
  }, [open])

  useEffect(() => {
    if (kind !== "expense") {
      setExpenseCategoryId("")
      setStaffRecipient("")
    }
  }, [kind])

  useEffect(() => {
    if (!isSalaryCategory && staffRecipient) {
      setStaffRecipient("")
    }
  }, [isSalaryCategory, staffRecipient])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (isExpense && !expenseCategoryId) {
      setError("Выберите категорию расхода.")
      return
    }

    if (isExpense && isDescriptionRequired && !description.trim()) {
      setError("Добавьте описание для категории «Прочее».")
      return
    }

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
        category:
          type === "expense"
            ? toLegacyExpenseCategory(selectedExpenseCategory)
            : null,
        expense_category_id: type === "expense" ? expenseCategoryId : undefined,
        description: description.trim() || null,
        createdByStaffId: staffId,
      })

      if (result.error || !result.data) {
        setError(formatCreateError(result.error ?? "Ошибка"))
        return
      }

      setKind("expense")
      setAmount("")
      setExpenseCategoryId("")
      setStaffRecipient("")
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

          <div
            className={`grid overflow-hidden transition-all duration-200 ease-out ${
              isExpense
                ? "grid-rows-[1fr] opacity-100 translate-y-0"
                : "grid-rows-[0fr] opacity-0 -translate-y-2"
            }`}
            aria-hidden={!isExpense}
          >
            <div className="overflow-hidden">
              <div className="flex flex-col gap-1.5 pb-0.5">
                <label
                  htmlFor="tx-expense-category"
                  className="text-sm font-medium text-[#242424]"
                >
                  Категория расхода
                </label>
                <Select
                  value={expenseCategoryId || undefined}
                  onValueChange={setExpenseCategoryId}
                  disabled={isPending || isCategoriesLoading}
                >
                  <SelectTrigger
                    id="tx-expense-category"
                    className="h-[50px] w-full rounded-xl border-black/10 bg-white px-4 text-base font-medium text-[#242424]"
                  >
                    <SelectValue
                      placeholder={
                        isCategoriesLoading
                          ? "Загружаем категории…"
                          : "Выберите категорию"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {expenseVariableCategories.length > 0 ? (
                      <SelectGroup>
                        <SelectLabel>Переменные</SelectLabel>
                        {expenseVariableCategories.map((category) => (
                          <SelectItem key={category.id} value={category.id}>
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ) : null}

                    {expenseFixedCategories.length > 0 ? (
                      <SelectGroup>
                        <SelectLabel>Постоянные</SelectLabel>
                        {expenseFixedCategories.map((category) => (
                          <SelectItem key={category.id} value={category.id}>
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ) : null}

                    {expenseOperationalCategories.length > 0 ? (
                      <SelectGroup>
                        <SelectLabel>Операционные</SelectLabel>
                        {expenseOperationalCategories.map((category) => (
                          <SelectItem key={category.id} value={category.id}>
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ) : null}
                  </SelectContent>
                </Select>

                {categoriesError ? (
                  <p className="text-sm font-medium text-red-600" role="alert">
                    {categoriesError}
                  </p>
                ) : null}

                {!isCategoriesLoading && !expenseCategoryId ? (
                  <p className="text-sm font-medium text-red-600">
                    Выберите категорию
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          <div
            className={`grid overflow-hidden transition-all duration-200 ease-out ${
              isExpense && isSalaryCategory
                ? "grid-rows-[1fr] opacity-100 translate-y-0"
                : "grid-rows-[0fr] opacity-0 -translate-y-2"
            }`}
            aria-hidden={!(isExpense && isSalaryCategory)}
          >
            <div className="overflow-hidden">
              <div className="flex flex-col gap-1.5 pb-0.5">
                <label
                  htmlFor="tx-staff-recipient"
                  className="text-sm font-medium text-[#242424]"
                >
                  Сотрудник
                </label>
                <input
                  id="tx-staff-recipient"
                  type="text"
                  placeholder="Имя сотрудника"
                  value={staffRecipient}
                  onChange={(ev) => setStaffRecipient(ev.target.value)}
                  disabled={isPending}
                  className="w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-base font-medium text-[#242424] outline-none ring-[#ccff00] transition-[box-shadow] focus-visible:ring-2 disabled:opacity-60"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="tx-desc"
              className="text-sm font-medium text-[#242424]"
            >
              {isExpense ? "Описание" : "Комментарий (необязательно)"}
            </label>
            <input
              id="tx-desc"
              type="text"
              placeholder={isExpense ? "Описание расхода" : "Комментарий"}
              value={description}
              onChange={(ev) => setDescription(ev.target.value)}
              disabled={isPending}
              className="w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-base font-medium text-[#242424] outline-none ring-[#ccff00] transition-[box-shadow] focus-visible:ring-2 disabled:opacity-60"
            />
            {isExpense && isDescriptionRequired && !description.trim() ? (
              <p className="text-sm font-medium text-red-600">
                Опишите расход для категории «Прочее»
              </p>
            ) : null}
          </div>

          <div
            className={`grid overflow-hidden transition-all duration-200 ease-out ${
              isExpense
                ? "grid-rows-[1fr] opacity-100 translate-y-0"
                : "grid-rows-[0fr] opacity-0 -translate-y-2"
            }`}
            aria-hidden={!isExpense}
          >
            <div className="overflow-hidden">
              <div className="flex flex-col gap-1.5 pb-0.5">
                <label
                  htmlFor="tx-payment-method"
                  className="text-sm font-medium text-[#242424]"
                >
                  Способ оплаты
                </label>
                <input
                  id="tx-payment-method"
                  type="text"
                  value="Наличные"
                  disabled
                  className="w-full rounded-xl border border-black/10 bg-zinc-50 px-4 py-3 text-base font-medium text-[#242424] outline-none disabled:opacity-100"
                />
              </div>
            </div>
          </div>

          {error ? (
            <p className="text-sm font-medium text-red-600" role="alert">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitDisabled}
            className="flex w-full items-center justify-center rounded-xl bg-[#ccff00] px-4 py-3 text-sm font-semibold text-[#242424] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? "Создаём…" : "Создать"}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
