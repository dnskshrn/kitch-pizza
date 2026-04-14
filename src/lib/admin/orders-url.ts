import type { OrderStatus } from "@/types/database"

export const ORDERS_PAGE_SIZE = 50

const ORDER_STATUSES: OrderStatus[] = [
  "new",
  "in_progress",
  "delivering",
  "done",
  "cancelled",
]

export type OrdersUrlState = {
  status: OrderStatus | null
  dateFrom: string | null
  dateTo: string | null
  timeFrom: string | null
  timeTo: string | null
  search: string | null
  page: number
}

function first(
  v: string | string[] | undefined,
): string | undefined {
  if (Array.isArray(v)) return v[0]
  return v
}

function parseYmd(s: string | undefined): string | null {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  return s
}

/** HH:mm, часы 0–23 */
function parseHm(s: string | undefined): string | null {
  if (!s) return null
  const m = s.trim().match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return null
  const hh = Number(m[1])
  const mm = Number(m[2])
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`
}

export function parseOrdersSearchParams(
  raw: Record<string, string | string[] | undefined>,
): OrdersUrlState {
  const statusRaw = first(raw.status)
  const status =
    statusRaw && ORDER_STATUSES.includes(statusRaw as OrderStatus)
      ? (statusRaw as OrderStatus)
      : null

  const pageRaw = first(raw.page)
  const parsedPage = parseInt(pageRaw ?? "1", 10)
  const page =
    Number.isFinite(parsedPage) && parsedPage >= 1 ? parsedPage : 1

  const searchRaw = first(raw.search)?.trim()
  const search = searchRaw ? searchRaw : null

  return {
    status,
    dateFrom: parseYmd(first(raw.date_from)),
    dateTo: parseYmd(first(raw.date_to)),
    timeFrom: parseHm(first(raw.time_from)),
    timeTo: parseHm(first(raw.time_to)),
    search,
    page,
  }
}

/** Начало суток UTC для YYYY-MM-DD */
function startOfDayUtcIso(dateYmd: string): string {
  return `${dateYmd}T00:00:00.000Z`
}

/** Конец суток UTC (включительно) */
function endOfDayUtcIso(dateYmd: string): string {
  return `${dateYmd}T23:59:59.999Z`
}

/**
 * date + time → UTC ISO как в ТЗ (например 2026-04-01T12:00:00.000Z).
 */
function combineDateTimeUtc(dateYmd: string, timeHm: string): string {
  return `${dateYmd}T${timeHm}:00.000Z`
}

export type CreatedAtBounds = { gte?: string; lte?: string }

/** Границы по created_at для Supabase .gte / .lte */
export function ordersCreatedAtBounds(state: OrdersUrlState): CreatedAtBounds {
  const { dateFrom, dateTo, timeFrom, timeTo } = state
  const out: CreatedAtBounds = {}

  if (dateFrom) {
    out.gte = timeFrom
      ? combineDateTimeUtc(dateFrom, timeFrom)
      : startOfDayUtcIso(dateFrom)
  }

  if (dateTo) {
    out.lte = timeTo
      ? combineDateTimeUtc(dateTo, timeTo)
      : endOfDayUtcIso(dateTo)
  }

  return out
}

export function escapeIlikePattern(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_")
}
