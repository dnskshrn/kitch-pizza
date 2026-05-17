export const ORDERS_PAGE_SIZE = 50

export type OrdersStatusGroup = "all" | "active" | "done" | "cancelled"

export type OrdersSourceChannel = "all" | "website" | "pos" | "glovo"

export type OrdersUrlState = {
  statusGroup: OrdersStatusGroup
  brandId: string | null
  sourceChannel: OrdersSourceChannel
  dateFrom: string | null
  dateTo: string | null
  timeFrom: string | null
  timeTo: string | null
  search: string | null
  page: number
}

const STATUS_GROUPS: readonly OrdersStatusGroup[] = [
  "all",
  "active",
  "done",
  "cancelled",
]

const SOURCE_CHANNELS: readonly OrdersSourceChannel[] = [
  "all",
  "website",
  "pos",
  "glovo",
]

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

/** Ключа в query нет → сегодня (UTC); пустое/битое значение → null (без подстановки). */
function resolveOrdersDateRaw(
  value: string | string[] | undefined,
  todayYmd: string,
): string | null {
  if (value === undefined) return todayYmd
  const s = first(value)
  if (s === undefined) return todayYmd
  return parseYmd(s)
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

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** Начало суток UTC для YYYY-MM-DD */
function startOfDayUtcIso(dateYmd: string): string {
  return `${dateYmd}T00:00:00.000Z`
}

/** Сегодня по UTC в формате YYYY-MM-DD (для метрик «за сегодня»). */
export function utcTodayYmd(): string {
  const d = new Date()
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, "0")
  const day = String(d.getUTCDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

/**
 * То же правило для `URLSearchParams.get`: `null` (параметра нет) → сегодня UTC,
 * пустая строка → без подстановки (`null`).
 */
export function resolveOrdersDatesFromSearchParamGets(
  dateFromGet: string | null,
  dateToGet: string | null,
): { dateFrom: string | null; dateTo: string | null } {
  const todayYmd = utcTodayYmd()
  return {
    dateFrom:
      dateFromGet === null ? todayYmd : parseYmd(dateFromGet),
    dateTo: dateToGet === null ? todayYmd : parseYmd(dateToGet),
  }
}

export function parseOrdersSearchParams(
  raw: Record<string, string | string[] | undefined>,
): OrdersUrlState {
  const sgRaw = first(raw.status_group)
  const statusGroup: OrdersStatusGroup =
    sgRaw && (STATUS_GROUPS as readonly string[]).includes(sgRaw)
      ? (sgRaw as OrdersStatusGroup)
      : "active"

  const brandRaw = first(raw.brand_id)?.trim()
  const brandId =
    brandRaw && UUID_RE.test(brandRaw) ? brandRaw : null

  const chRaw = first(raw.order_src)
  const sourceChannel: OrdersSourceChannel =
    chRaw && (SOURCE_CHANNELS as readonly string[]).includes(chRaw)
      ? (chRaw as OrdersSourceChannel)
      : "all"

  const pageRaw = first(raw.page)
  const parsedPage = parseInt(pageRaw ?? "1", 10)
  const page =
    Number.isFinite(parsedPage) && parsedPage >= 1 ? parsedPage : 1

  const searchRaw = first(raw.search)?.trim()
  const search = searchRaw ? searchRaw : null

  const todayYmd = utcTodayYmd()

  return {
    statusGroup,
    brandId,
    sourceChannel,
    dateFrom: resolveOrdersDateRaw(raw.date_from, todayYmd),
    dateTo: resolveOrdersDateRaw(raw.date_to, todayYmd),
    timeFrom: parseHm(first(raw.time_from)),
    timeTo: parseHm(first(raw.time_to)),
    search,
    page,
  }
}

/** Начало текущих суток по UTC (00:00:00.000Z). */
export function startOfUtcTodayIso(): string {
  return startOfDayUtcIso(utcTodayYmd())
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
