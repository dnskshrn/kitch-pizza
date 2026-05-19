import {
  listCashSessions,
  listStaffForFilter,
} from "@/lib/actions/admin/cash-sessions"
import { parseCashSessionsSearchParams } from "@/lib/admin/cash-sessions-url"
import { CashSessionsClient } from "@/components/admin/finance/cash-sessions-client"

export const dynamic = "force-dynamic"

type PageProps = {
  searchParams: Record<string, string | string[] | undefined>
}

export default async function CashSessionsPage({ searchParams }: PageProps) {
  const filters = parseCashSessionsSearchParams(searchParams)

  try {
    const [sessions, staff] = await Promise.all([
      listCashSessions({
        dateFrom: filters.dateFromIso,
        dateTo: filters.dateToIso,
        staffId: filters.staffId ?? undefined,
        status: filters.status,
      }),
      listStaffForFilter(),
    ])

    return (
      <div className="space-y-4 p-6">
        <div>
          <h1 className="text-2xl font-medium">Кассовые смены</h1>
          <p className="text-sm text-muted-foreground">
            История смен, расходы, инкассации, разбивка по брендам
          </p>
        </div>
        <CashSessionsClient
          sessions={sessions}
          staff={staff}
          initialFilters={{
            dateFrom: filters.dateFrom,
            dateTo: filters.dateTo,
            staffId: filters.staffId,
            status: filters.status,
          }}
        />
      </div>
    )
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Не удалось загрузить кассовые смены."
    return (
      <div className="space-y-4 p-6">
        <div>
          <h1 className="text-2xl font-medium">Кассовые смены</h1>
          <p className="text-sm text-muted-foreground">
            История смен, расходы, инкассации, разбивка по брендам
          </p>
        </div>
        <p className="text-destructive">
          {message.startsWith("Missing ")
            ? "Не удалось подключиться к базе: проверьте переменные окружения."
            : `Не удалось загрузить кассовые смены: ${message}`}
        </p>
      </div>
    )
  }
}
