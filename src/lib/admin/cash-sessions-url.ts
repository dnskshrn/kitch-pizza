import { utcTodayYmd } from "@/lib/admin/orders-url"

export type CashSessionsStatusFilter = "open" | "closed" | "all"

export type CashSessionsFilters = {
  dateFrom: string | null
  dateTo: string | null
  staffId: string | null
  status: CashSessionsStatusFilter
}

export type CashSessionsQueryParams = CashSessionsFilters & {
  dateFromIso?: string
  dateToIso?: string
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function first(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0]
  return v
}

function parseYmd(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  return value
}

export function utcDaysAgoYmd(days: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - days)
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, "0")
  const day = String(d.getUTCDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function startOfDayUtcIso(dateYmd: string): string {
  return `${dateYmd}T00:00:00.000Z`
}

function endOfDayUtcIso(dateYmd: string): string {
  return `${dateYmd}T23:59:59.999Z`
}

function resolveDateYmd(
  raw: string | string[] | undefined,
  defaultYmd: string,
): string | null {
  const value = first(raw)
  if (value === undefined) return defaultYmd
  if (value === "") return null
  return parseYmd(value)
}

function resolveDateIso(
  raw: string | string[] | undefined,
  defaultYmd: string,
  endOfDay: boolean,
): string | undefined {
  const ymd = resolveDateYmd(raw, defaultYmd)
  if (!ymd) return undefined
  return endOfDay ? endOfDayUtcIso(ymd) : startOfDayUtcIso(ymd)
}

function resolveStaffId(
  raw: string | string[] | undefined,
): string | null {
  const value = first(raw)
  if (value === undefined || value === "") return null
  return UUID_RE.test(value) ? value : null
}

function resolveStatus(
  raw: string | string[] | undefined,
): CashSessionsStatusFilter {
  const value = first(raw)
  if (value === undefined || value === "") return "all"
  if (value === "open" || value === "closed" || value === "all") return value
  return "all"
}

export function parseCashSessionsSearchParams(
  raw: Record<string, string | string[] | undefined>,
): CashSessionsQueryParams {
  const defaultDateFrom = utcDaysAgoYmd(30)
  const defaultDateTo = utcTodayYmd()

  const dateFrom = resolveDateYmd(raw.date_from, defaultDateFrom)
  const dateTo = resolveDateYmd(raw.date_to, defaultDateTo)
  const staffId = resolveStaffId(raw.staff_id)
  const status = resolveStatus(raw.status)

  return {
    dateFrom,
    dateTo,
    staffId,
    status,
    dateFromIso: resolveDateIso(raw.date_from, defaultDateFrom, false),
    dateToIso: resolveDateIso(raw.date_to, defaultDateTo, true),
  }
}

export function cashSessionsFiltersFromSearchParams(
  searchParams: URLSearchParams,
): CashSessionsFilters {
  return parseCashSessionsSearchParams({
    date_from: searchParams.get("date_from") ?? undefined,
    date_to: searchParams.get("date_to") ?? undefined,
    staff_id: searchParams.get("staff_id") ?? undefined,
    status: searchParams.get("status") ?? undefined,
  })
}

export function cashSessionsHasActiveFilters(
  searchParams: URLSearchParams,
): boolean {
  return (
    searchParams.has("date_from") ||
    searchParams.has("date_to") ||
    searchParams.has("staff_id") ||
    (searchParams.has("status") &&
      searchParams.get("status") !== "all" &&
      searchParams.get("status") !== "")
  )
}
