"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import {
  format as formatDate,
  parseISO,
} from "date-fns"
import { Plus, ReceiptText, Trash2 } from "lucide-react"
import Link from "next/link"
import {
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation"
import { useEffect, useMemo, useState, useTransition } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { StaffCombobox } from "@/components/admin/finances/staff-combobox"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  createExpense,
  deleteExpense,
} from "@/lib/actions/admin/finance"
import { formatMdl } from "@/lib/format-mdl"
import type {
  Expense,
  ExpenseCategory,
  FinanceSettings,
} from "@/types/finance"

const SALARY_ADVANCE_EXPENSE_CATEGORY_ID =
  "ec000001-0000-0000-0000-000000000004"
const SALARY_SETTLEMENT_EXPENSE_CATEGORY_ID =
  "ec000001-0000-0000-0000-000000000005"
const OTHER_EXPENSE_CATEGORY_ID = "ec000001-0000-0000-0000-000000000015"

const expenseFormSchema = z
  .object({
    expense_category_id: z.string().min(1, "Выберите категорию"),
    amount: z
      .number({ invalid_type_error: "Введите сумму" })
      .refine((value) => Number.isFinite(value), "Введите сумму")
      .positive("Сумма > 0"),
    payment_source: z.enum(["bank_transfer", "card_online", "cash_manual"]),
    description: z.string(),
    expense_date: z.string().min(1, "Укажите дату"),
    staff_recipient: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (
      data.expense_category_id === OTHER_EXPENSE_CATEGORY_ID &&
      data.description.trim().length === 0
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["description"],
        message: "Добавьте описание для категории «Прочее»",
      })
    }
  })

type ExpenseFormValues = z.infer<typeof expenseFormSchema>

type ExpensesClientProps = {
  categories: ExpenseCategory[]
  expenses: Expense[]
  financeSettings: FinanceSettings
  staffList: { id: string; name: string }[]
}

type SummaryCardData = {
  label: string
  amountBani: number
  count: number
}

type NavItem = {
  href: string
  label: string
}

const NAV_ITEMS: NavItem[] = [
  { href: "/admin/finances", label: "P&L" },
  { href: "/admin/finances/expenses", label: "Расходы" },
  { href: "/admin/finances/glovo", label: "Glovo" },
]

function toYmd(value: Date): string {
  return formatDate(value, "yyyy-MM-dd")
}

function formatExpenseDate(value: string): string {
  return formatDate(parseISO(value), "dd.MM.yyyy")
}

function recordsLabel(count: number): string {
  const mod10 = count % 10
  const mod100 = count % 100

  if (mod10 === 1 && mod100 !== 11) return "запись"
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return "записи"
  }
  return "записей"
}

function paymentSourceLabel(source: Expense["payment_source"]): string {
  switch (source) {
    case "bank_transfer":
      return "Перевод"
    case "card_online":
      return "Карта онлайн"
    case "cash_manual":
      return "Наличные"
    default:
      return source
  }
}

function paymentSourceBadgeClass(source: Expense["payment_source"]): string {
  switch (source) {
    case "bank_transfer":
      return "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-50"
    case "card_online":
      return "border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-50"
    case "cash_manual":
      return "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-50"
    default:
      return ""
  }
}

function isSalaryCategoryId(value: string): boolean {
  return (
    value === SALARY_ADVANCE_EXPENSE_CATEGORY_ID ||
    value === SALARY_SETTLEMENT_EXPENSE_CATEGORY_ID
  )
}

function buildDefaultExpenseValues(): ExpenseFormValues {
  return {
    expense_category_id: "",
    amount: Number.NaN,
    payment_source: "bank_transfer",
    description: "",
    expense_date: toYmd(new Date()),
    staff_recipient: "",
  }
}

function groupedCategories(categories: ExpenseCategory[]): {
  variable: ExpenseCategory[]
  fixed: ExpenseCategory[]
  operational: ExpenseCategory[]
} {
  return {
    variable: categories.filter((category) => category.type === "variable"),
    fixed: categories.filter((category) => category.type === "fixed"),
    operational: categories.filter(
      (category) =>
        category.type === "operational" || category.type === "commission",
    ),
  }
}

function buildSectionHref(
  href: string,
  searchParams: ReturnType<typeof useSearchParams>,
): string {
  const from = searchParams.get("from")
  const to = searchParams.get("to")

  if (!from || !to) return href

  const params = new URLSearchParams()
  params.set("from", from)
  params.set("to", to)
  return `${href}?${params.toString()}`
}

export function ExpensesClient(props: ExpensesClientProps) {
  const { categories, expenses, staffList } = props
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [sheetOpen, setSheetOpen] = useState(false)
  const [isCreating, startCreateTransition] = useTransition()
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const form = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseFormSchema),
    defaultValues: buildDefaultExpenseValues(),
  })

  const watchedCategoryId = form.watch("expense_category_id")
  const watchedDescription = form.watch("description")
  const selectedCategory = useMemo(
    () => categories.find((category) => category.id === watchedCategoryId),
    [categories, watchedCategoryId],
  )
  const isSalaryCategorySelected = isSalaryCategoryId(watchedCategoryId)
  const isOtherCategorySelected = watchedCategoryId === OTHER_EXPENSE_CATEGORY_ID

  useEffect(() => {
    if (!isSalaryCategorySelected) {
      form.setValue("staff_recipient", "", { shouldDirty: true })
    }
  }, [form, isSalaryCategorySelected])

  const categoryGroups = useMemo(() => groupedCategories(categories), [categories])

  const summaryCards = useMemo<SummaryCardData[]>(() => {
    const variableExpenses = expenses.filter(
      (expense) => expense.expense_category?.type === "variable",
    )
    const fixedExpenses = expenses.filter(
      (expense) => expense.expense_category?.type === "fixed",
    )
    const operationalExpenses = expenses.filter((expense) => {
      const type = expense.expense_category?.type
      return type === "operational" || type === "commission"
    })

    return [
      {
        label: "Переменные",
        amountBani: variableExpenses.reduce(
          (sum, expense) => sum + expense.amount_bani,
          0,
        ),
        count: variableExpenses.length,
      },
      {
        label: "Постоянные",
        amountBani: fixedExpenses.reduce(
          (sum, expense) => sum + expense.amount_bani,
          0,
        ),
        count: fixedExpenses.length,
      },
      {
        label: "Операционные",
        amountBani: operationalExpenses.reduce(
          (sum, expense) => sum + expense.amount_bani,
          0,
        ),
        count: operationalExpenses.length,
      },
      {
        label: "Итого",
        amountBani: expenses.reduce((sum, expense) => sum + expense.amount_bani, 0),
        count: expenses.length,
      },
    ]
  }, [expenses])

  async function handleDeleteExpense(id: string): Promise<void> {
    setDeletingId(id)
    try {
      const result = await deleteExpense(id)
      if (!result.success) {
        toast.error(result.error ?? "Не удалось удалить расход")
        return
      }

      toast.success("Расход удалён")
      router.refresh()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Не удалось удалить расход",
      )
    } finally {
      setDeletingId(null)
    }
  }

  function handleSheetOpenChange(nextOpen: boolean): void {
    setSheetOpen(nextOpen)
    if (!nextOpen) {
      form.reset(buildDefaultExpenseValues())
    }
  }

  function onSubmit(values: ExpenseFormValues): void {
    startCreateTransition(async () => {
      try {
        const result = await createExpense({
          expense_category_id: values.expense_category_id,
          amount_bani: Math.round(values.amount * 100),
          payment_source: values.payment_source,
          description: values.description.trim(),
          expense_date: values.expense_date,
          staff_recipient: isSalaryCategoryId(values.expense_category_id)
            ? values.staff_recipient?.trim() || undefined
            : undefined,
        })

        if (!result.success) {
          toast.error(result.error ?? "Не удалось создать расход")
          return
        }

        toast.success("Расход добавлен")
        handleSheetOpenChange(false)
        router.refresh()
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Не удалось создать расход",
        )
      }
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 rounded-xl border border-border bg-muted/30 p-1">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={buildSectionHref(item.href, searchParams)}
              className={
                isActive
                  ? "rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground shadow-sm"
                  : "rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-background/70 hover:text-foreground"
              }
            >
              {item.label}
            </Link>
          )
        })}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <Card key={card.label}>
            <CardHeader className="pb-1">
              <CardDescription>{card.label}</CardDescription>
              <CardTitle className="text-2xl">{formatMdl(card.amountBani)}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">
                {card.count} {recordsLabel(card.count)}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 border-b">
          <div className="space-y-1">
            <CardTitle>Журнал расходов</CardTitle>
            <CardDescription>
              Дата, категория, описание и источник оплаты вне POS-кассы
            </CardDescription>
          </div>

          <Button type="button" onClick={() => setSheetOpen(true)}>
            <Plus className="mr-1 size-4" />
            Добавить расход
          </Button>
        </CardHeader>
        <CardContent className="pt-4">
          {expenses.length === 0 ? (
            <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-muted/20 px-6 text-center">
              <ReceiptText className="text-muted-foreground size-10" />
              <div className="space-y-1">
                <p className="text-base font-medium">Нет расходов за выбранный период</p>
                <p className="text-muted-foreground text-sm">
                  Попробуйте изменить даты или добавить новую запись.
                </p>
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Дата</TableHead>
                  <TableHead>Категория</TableHead>
                  <TableHead className="min-w-[260px]">Описание</TableHead>
                  <TableHead>Сотрудник</TableHead>
                  <TableHead>Способ оплаты</TableHead>
                  <TableHead className="text-right">Сумма</TableHead>
                  <TableHead className="text-right">Удалить</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses.map((expense) => {
                  const description = expense.description.trim()

                  return (
                    <TableRow key={expense.id}>
                      <TableCell>{formatExpenseDate(expense.expense_date)}</TableCell>
                      <TableCell>{expense.expense_category?.name ?? "—"}</TableCell>
                      <TableCell className="max-w-[320px]">
                        {description ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="block cursor-help truncate">
                                {description}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-sm whitespace-pre-wrap">
                              {description}
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>{expense.staff_recipient?.trim() || "—"}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={paymentSourceBadgeClass(expense.payment_source)}
                        >
                          {paymentSourceLabel(expense.payment_source)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium text-red-600">
                        {formatMdl(expense.amount_bani)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Удалить расход"
                          className="text-destructive hover:text-destructive"
                          disabled={deletingId === expense.id}
                          onClick={() => void handleDeleteExpense(expense.id)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Sheet open={sheetOpen} onOpenChange={handleSheetOpenChange}>
        <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-xl">
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="flex h-full flex-col overflow-hidden"
            >
              <SheetHeader className="shrink-0 border-b px-6 py-5">
                <SheetTitle>Добавить расход</SheetTitle>
                <SheetDescription>
                  Внесите расход вне POS-кассы. Сумма в форме указывается в MDL.
                </SheetDescription>
              </SheetHeader>

              <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
                <FormField
                  control={form.control}
                  name="expense_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Дата</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="expense_category_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Категория</FormLabel>
                      <Select
                        value={field.value || undefined}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Выберите категорию" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {categoryGroups.variable.length > 0 ? (
                            <SelectGroup>
                              <SelectLabel>Переменные</SelectLabel>
                              {categoryGroups.variable.map((category) => (
                                <SelectItem key={category.id} value={category.id}>
                                  {category.name}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          ) : null}

                          {categoryGroups.fixed.length > 0 ? (
                            <SelectGroup>
                              <SelectLabel>Постоянные</SelectLabel>
                              {categoryGroups.fixed.map((category) => (
                                <SelectItem key={category.id} value={category.id}>
                                  {category.name}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          ) : null}

                          {categoryGroups.operational.length > 0 ? (
                            <SelectGroup>
                              <SelectLabel>Операционные</SelectLabel>
                              {categoryGroups.operational.map((category) => (
                                <SelectItem key={category.id} value={category.id}>
                                  {category.name}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          ) : null}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {isSalaryCategorySelected ? (
                  <FormField
                    control={form.control}
                    name="staff_recipient"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Сотрудник получатель</FormLabel>
                        <FormControl>
                          <StaffCombobox
                            value={field.value ?? ""}
                            onChange={field.onChange}
                            staff={staffList}
                          />
                        </FormControl>
                        <FormDescription>
                          Показывается только для категорий аванса и расчёта.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ) : null}

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Описание</FormLabel>
                      <FormControl>
                        <Textarea
                          rows={4}
                          placeholder="Комментарий к расходу"
                          value={field.value}
                          onChange={field.onChange}
                        />
                      </FormControl>
                      {isOtherCategorySelected ? (
                        <FormDescription>
                          Для категории «Прочее» описание обязательно.
                        </FormDescription>
                      ) : (
                        <FormDescription>Необязательно для большинства категорий.</FormDescription>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Сумма (MDL)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0.01}
                          step={0.01}
                          placeholder="0"
                          value={
                            Number.isFinite(field.value) ? String(field.value) : ""
                          }
                          onChange={(event) => {
                            const nextValue = event.target.value
                            field.onChange(
                              nextValue === "" ? Number.NaN : Number(nextValue),
                            )
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="payment_source"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Способ оплаты</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="bank_transfer">
                            Банковский перевод
                          </SelectItem>
                          <SelectItem value="card_online">Карта онлайн</SelectItem>
                          <SelectItem value="cash_manual">
                            Наличные (вне кассы)
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {selectedCategory ? (
                  <div className="rounded-xl border border-border bg-muted/30 px-4 py-3">
                    <p className="text-sm font-medium">{selectedCategory.name}</p>
                    <p className="text-muted-foreground mt-1 text-sm">
                      Тип категории:{" "}
                      {selectedCategory.type === "variable"
                        ? "переменные"
                        : selectedCategory.type === "fixed"
                          ? "постоянные"
                          : "операционные"}
                    </p>
                  </div>
                ) : null}
              </div>

              <SheetFooter className="shrink-0 border-t px-6 py-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleSheetOpenChange(false)}
                  disabled={isCreating}
                >
                  Отмена
                </Button>
                <Button
                  type="submit"
                  disabled={
                    isCreating ||
                    !watchedCategoryId ||
                    (isOtherCategorySelected && watchedDescription.trim().length === 0)
                  }
                >
                  {isCreating ? "Сохраняем…" : "Сохранить расход"}
                </Button>
              </SheetFooter>
            </form>
          </Form>
        </SheetContent>
      </Sheet>
    </div>
  )
}
