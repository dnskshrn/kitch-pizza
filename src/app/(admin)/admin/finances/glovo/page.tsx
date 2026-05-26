import { endOfMonth, format, parseISO, startOfMonth, subMonths } from "date-fns"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { PeriodFilter } from "@/components/admin/finances/period-filter"
import {
  computePnL,
  getGlovoSettlements,
} from "@/lib/actions/admin/finance"
import { GlovoClient } from "./glovo-client"

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
  const defaultFrom = toYmd(startOfMonth(subMonths(now, 3)))
  const defaultTo = toYmd(endOfMonth(subMonths(now, 1)))

  const from = firstParam(searchParams?.from)
  const to = firstParam(searchParams?.to)

  if (!isValidYmd(from) || !isValidYmd(to) || from > to) {
    return { from: defaultFrom, to: defaultTo }
  }

  return { from, to }
}

const GLOVO_PRESETS = [
  { label: "3 месяца", kind: "three-months" },
  { label: "Этот месяц", kind: "current-month" },
  { label: "Прошлый месяц", kind: "previous-month" },
] as const

function formatPeriod(from: string, to: string): string {
  return `${format(parseISO(from), "dd.MM.yyyy")} - ${format(parseISO(to), "dd.MM.yyyy")}`
}

export default async function AdminGlovoPage({ searchParams }: PageProps) {
  const { from, to } = resolveDateRange(searchParams)
  const periodLabel = formatPeriod(from, to)

  try {
    const [settlements, pnlData] = await Promise.all([
      getGlovoSettlements({ dateFrom: from, dateTo: to }),
      computePnL({ dateFrom: from, dateTo: to }),
    ])

    return (
      <div className="space-y-6 p-6">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <span className="text-muted-foreground">Финансы</span>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Glovo</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-medium">Выплаты Glovo</h1>
            <p className="text-sm text-muted-foreground">
              Журнал выплат и сверка комиссий Glovo за период {periodLabel}.
            </p>
          </div>
          <PeriodFilter
            dateFrom={from}
            dateTo={to}
            presets={[...GLOVO_PRESETS]}
          />
        </div>

        <GlovoClient
          settlements={settlements}
          pnlData={pnlData}
          initialFrom={from}
          initialTo={to}
        />
      </div>
    )
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Не удалось загрузить выплаты Glovo."

    return (
      <div className="space-y-6 p-6">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <span className="text-muted-foreground">Финансы</span>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Glovo</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-medium">Выплаты Glovo</h1>
            <p className="text-sm text-muted-foreground">
              Журнал выплат и сверка комиссий Glovo за период {periodLabel}.
            </p>
          </div>
          <PeriodFilter
            dateFrom={from}
            dateTo={to}
            presets={[...GLOVO_PRESETS]}
          />
        </div>

        <p className="text-destructive">
          {message.startsWith("Missing ")
            ? "Не удалось подключиться к базе: проверьте переменные окружения."
            : `Не удалось загрузить выплаты Glovo: ${message}`}
        </p>
      </div>
    )
  }
}
