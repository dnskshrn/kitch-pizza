"use server"

import { createServiceRoleClient } from "@/lib/supabase/service-role"
import type { CashSession } from "@/types/database"

export type CashSessionListItem = {
  id: string
  opened_at: string
  closed_at: string | null
  status: "open" | "closed"
  duration_minutes: number | null
  opened_by_name: string | null
  closed_by_name: string | null
  opening_balance_bani: number
  own_cash_in_bani: number
  own_card_in_bani: number
  glovo_cash_in_bani: number
  glovo_card_bani: number
  expense_bani: number
  income_bani: number
  encashment_bani: number
  closing_balance_expected_bani: number | null
  closing_balance_actual_bani: number | null
  discrepancy_bani: number | null
  discrepancy_reason: string | null
  gross_revenue_bani: number
}

export type CashSessionDetailTransaction = {
  id: string
  type: "opening" | "order_payment" | "expense" | "income" | "encashment"
  direction: "in" | "out"
  amount_bani: number
  payment_method: "cash" | "card" | null
  category: string | null
  description: string | null
  encashment_destination: string | null
  order_id: string | null
  order_delivery_mode: "delivery" | "pickup" | "aggregator" | null
  order_brand_id: string | null
  order_brand_slug: string | null
  created_by_staff_id: string | null
  created_by_name: string | null
  created_at: string
  voided_at: string | null
  voided_by_staff_id: string | null
  voided_by_name: string | null
  void_reason: string | null
}

export type CashSessionDetail = {
  session: {
    id: string
    opened_at: string
    closed_at: string | null
    status: "open" | "closed"
    opened_by: { id: string; name: string } | null
    closed_by: { id: string; name: string } | null
    opening_balance_bani: number
    closing_balance_expected_bani: number | null
    closing_balance_actual_bani: number | null
    discrepancy_bani: number | null
    discrepancy_reason: string | null
  }
  totals: {
    own_cash_in_bani: number
    own_card_in_bani: number
    glovo_cash_in_bani: number
    glovo_card_bani: number
    expense_bani: number
    income_bani: number
    encashment_bani: number
    gross_revenue_bani: number
  }
  by_brand: Array<{
    brand_id: string
    brand_name: string
    brand_slug: string
    own_cash_in_bani: number
    own_card_in_bani: number
    glovo_cash_in_bani: number
    glovo_card_bani: number
    orders_count: number
    gross_revenue_bani: number
  }>
  transactions: CashSessionDetailTransaction[]
  glovo_card_orders: Array<{
    id: string
    brand_slug: string
    total_bani: number
    paid_at: string
  }>
}

type SessionTransactionAgg = {
  own_cash_in_bani: number
  own_card_in_bani: number
  glovo_cash_in_bani: number
  expense_bani: number
  income_bani: number
  encashment_bani: number
}

type StaffJoin = { id?: string; name: string } | { id?: string; name: string }[] | null

type BrandRow = { id: string; name: string; slug: string }

type RawListSessionRow = CashSession & {
  opened_by: StaffJoin
  closed_by: StaffJoin
}

type RawListTransactionRow = {
  cash_session_id: string
  type: string
  amount_bani: number
  payment_method: string | null
  order_delivery_mode: string | null
  voided_at: string | null
}

type RawGlovoCardOrderRow = {
  cash_session_id: string
  total: number
}

type RawDetailSessionRow = CashSession & {
  opened_by: StaffJoin
  closed_by: StaffJoin
}

type RawDetailTransactionRow = {
  id: string
  cash_session_id: string
  type: string
  direction: string
  amount_bani: number
  payment_method: string | null
  category: string | null
  description: string | null
  encashment_destination: string | null
  order_id: string | null
  order_delivery_mode: string | null
  order_brand_id: string | null
  created_by_staff_id: string | null
  created_at: string
  voided_at: string | null
  voided_by_staff_id: string | null
  void_reason: string | null
  creator: StaffJoin
  voider: StaffJoin
  brand: { slug: string } | { slug: string }[] | null
}

type RawGlovoCardDetailOrderRow = {
  id: string
  total: number
  paid_at: string
  brand_id: string | null
  brands: { slug: string } | { slug: string }[] | null
}

type BrandAggMutable = {
  brand_id: string
  brand_name: string
  brand_slug: string
  own_cash_in_bani: number
  own_card_in_bani: number
  glovo_cash_in_bani: number
  glovo_card_bani: number
  order_ids: Set<string>
}

function emptySessionTransactionAgg(): SessionTransactionAgg {
  return {
    own_cash_in_bani: 0,
    own_card_in_bani: 0,
    glovo_cash_in_bani: 0,
    expense_bani: 0,
    income_bani: 0,
    encashment_bani: 0,
  }
}

function staffNameFromJoin(staff: StaffJoin): string | null {
  if (!staff) return null
  if (Array.isArray(staff)) return staff[0]?.name ?? null
  return staff.name ?? null
}

function staffRefFromJoin(
  staff: StaffJoin,
): { id: string; name: string } | null {
  if (!staff) return null
  const row = Array.isArray(staff) ? staff[0] : staff
  if (!row?.name) return null
  if (row.id) return { id: row.id, name: row.name }
  return { id: "", name: row.name }
}

function slugFromBrandJoin(
  brand: { slug: string } | { slug: string }[] | null | undefined,
): string | null {
  if (!brand) return null
  if (Array.isArray(brand)) return brand[0]?.slug ?? null
  return brand.slug ?? null
}

function durationMinutes(
  openedAt: string,
  closedAt: string | null,
): number | null {
  if (!closedAt) return null
  const ms = new Date(closedAt).getTime() - new Date(openedAt).getTime()
  if (!Number.isFinite(ms) || ms < 0) return null
  return Math.round(ms / 60000)
}

function resolveDateRange(params: {
  dateFrom?: string
  dateTo?: string
}): { dateFrom: string; dateTo: string } {
  const now = new Date()
  const dateTo = params.dateTo ? new Date(params.dateTo) : now
  const dateFrom = params.dateFrom
    ? new Date(params.dateFrom)
    : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  return {
    dateFrom: dateFrom.toISOString(),
    dateTo: dateTo.toISOString(),
  }
}

function mapTransactionType(
  type: string,
): CashSessionDetailTransaction["type"] {
  if (
    type === "opening" ||
    type === "order_payment" ||
    type === "expense" ||
    type === "income" ||
    type === "encashment"
  ) {
    return type
  }
  return "expense"
}

function mapOrderDeliveryMode(
  mode: string | null | undefined,
): "delivery" | "pickup" | "aggregator" | null {
  if (mode === "delivery" || mode === "pickup" || mode === "aggregator") {
    return mode
  }
  return null
}

function mapPaymentMethod(
  method: string | null | undefined,
): "cash" | "card" | null {
  if (method === "cash" || method === "card") return method
  return null
}

function accumulateListTransaction(
  agg: SessionTransactionAgg,
  tx: RawListTransactionRow,
): void {
  if (tx.voided_at != null) return

  const amount = Number(tx.amount_bani) || 0

  if (tx.type === "order_payment") {
    const mode = tx.order_delivery_mode
    if (tx.payment_method === "cash" && mode !== "aggregator") {
      agg.own_cash_in_bani += amount
    } else if (tx.payment_method === "card" && mode !== "aggregator") {
      agg.own_card_in_bani += amount
    } else if (tx.payment_method === "cash" && mode === "aggregator") {
      agg.glovo_cash_in_bani += amount
    }
    return
  }

  if (tx.type === "expense") {
    agg.expense_bani += amount
  } else if (tx.type === "income") {
    agg.income_bani += amount
  } else if (tx.type === "encashment") {
    agg.encashment_bani += amount
  }
}

function accumulateDetailTransaction(
  agg: SessionTransactionAgg,
  tx: RawDetailTransactionRow,
): void {
  if (tx.voided_at != null) return
  accumulateListTransaction(agg, tx)
}

function ensureBrandAgg(
  map: Map<string, BrandAggMutable>,
  brandId: string,
  brandsById: Map<string, BrandRow>,
): BrandAggMutable {
  let row = map.get(brandId)
  if (row) return row

  const brand = brandsById.get(brandId)
  row = {
    brand_id: brandId,
    brand_name: brand?.name ?? "—",
    brand_slug: brand?.slug ?? "",
    own_cash_in_bani: 0,
    own_card_in_bani: 0,
    glovo_cash_in_bani: 0,
    glovo_card_bani: 0,
    order_ids: new Set<string>(),
  }
  map.set(brandId, row)
  return row
}

function accumulateBrandOrderPayment(
  row: BrandAggMutable,
  tx: RawDetailTransactionRow,
): void {
  if (tx.voided_at != null || tx.type !== "order_payment") return
  if (!tx.order_brand_id) return

  const amount = Number(tx.amount_bani) || 0
  const mode = tx.order_delivery_mode

  if (tx.payment_method === "cash" && mode !== "aggregator") {
    row.own_cash_in_bani += amount
  } else if (tx.payment_method === "card" && mode !== "aggregator") {
    row.own_card_in_bani += amount
  } else if (tx.payment_method === "cash" && mode === "aggregator") {
    row.glovo_cash_in_bani += amount
  }

  if (tx.order_id) {
    row.order_ids.add(tx.order_id)
  }
}

export async function listCashSessions(params: {
  dateFrom?: string
  dateTo?: string
  staffId?: string
  status?: "open" | "closed" | "all"
}): Promise<CashSessionListItem[]> {
  const supabase = createServiceRoleClient()
  const { dateFrom, dateTo } = resolveDateRange(params)
  const status = params.status ?? "all"

  let sessionsQuery = (supabase.from("cash_sessions") as any)
    .select(
      `
      id,
      opened_at,
      closed_at,
      status,
      opening_balance_bani,
      closing_balance_expected_bani,
      closing_balance_actual_bani,
      discrepancy_bani,
      discrepancy_reason,
      opened_by:opened_by_staff_id(name),
      closed_by:closed_by_staff_id(name)
    `,
    )
    .gte("opened_at", dateFrom)
    .lte("opened_at", dateTo)
    .order("opened_at", { ascending: false })
    .limit(200)

  if (params.staffId) {
    sessionsQuery = sessionsQuery.eq("opened_by_staff_id", params.staffId)
  }
  if (status !== "all") {
    sessionsQuery = sessionsQuery.eq("status", status)
  }

  const { data: sessionRows, error: sessionsError } = await sessionsQuery

  if (sessionsError) {
    throw new Error(sessionsError.message)
  }

  const sessions = (sessionRows ?? []) as RawListSessionRow[]
  if (sessions.length === 0) {
    return []
  }

  const sessionIds = sessions.map((s) => s.id)

  const [transactionsResult, glovoOrdersResult] = await Promise.all([
    (supabase.from("cash_transactions") as any)
      .select(
        "cash_session_id, type, amount_bani, payment_method, order_delivery_mode, voided_at",
      )
      .in("cash_session_id", sessionIds)
      .is("voided_at", null),
    (supabase.from("orders") as any)
      .select("cash_session_id, total")
      .in("cash_session_id", sessionIds)
      .eq("payment_method", "aggregator_card"),
  ])

  if (transactionsResult.error) {
    throw new Error(transactionsResult.error.message)
  }
  if (glovoOrdersResult.error) {
    throw new Error(glovoOrdersResult.error.message)
  }

  const aggBySession = new Map<string, SessionTransactionAgg>()
  for (const sessionId of sessionIds) {
    aggBySession.set(sessionId, emptySessionTransactionAgg())
  }

  for (const tx of (transactionsResult.data ?? []) as RawListTransactionRow[]) {
    const agg = aggBySession.get(tx.cash_session_id)
    if (!agg) continue
    accumulateListTransaction(agg, tx)
  }

  const glovoCardBySession = new Map<string, number>()
  for (const order of (glovoOrdersResult.data ?? []) as RawGlovoCardOrderRow[]) {
    const prev = glovoCardBySession.get(order.cash_session_id) ?? 0
    glovoCardBySession.set(
      order.cash_session_id,
      prev + (Number(order.total) || 0),
    )
  }

  return sessions.map((session) => {
    const agg =
      aggBySession.get(session.id) ?? emptySessionTransactionAgg()
    const glovoCardBani = glovoCardBySession.get(session.id) ?? 0
    const grossRevenueBani =
      agg.own_cash_in_bani +
      agg.own_card_in_bani +
      agg.glovo_cash_in_bani +
      glovoCardBani

    return {
      id: session.id,
      opened_at: session.opened_at,
      closed_at: session.closed_at,
      status: session.status,
      duration_minutes: durationMinutes(session.opened_at, session.closed_at),
      opened_by_name: staffNameFromJoin(session.opened_by),
      closed_by_name: staffNameFromJoin(session.closed_by),
      opening_balance_bani: Number(session.opening_balance_bani) || 0,
      own_cash_in_bani: agg.own_cash_in_bani,
      own_card_in_bani: agg.own_card_in_bani,
      glovo_cash_in_bani: agg.glovo_cash_in_bani,
      glovo_card_bani: glovoCardBani,
      expense_bani: agg.expense_bani,
      income_bani: agg.income_bani,
      encashment_bani: agg.encashment_bani,
      closing_balance_expected_bani: session.closing_balance_expected_bani,
      closing_balance_actual_bani: session.closing_balance_actual_bani,
      discrepancy_bani: session.discrepancy_bani,
      discrepancy_reason: session.discrepancy_reason,
      gross_revenue_bani: grossRevenueBani,
    }
  })
}

export async function getCashSessionDetail(
  sessionId: string,
): Promise<CashSessionDetail> {
  const supabase = createServiceRoleClient()

  const [sessionResult, transactionsResult, glovoOrdersResult, brandsResult] =
    await Promise.all([
      (supabase.from("cash_sessions") as any)
        .select(
          `
        id,
        opened_at,
        closed_at,
        status,
        opening_balance_bani,
        closing_balance_expected_bani,
        closing_balance_actual_bani,
        discrepancy_bani,
        discrepancy_reason,
        opened_by:opened_by_staff_id(id, name),
        closed_by:closed_by_staff_id(id, name)
      `,
        )
        .eq("id", sessionId)
        .maybeSingle(),
      (supabase.from("cash_transactions") as any)
        .select(
          `
        id,
        cash_session_id,
        type,
        direction,
        amount_bani,
        payment_method,
        category,
        description,
        encashment_destination,
        order_id,
        order_delivery_mode,
        order_brand_id,
        created_by_staff_id,
        created_at,
        voided_at,
        voided_by_staff_id,
        void_reason,
        creator:created_by_staff_id(name),
        voider:voided_by_staff_id(name),
        brand:order_brand_id(slug)
      `,
        )
        .eq("cash_session_id", sessionId)
        .order("created_at", { ascending: true }),
      (supabase.from("orders") as any)
        .select("id, total, paid_at, brand_id, brands(slug)")
        .eq("cash_session_id", sessionId)
        .eq("payment_method", "aggregator_card")
        .order("paid_at", { ascending: true }),
      supabase.from("brands").select("id, name, slug"),
    ])

  if (sessionResult.error) {
    throw new Error(sessionResult.error.message)
  }
  if (transactionsResult.error) {
    throw new Error(transactionsResult.error.message)
  }
  if (glovoOrdersResult.error) {
    throw new Error(glovoOrdersResult.error.message)
  }
  if (brandsResult.error) {
    throw new Error(brandsResult.error.message)
  }

  const sessionRow = sessionResult.data as RawDetailSessionRow | null
  if (!sessionRow) {
    throw new Error("Session not found")
  }

  const brandsById = new Map<string, BrandRow>()
  for (const brand of (brandsResult.data ?? []) as BrandRow[]) {
    brandsById.set(brand.id, brand)
  }

  const transactionRows = (transactionsResult.data ??
    []) as RawDetailTransactionRow[]
  const glovoOrderRows = (glovoOrdersResult.data ??
    []) as RawGlovoCardDetailOrderRow[]

  const totals = emptySessionTransactionAgg()
  for (const tx of transactionRows) {
    accumulateDetailTransaction(totals, tx)
  }

  let glovoCardBani = 0
  const glovo_card_orders = glovoOrderRows.map((order) => {
    const totalBani = Number(order.total) || 0
    glovoCardBani += totalBani
    const brandSlug =
      slugFromBrandJoin(order.brands) ??
      (order.brand_id ? (brandsById.get(order.brand_id)?.slug ?? "—") : "—")

    return {
      id: order.id,
      brand_slug: brandSlug,
      total_bani: totalBani,
      paid_at: order.paid_at,
    }
  })

  const grossRevenueBani =
    totals.own_cash_in_bani +
    totals.own_card_in_bani +
    totals.glovo_cash_in_bani +
    glovoCardBani

  const brandAggMap = new Map<string, BrandAggMutable>()
  for (const tx of transactionRows) {
    if (!tx.order_brand_id) continue
    const row = ensureBrandAgg(brandAggMap, tx.order_brand_id, brandsById)
    accumulateBrandOrderPayment(row, tx)
  }

  for (const order of glovoOrderRows) {
    if (!order.brand_id) continue
    const row = ensureBrandAgg(brandAggMap, order.brand_id, brandsById)
    const totalBani = Number(order.total) || 0
    row.glovo_card_bani += totalBani
    row.order_ids.add(order.id)
  }

  const by_brand = [...brandAggMap.values()]
    .map((row) => ({
      brand_id: row.brand_id,
      brand_name: row.brand_name,
      brand_slug: row.brand_slug,
      own_cash_in_bani: row.own_cash_in_bani,
      own_card_in_bani: row.own_card_in_bani,
      glovo_cash_in_bani: row.glovo_cash_in_bani,
      glovo_card_bani: row.glovo_card_bani,
      orders_count: row.order_ids.size,
      gross_revenue_bani:
        row.own_cash_in_bani +
        row.own_card_in_bani +
        row.glovo_cash_in_bani +
        row.glovo_card_bani,
    }))
    .filter(
      (row) =>
        row.own_cash_in_bani > 0 ||
        row.own_card_in_bani > 0 ||
        row.glovo_cash_in_bani > 0 ||
        row.glovo_card_bani > 0 ||
        row.orders_count > 0,
    )
    .sort((a, b) => a.brand_name.localeCompare(b.brand_name, "ru"))

  const transactions: CashSessionDetailTransaction[] = transactionRows.map(
    (tx) => ({
      id: tx.id,
      type: mapTransactionType(tx.type),
      direction: tx.direction === "out" ? "out" : "in",
      amount_bani: Number(tx.amount_bani) || 0,
      payment_method: mapPaymentMethod(tx.payment_method),
      category: tx.category,
      description: tx.description,
      encashment_destination: tx.encashment_destination ?? null,
      order_id: tx.order_id,
      order_delivery_mode: mapOrderDeliveryMode(tx.order_delivery_mode),
      order_brand_id: tx.order_brand_id,
      order_brand_slug: slugFromBrandJoin(tx.brand),
      created_by_staff_id: tx.created_by_staff_id,
      created_by_name: staffNameFromJoin(tx.creator),
      created_at: tx.created_at,
      voided_at: tx.voided_at,
      voided_by_staff_id: tx.voided_by_staff_id,
      void_reason: tx.void_reason,
      voided_by_name: staffNameFromJoin(tx.voider),
    }),
  )

  return {
    session: {
      id: sessionRow.id,
      opened_at: sessionRow.opened_at,
      closed_at: sessionRow.closed_at,
      status: sessionRow.status,
      opened_by: staffRefFromJoin(sessionRow.opened_by),
      closed_by: staffRefFromJoin(sessionRow.closed_by),
      opening_balance_bani: Number(sessionRow.opening_balance_bani) || 0,
      closing_balance_expected_bani: sessionRow.closing_balance_expected_bani,
      closing_balance_actual_bani: sessionRow.closing_balance_actual_bani,
      discrepancy_bani: sessionRow.discrepancy_bani,
      discrepancy_reason: sessionRow.discrepancy_reason,
    },
    totals: {
      own_cash_in_bani: totals.own_cash_in_bani,
      own_card_in_bani: totals.own_card_in_bani,
      glovo_cash_in_bani: totals.glovo_cash_in_bani,
      glovo_card_bani: glovoCardBani,
      expense_bani: totals.expense_bani,
      income_bani: totals.income_bani,
      encashment_bani: totals.encashment_bani,
      gross_revenue_bani: grossRevenueBani,
    },
    by_brand,
    transactions,
    glovo_card_orders,
  }
}

export async function listStaffForFilter(): Promise<
  Array<{ id: string; name: string }>
> {
  const supabase = createServiceRoleClient()

  const { data, error } = await supabase
    .from("staff")
    .select("id, name")
    .eq("is_active", true)
    .order("name")

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []) as Array<{ id: string; name: string }>
}
