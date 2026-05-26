import { endOfMonth, format, parseISO, startOfMonth } from "date-fns"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { PeriodFilter } from "@/components/admin/finances/period-filter"
import { computePnL } from "@/lib/actions/admin/finance"
import { PnLDashboard } from "./pnl-dashboard"

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

function formatPeriod(from: string, to: string): string {
  return `${format(parseISO(from), "dd.MM.yyyy")} - ${format(parseISO(to), "dd.MM.yyyy")}`
}

export default async function AdminFinancesPage({ searchParams }: PageProps) {
  const { from, to } = resolveDateRange(searchParams)
  const periodLabel = formatPeriod(from, to)

  try {
    const data = await computePnL({ dateFrom: from, dateTo: to })

    return (
      <div className="space-y-6 p-6">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <span className="text-muted-foreground">Финансы</span>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>P&amp;L</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-medium">Финансы</h1>
            <p className="text-sm text-muted-foreground">
              P&amp;L дашборд за период {periodLabel}.
            </p>
          </div>
          <PeriodFilter dateFrom={from} dateTo={to} />
        </div>

        <PnLDashboard data={data} />
      </div>
    )
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Не удалось загрузить P&L дашборд."

    return (
      <div className="space-y-6 p-6">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <span className="text-muted-foreground">Финансы</span>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>P&amp;L</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-medium">Финансы</h1>
            <p className="text-sm text-muted-foreground">
              P&amp;L дашборд за период {periodLabel}.
            </p>
          </div>
          <PeriodFilter dateFrom={from} dateTo={to} />
        </div>

        <p className="text-destructive">
          {message.startsWith("Missing ")
            ? "Не удалось подключиться к базе: проверьте переменные окружения."
            : `Не удалось загрузить P&L дашборд: ${message}`}
        </p>
      </div>
    )
  }
}
