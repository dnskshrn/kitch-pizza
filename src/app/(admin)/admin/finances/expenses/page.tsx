import { endOfMonth, format, startOfMonth } from "date-fns"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { PeriodFilter } from "@/components/admin/finances/period-filter"
import {
  getExpenseCategories,
  getExpenses,
  getFinanceSettings,
  getStaffList,
} from "@/lib/actions/admin/finance"
import { formatMdl } from "@/lib/format-mdl"
import { ExpensesClient } from "./expenses-client"

export const dynamic = "force-dynamic"

type PageProps = {
  searchParams?: {
    from?: string | string[]
    to?: string | string[]
  }
}

function toYmd(value: Date): string {
  return format(value, "yyyy-MM-dd")
}

function firstParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0]
  return value
}

function isValidYmd(value: string | undefined): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function resolveDateRange(searchParams: PageProps["searchParams"]): {
  from: string
  to: string
} {
  const now = new Date()
  const defaultFrom = toYmd(startOfMonth(now))
  const defaultTo = toYmd(endOfMonth(now))

  const from = firstParam(searchParams?.from)
  const to = firstParam(searchParams?.to)

  if (!isValidYmd(from) || !isValidYmd(to) || from > to) {
    return { from: defaultFrom, to: defaultTo }
  }

  return { from, to }
}

export default async function AdminExpensesPage({ searchParams }: PageProps) {
  const { from, to } = resolveDateRange(searchParams)

  try {
    const [categories, expenses, financeSettings, staff] = await Promise.all([
      getExpenseCategories(),
      getExpenses({ dateFrom: from, dateTo: to }),
      getFinanceSettings(),
      getStaffList(),
    ])

    const totalBani = expenses.reduce((sum, expense) => sum + expense.amount_bani, 0)

    return (
      <div className="space-y-6 p-6">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <span className="text-muted-foreground">Финансы</span>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Внекассовые расходы</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-medium">
              Внекассовые расходы{" "}
              <span className="text-muted-foreground text-xl">
                {formatMdl(totalBani)}
              </span>
            </h1>
            <p className="text-sm text-muted-foreground">
              Журнал расходов вне POS-кассы за выбранный период.
            </p>
          </div>
          <PeriodFilter dateFrom={from} dateTo={to} />
        </div>

        <ExpensesClient
          categories={categories}
          expenses={expenses}
          financeSettings={financeSettings}
          staffList={staff}
        />
      </div>
    )
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Не удалось загрузить расходы."

    return (
      <div className="space-y-6 p-6">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <span className="text-muted-foreground">Финансы</span>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Внекассовые расходы</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-medium">Внекассовые расходы</h1>
            <p className="text-sm text-muted-foreground">
              Журнал расходов вне POS-кассы за выбранный период.
            </p>
          </div>
          <PeriodFilter dateFrom={from} dateTo={to} />
        </div>

        <p className="text-destructive">
          {message.startsWith("Missing ")
            ? "Не удалось подключиться к базе: проверьте переменные окружения."
            : `Не удалось загрузить расходы: ${message}`}
        </p>
      </div>
    )
  }
}
