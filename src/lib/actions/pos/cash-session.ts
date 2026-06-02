"use server"

import { processBonusAccrualOnOrderDone } from "@/lib/bonus"
import { getCurrentStaff } from "@/lib/actions/pos/auth"
import { createServiceRoleClient } from "@/lib/supabase/service-role"

/** Строка `cash_sessions` (таблица без типов в генерации). */
type CashSessionRow = {
  id: string
  shift_log_id: string
  opening_balance_bani: number
  closing_balance_expected_bani: number | null
  closing_balance_actual_bani: number | null
  discrepancy_bani: number | null
  status: "open" | "closed"
  opened_at: string
  closed_at: string | null
}

/** Строка `cash_transactions`. */
type CashTransactionRow = {
  id: string
  cash_session_id: string
  type: string
  direction: string
  amount_bani: number
  payment_method: string
  category: string | null
  expense_category_id?: string | null
  description: string | null
  order_id: string | null
  order_delivery_mode?: string | null
  encashment_destination?: string | null
  created_by_staff_id: string | null
  created_at: string
  voided_at?: string | null
}

type CashTransactionDbRow = CashTransactionRow & {
  staff?: { name: string } | { name: string }[] | null
}

export type CashSessionPaymentBreakdownBucket = {
  count: number
  amount_bani: number
}

export type CashSessionPaymentBreakdown = {
  own_cash: CashSessionPaymentBreakdownBucket
  own_card: CashSessionPaymentBreakdownBucket
  glovo_cash: CashSessionPaymentBreakdownBucket
}

export type CashSessionRecentTransaction = {
  id: string
  type: "opening" | "order_payment" | "expense" | "income" | "encashment"
  direction: "in" | "out"
  amount_bani: number
  payment_method: "cash" | "card" | null
  category: string | null
  description: string | null
  order_id: string | null
  order_delivery_mode: "delivery" | "pickup" | "aggregator" | null
  created_by_staff_id: string | null
  created_by_name: string | null
  created_at: string
  voided_at: string | null
}

export type CashSessionManualBreakdown = {
  expense: CashSessionPaymentBreakdownBucket
  income: CashSessionPaymentBreakdownBucket
  encashment: CashSessionPaymentBreakdownBucket
}

export type CashSessionRecentManualTransaction = {
  id: string
  type: "expense" | "income" | "encashment"
  direction: "in" | "out"
  amount_bani: number
  category: string | null
  description: string | null
  encashment_destination: string | null
  created_by_staff_id: string | null
  created_by_name: string | null
  created_at: string
  voided_at: string | null
}

function emptyBreakdownBucket(): CashSessionPaymentBreakdownBucket {
  return { count: 0, amount_bani: 0 }
}

function isActiveCashTransaction(t: CashTransactionRow): boolean {
  return t.voided_at == null
}

function staffNameFromJoin(
  staff: { name: string } | { name: string }[] | null | undefined,
): string | null {
  if (!staff) return null
  if (Array.isArray(staff)) return staff[0]?.name ?? null
  return staff.name ?? null
}

function mapOrderDeliveryMode(
  mode: string | null | undefined,
): "delivery" | "pickup" | "aggregator" | null {
  if (mode === "delivery" || mode === "pickup" || mode === "aggregator") {
    return mode
  }
  return null
}

function mapRecentPaymentMethod(
  method: string | null | undefined,
): "cash" | "card" | null {
  if (method === "cash" || method === "card") return method
  return null
}

function mapRecentTransactionType(
  type: string,
): CashSessionRecentTransaction["type"] {
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

function buildPaymentBreakdown(
  transactions: CashTransactionRow[],
): CashSessionPaymentBreakdown {
  const breakdown: CashSessionPaymentBreakdown = {
    own_cash: emptyBreakdownBucket(),
    own_card: emptyBreakdownBucket(),
    glovo_cash: emptyBreakdownBucket(),
  }

  for (const t of transactions) {
    if (!isActiveCashTransaction(t) || t.type !== "order_payment") continue

    const amount = Number(t.amount_bani) || 0
    const mode = t.order_delivery_mode ?? null

    if (t.payment_method === "cash" && mode !== "aggregator") {
      breakdown.own_cash.count += 1
      breakdown.own_cash.amount_bani += amount
    } else if (t.payment_method === "card" && mode !== "aggregator") {
      breakdown.own_card.count += 1
      breakdown.own_card.amount_bani += amount
    } else if (t.payment_method === "cash" && mode === "aggregator") {
      breakdown.glovo_cash.count += 1
      breakdown.glovo_cash.amount_bani += amount
    }
  }

  return breakdown
}

function buildManualBreakdown(
  transactions: CashTransactionRow[],
): CashSessionManualBreakdown {
  const breakdown: CashSessionManualBreakdown = {
    expense: emptyBreakdownBucket(),
    income: emptyBreakdownBucket(),
    encashment: emptyBreakdownBucket(),
  }

  for (const t of transactions) {
    if (!isActiveCashTransaction(t)) continue

    const amount = Number(t.amount_bani) || 0

    if (t.type === "expense") {
      breakdown.expense.count += 1
      breakdown.expense.amount_bani += amount
    } else if (t.type === "income") {
      breakdown.income.count += 1
      breakdown.income.amount_bani += amount
    } else if (t.type === "encashment") {
      breakdown.encashment.count += 1
      breakdown.encashment.amount_bani += amount
    }
  }

  return breakdown
}

function mapManualTransactionType(
  type: string,
): CashSessionRecentManualTransaction["type"] | null {
  if (type === "expense" || type === "income" || type === "encashment") {
    return type
  }
  return null
}

function buildRecentManualTransactions(
  rows: CashTransactionDbRow[],
): CashSessionRecentManualTransaction[] {
  return [...rows]
    .filter((t) => mapManualTransactionType(t.type) != null)
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    )
    .slice(0, 50)
    .map((t) => ({
      id: t.id,
      type: mapManualTransactionType(t.type)!,
      direction: t.direction === "out" ? "out" : "in",
      amount_bani: Number(t.amount_bani) || 0,
      category: t.category,
      description: t.description,
      encashment_destination: t.encashment_destination ?? null,
      created_by_staff_id: t.created_by_staff_id,
      created_by_name: staffNameFromJoin(t.staff),
      created_at: t.created_at,
      voided_at: t.voided_at ?? null,
    }))
}

function toCashTransactionRow(row: CashTransactionDbRow): CashTransactionRow {
  const { staff: _staffJoin, ...transaction } = row
  void _staffJoin
  return transaction
}

function buildRecentTransactions(
  rows: CashTransactionDbRow[],
): CashSessionRecentTransaction[] {
  return [...rows]
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    )
    .slice(0, 20)
    .map((t) => ({
      id: t.id,
      type: mapRecentTransactionType(t.type),
      direction: t.direction === "out" ? "out" : "in",
      amount_bani: Number(t.amount_bani) || 0,
      payment_method: mapRecentPaymentMethod(t.payment_method),
      category: t.category,
      description: t.description,
      order_id: t.order_id,
      order_delivery_mode: mapOrderDeliveryMode(t.order_delivery_mode),
      created_by_staff_id: t.created_by_staff_id,
      created_by_name: staffNameFromJoin(t.staff),
      created_at: t.created_at,
      voided_at: t.voided_at ?? null,
    }))
}

export type CashSessionAggregates = {
  cash_in_bani: number
  cash_out_bani: number
  card_revenue_bani: number
  encashment_bani: number
  expenses_bani: number
  income_bani: number
  expected_in_drawer_bani: number
}

export type OpenCashSessionInput = {
  shiftLogId: string
  openingBalanceBani: number
  createdByStaffId: string
}

export type OpenCashSessionResult =
  | { data: CashSessionRow; error: null }
  | { data: null; error: string }

export async function openCashSession(
  input: OpenCashSessionInput,
): Promise<OpenCashSessionResult> {
  let supabase
  try {
    supabase = createServiceRoleClient()
  } catch {
    return { data: null, error: "server_unavailable" }
  }

  // Guard: only one open cash session is allowed at any time (also enforced by DB unique index).
  const { data: existingOpen, error: existingOpenErr } = await (
    supabase.from("cash_sessions")
  )
    .select("id, opened_at, shift_log_id")
    .eq("status", "open")
    .maybeSingle()

  if (existingOpenErr) {
    console.error("[openCashSession] open probe", existingOpenErr.message)
    return { data: null, error: existingOpenErr.message }
  }
  if (existingOpen) {
    if (existingOpen.shift_log_id === input.shiftLogId) {
      const { data: openSession, error: openSessionErr } = await (
        supabase.from("cash_sessions")
      )
        .select("*")
        .eq("id", existingOpen.id)
        .single()

      if (openSessionErr || !openSession) {
        console.error("[openCashSession] open session fetch", openSessionErr?.message)
        return {
          data: null,
          error: openSessionErr?.message ?? "fetch_failed",
        }
      }
      return { data: openSession as CashSessionRow, error: null }
    }
    return {
      data: null,
      error:
        "Уже есть открытая кассовая смена на другую трудовую смену. " +
        "Сначала закройте предыдущую смену через ⋯ → Закрыть смену.",
    }
  }

  const { data: existing, error: existingErr } = await (
    supabase.from("cash_sessions")
  )
    .select("id")
    .eq("shift_log_id", input.shiftLogId)
    .maybeSingle()

  if (existingErr) {
    console.error("[openCashSession] probe", existingErr.message)
    return { data: null, error: existingErr.message }
  }
  if (existing) {
    return { data: null, error: "session_already_exists" }
  }

  const openedAt = new Date().toISOString()

  try {
    const { data: session, error: sessionErr } = await (
      supabase.from("cash_sessions")
    )
      .insert({
        shift_log_id: input.shiftLogId,
        opening_balance_bani: input.openingBalanceBani,
        status: "open",
        opened_at: openedAt,
        opened_by_staff_id: input.createdByStaffId,
      })
      .select("*")
      .single()

    if (sessionErr || !session) {
      if (sessionErr?.code === "23505") {
        return {
          data: null,
          error:
            "Кассовая смена уже открыта другим оператором. Обновите страницу.",
        }
      }
      console.error("[openCashSession] insert session", sessionErr?.message)
      return {
        data: null,
        error: sessionErr?.message ?? "insert_failed",
      }
    }

    const row = session as CashSessionRow

    const { error: txErr } = await (supabase.from("cash_transactions")).insert({
      cash_session_id: row.id,
      type: "opening",
      direction: "in",
      amount_bani: input.openingBalanceBani,
      payment_method: "cash",
      created_by_staff_id: input.createdByStaffId,
    })

    if (txErr) {
      console.error("[openCashSession] insert tx", txErr.message)
      await (supabase.from("cash_sessions")).delete().eq("id", row.id)
      return { data: null, error: txErr.message }
    }

    return { data: row, error: null }
  } catch (err: unknown) {
    const code =
      err && typeof err === "object" && "code" in err
        ? String((err as { code?: string }).code)
        : undefined
    if (code === "23505") {
      return {
        data: null,
        error:
          "Кассовая смена уже открыта другим оператором. Обновите страницу.",
      }
    }
    throw err
  }
}

export type GetCashSessionInput = {
  shiftLogId: string
}

export type GetCashSessionResult =
  | {
      data: {
        session: CashSessionRow
        transactions: CashTransactionRow[]
        aggregates: CashSessionAggregates
        payment_breakdown: CashSessionPaymentBreakdown
        manual_breakdown: CashSessionManualBreakdown
        recent_transactions: CashSessionRecentTransaction[]
        recent_manual_transactions: CashSessionRecentManualTransaction[]
      }
      error: null
    }
  | { data: null; error: string }

export async function getCashSession(
  input: GetCashSessionInput,
): Promise<GetCashSessionResult> {
  let supabase
  try {
    supabase = createServiceRoleClient()
  } catch {
    return { data: null, error: "server_unavailable" }
  }

  const { data: sessionRow, error: sessionErr } = await (
    supabase.from("cash_sessions")
  )
    .select("*")
    .eq("shift_log_id", input.shiftLogId)
    .maybeSingle()

  if (sessionErr) {
    console.error("[getCashSession] session", sessionErr.message)
    return { data: null, error: sessionErr.message }
  }
  if (!sessionRow) {
    return { data: null, error: "not_found" }
  }

  const session = sessionRow as CashSessionRow

  const { data: txRows, error: txErr } = await (
    supabase.from("cash_transactions")
  )
    .select("*, staff:created_by_staff_id(name)")
    .eq("cash_session_id", session.id)
    .order("created_at", { ascending: true })

  if (txErr) {
    console.error("[getCashSession] transactions", txErr.message)
    return { data: null, error: txErr.message }
  }

  const transactionRows = (txRows ?? []) as CashTransactionDbRow[]
  const transactions = transactionRows.map(toCashTransactionRow)

  let cash_in_bani = 0
  let cash_out_bani = 0
  let card_revenue_bani = 0
  let encashment_bani = 0
  let expenses_bani = 0
  let income_bani = 0

  for (const t of transactions) {
    if (!isActiveCashTransaction(t)) continue

    const amount = Number(t.amount_bani) || 0
    if (
      t.direction === "in" &&
      t.payment_method === "cash" &&
      t.type !== "opening"
    ) {
      cash_in_bani += amount
    }
    if (t.direction === "out" && t.payment_method === "cash") {
      cash_out_bani += amount
    }
    if (t.type === "order_payment" && t.payment_method === "card") {
      card_revenue_bani += amount
    }
    if (t.type === "encashment") {
      encashment_bani += amount
    }
    if (t.type === "expense") {
      expenses_bani += amount
    }
    if (t.type === "income") {
      income_bani += amount
    }
  }

  const opening = Number(session.opening_balance_bani) || 0
  const expected_in_drawer_bani = opening + cash_in_bani - cash_out_bani

  const aggregates: CashSessionAggregates = {
    cash_in_bani,
    cash_out_bani,
    card_revenue_bani,
    encashment_bani,
    expenses_bani,
    income_bani,
    expected_in_drawer_bani,
  }

  const payment_breakdown = buildPaymentBreakdown(transactions)
  const manual_breakdown = buildManualBreakdown(transactions)
  const recent_transactions = buildRecentTransactions(transactionRows)
  const recent_manual_transactions =
    buildRecentManualTransactions(transactionRows)

  return {
    data: {
      session,
      transactions,
      aggregates,
      payment_breakdown,
      manual_breakdown,
      recent_transactions,
      recent_manual_transactions,
    },
    error: null,
  }
}

/** Ожидаемый остаток в ящике для закрытия смены (та же логика, что в getCashSession). */
function closingExpectedFromTransactions(
  session: CashSessionRow,
  transactions: CashTransactionRow[],
): number {
  let cash_in_bani = 0
  let cash_out_bani = 0
  for (const t of transactions) {
    if (!isActiveCashTransaction(t)) continue

    const amount = Number(t.amount_bani) || 0
    if (
      t.direction === "in" &&
      t.payment_method === "cash" &&
      t.type !== "opening"
    ) {
      cash_in_bani += amount
    }
    if (t.direction === "out" && t.payment_method === "cash") {
      cash_out_bani += amount
    }
  }
  const opening = Number(session.opening_balance_bani) || 0
  return opening + cash_in_bani - cash_out_bani
}

export type CreateCashTransactionInput = {
  cashSessionId: string
  type: "expense" | "income" | "encashment"
  direction: "in" | "out"
  amountBani: number
  category?: "ingredients" | "salary" | "utilities" | "other" | null
  expense_category_id?: string
  description?: string | null
  createdByStaffId?: string | null
  encashment_destination?: string | null
}

export type CreateCashTransactionResult =
  | { data: CashTransactionRow; error: null }
  | { data: null; error: string }

export async function createCashTransaction(
  input: CreateCashTransactionInput,
): Promise<CreateCashTransactionResult> {
  if (input.amountBani <= 0) {
    return { data: null, error: "invalid_amount" }
  }
  if (input.type === "encashment" && input.direction !== "out") {
    return { data: null, error: "invalid_direction" }
  }
  if (input.type === "income" && input.direction !== "in") {
    return { data: null, error: "invalid_direction" }
  }
  if (input.type === "expense" && input.direction !== "out") {
    return { data: null, error: "invalid_direction" }
  }

  let supabase
  try {
    supabase = createServiceRoleClient()
  } catch {
    return { data: null, error: "server_unavailable" }
  }

  const { data: sessionRow, error: sessErr } = await (
    supabase.from("cash_sessions")
  )
    .select("*")
    .eq("id", input.cashSessionId)
    .maybeSingle()

  if (sessErr) {
    console.error("[createCashTransaction] session", sessErr.message)
    return { data: null, error: sessErr.message }
  }
  if (!sessionRow) {
    return { data: null, error: "session_not_open" }
  }
  const sess = sessionRow as CashSessionRow
  if (sess.status !== "open") {
    return { data: null, error: "session_not_open" }
  }

  const { data: inserted, error: insErr } = await (
    supabase.from("cash_transactions")
  )
    .insert({
      cash_session_id: input.cashSessionId,
      type: input.type,
      direction: input.direction,
      amount_bani: input.amountBani,
      payment_method: "cash",
      category: input.category ?? null,
      expense_category_id: input.expense_category_id?.trim() || null,
      description: input.description ?? null,
      order_id: null,
      created_by_staff_id: input.createdByStaffId ?? null,
      encashment_destination: input.encashment_destination ?? null,
    })
    .select("*")
    .single()

  if (insErr || !inserted) {
    console.error("[createCashTransaction] insert", insErr?.message)
    return {
      data: null,
      error: insErr?.message ?? "insert_failed",
    }
  }

  return { data: inserted as CashTransactionRow, error: null }
}

export type CloseCashSessionInput = {
  cashSessionId: string
  closingBalanceActualBani: number
  discrepancyReason?: string | null
}

export type CloseCashSessionResult =
  | { data: CashSessionRow; error: null }
  | { data: null; error: string }

export async function closeCashSession(
  input: CloseCashSessionInput,
): Promise<CloseCashSessionResult> {
  let supabase
  try {
    supabase = createServiceRoleClient()
  } catch {
    return { data: null, error: "server_unavailable" }
  }

  const { data: sessionRow, error: sessionErr } = await (
    supabase.from("cash_sessions")
  )
    .select("*")
    .eq("id", input.cashSessionId)
    .maybeSingle()

  if (sessionErr) {
    console.error("[closeCashSession] session", sessionErr.message)
    return { data: null, error: sessionErr.message }
  }
  if (!sessionRow) {
    return { data: null, error: "session_already_closed" }
  }

  const session = sessionRow as CashSessionRow
  if (session.status !== "open") {
    return { data: null, error: "session_already_closed" }
  }

  const { data: txRows, error: txErr } = await (
    supabase.from("cash_transactions")
  )
    .select("*")
    .eq("cash_session_id", input.cashSessionId)
    .order("created_at", { ascending: true })

  if (txErr) {
    console.error("[closeCashSession] transactions", txErr.message)
    return { data: null, error: txErr.message }
  }

  const transactions = (txRows ?? []) as CashTransactionRow[]
  const closing_balance_expected_bani = closingExpectedFromTransactions(
    session,
    transactions,
  )

  const closedAt = new Date().toISOString()
  const staff = await getCurrentStaff()

  const { data: updated, error: updErr } = await (
    supabase.from("cash_sessions")
  )
    .update({
      status: "closed",
      closed_at: closedAt,
      closing_balance_actual_bani: input.closingBalanceActualBani,
      closing_balance_expected_bani,
      closed_by_staff_id: staff?.id ?? null,
      discrepancy_reason: input.discrepancyReason ?? null,
    })
    .eq("id", input.cashSessionId)
    .eq("status", "open")
    .select("*")
    .maybeSingle()

  if (updErr || !updated) {
    console.error("[closeCashSession] update", updErr?.message)
    return {
      data: null,
      error: updErr?.message ?? "session_already_closed",
    }
  }

  return { data: updated as CashSessionRow, error: null }
}

const ACTIVE_SHIFT_ORDER_STATUSES = [
  "new",
  "confirmed",
  "cooking",
  "ready",
  "delivery",
] as const

export type ActiveShiftOrderSummary = {
  id: string
  status: string
  total: number
  brand_slug: string | null
}

export async function getActiveOrdersCountForShift(
  cashSessionId: string,
): Promise<{
  count: number
  orders: ActiveShiftOrderSummary[]
}> {
  let supabase
  try {
    supabase = createServiceRoleClient()
  } catch {
    return { count: 0, orders: [] }
  }

  const { data: sessionRow, error: sessionErr } = await (
    supabase.from("cash_sessions")
  )
    .select("id, opened_at")
    .eq("id", cashSessionId)
    .maybeSingle()

  if (sessionErr || !sessionRow) {
    return { count: 0, orders: [] }
  }

  const openedAt = (sessionRow as { opened_at: string }).opened_at
  const now = new Date().toISOString()

  type OrderQueryRow = {
    id: string
    status: string
    total: number
    created_at: string
    brands: { slug: string } | { slug: string }[] | null
  }

  const orderSelect = "id, status, total, created_at, brands(slug)"

  const [{ data: linkedRows }, { data: unlinkedRows }] = await Promise.all([
    (supabase.from("orders") as any)
      .select(orderSelect)
      .eq("cash_session_id", cashSessionId)
      .in("status", ACTIVE_SHIFT_ORDER_STATUSES),
    (supabase.from("orders") as any)
      .select(orderSelect)
      .is("cash_session_id", null)
      .in("status", ACTIVE_SHIFT_ORDER_STATUSES)
      .gte("created_at", openedAt)
      .lte("created_at", now),
  ])

  const byId = new Map<
    string,
    ActiveShiftOrderSummary & { created_at: string }
  >()

  for (const row of [
    ...((linkedRows ?? []) as OrderQueryRow[]),
    ...((unlinkedRows ?? []) as OrderQueryRow[]),
  ]) {
    if (byId.has(row.id)) continue

    let brandSlug: string | null = null
    const brands = row.brands
    if (brands) {
      if (Array.isArray(brands)) {
        brandSlug = brands[0]?.slug ?? null
      } else {
        brandSlug = brands.slug ?? null
      }
    }

    byId.set(row.id, {
      id: row.id,
      status: row.status,
      total: Number(row.total) || 0,
      brand_slug: brandSlug,
      created_at: row.created_at,
    })
  }

  const sorted = [...byId.values()].sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  )

  const count = sorted.length
  const orders = sorted.slice(0, 20).map(({ created_at: _createdAt, ...order }) => {
    void _createdAt
    return order
  })

  return { count, orders }
}

export async function getExpectedInDrawerBani(cashSessionId: string): Promise<
  { data: number; error: null } | { data: null; error: string }
> {
  let supabase
  try {
    supabase = createServiceRoleClient()
  } catch {
    return { data: null, error: "server_unavailable" }
  }

  const { data: sessionRow, error: sessionErr } = await (
    supabase.from("cash_sessions")
  )
    .select("*")
    .eq("id", cashSessionId)
    .maybeSingle()

  if (sessionErr) {
    console.error("[getExpectedInDrawerBani] session", sessionErr.message)
    return { data: null, error: sessionErr.message }
  }
  if (!sessionRow) {
    return { data: null, error: "not_found" }
  }

  const session = sessionRow as CashSessionRow

  const { data: txRows, error: txErr } = await (
    supabase.from("cash_transactions")
  )
    .select("*")
    .eq("cash_session_id", cashSessionId)
    .order("created_at", { ascending: true })

  if (txErr) {
    console.error("[getExpectedInDrawerBani] transactions", txErr.message)
    return { data: null, error: txErr.message }
  }

  const transactions = (txRows ?? []) as CashTransactionRow[]
  return {
    data: closingExpectedFromTransactions(session, transactions),
    error: null,
  }
}

type OrderPayRow = {
  id: string
  total: number
  status: string
  paid_at: string | null
}

type PayOrderLoadedRow = OrderPayRow & {
  profile_id: string | null
  brand_id: string | null
  bonus_multiplier?: number | null
  delivery_mode?: string | null
  payment_method?: string | null
  cash_amount?: number | null
  card_amount?: number | null
}

export type PayOrderInput = {
  orderId: string
  cashSessionId: string
  paymentMethod: "cash" | "card"
  createdByStaffId?: string | null
}

export type PayOrderResult =
  | {
      data: { order: OrderPayRow; transaction: CashTransactionRow | null }
      error: null
    }
  | { data: null; error: string }

export async function payOrder(input: PayOrderInput): Promise<PayOrderResult> {
  let supabase
  try {
    supabase = createServiceRoleClient()
  } catch {
    return { data: null, error: "server_unavailable" }
  }

  const { data: orderRow, error: orderErr } = await (
    supabase.from("orders") as any
  )
    .select(
      "id, total, status, paid_at, profile_id, brand_id, bonus_multiplier, delivery_mode, payment_method, cash_amount, card_amount",
    )
    .eq("id", input.orderId)
    .maybeSingle()

  if (orderErr) {
    console.error("[payOrder] order", orderErr.message)
    return { data: null, error: orderErr.message }
  }
  if (!orderRow) {
    return { data: null, error: "invalid_order_status" }
  }

  const order = orderRow as PayOrderLoadedRow

  const canPayOrder =
    order.status === "delivery" ||
    (order.status === "ready" && order.delivery_mode === "aggregator") ||
    (order.status === "ready" && order.delivery_mode === "pickup")
  if (!canPayOrder) {
    return {
      data: null,
      error: `Нельзя оплатить заказ со статусом "${order.status}" (режим: ${order.delivery_mode ?? "—"})`,
    }
  }
  if (order.paid_at != null) {
    return { data: null, error: "already_paid" }
  }

  const { data: sessRow, error: sessErr } = await (
    supabase.from("cash_sessions")
  )
    .select("*")
    .eq("id", input.cashSessionId)
    .maybeSingle()

  if (sessErr) {
    console.error("[payOrder] session", sessErr.message)
    return { data: null, error: sessErr.message }
  }
  if (!sessRow) {
    return { data: null, error: "session_not_open" }
  }
  if ((sessRow as CashSessionRow).status !== "open") {
    return { data: null, error: "session_not_open" }
  }

  const paidAt = new Date().toISOString()
  const isAggregator = order.delivery_mode === "aggregator"
  const skipCashTransaction =
    isAggregator && input.paymentMethod === "card"

  const orderPatch: Record<string, unknown> = {
    paid_at: paidAt,
    status: "done",
    cash_session_id: input.cashSessionId,
  }
  if (isAggregator && input.paymentMethod === "card") {
    orderPatch.payment_method = "aggregator_card"
  } else if (isAggregator && input.paymentMethod === "cash") {
    orderPatch.payment_method = "cash"
  }

  const expectedPayStatus = order.status === "delivery" ? "delivery" : "ready"

  const { data: updatedOrders, error: updOrderErr } = await supabase
    .from("orders")
    .update(orderPatch)
    .eq("id", input.orderId)
    .eq("status", expectedPayStatus)
    .select("id, total, status, paid_at")
    .maybeSingle()

  if (updOrderErr || !updatedOrders) {
    console.error("[payOrder] update order", updOrderErr?.message)
    return {
      data: null,
      error: updOrderErr?.message ?? "invalid_order_status",
    }
  }

  const updatedOrder = updatedOrders as OrderPayRow

  let transaction: CashTransactionRow | null = null
  if (!skipCashTransaction) {
    const cashAmt = Number(order.cash_amount ?? 0)
    const cardAmt = Number(order.card_amount ?? 0)
    const isSplit =
      order.payment_method === "mixed" && cashAmt > 0 && cardAmt > 0

    const staffId = input.createdByStaffId ?? null
    const orderDeliveryMode = order.delivery_mode ?? null
    const orderBrandId = order.brand_id ?? null

    if (isSplit) {
      const { data: txIns, error: txErr } = await supabase
        .from("cash_transactions")
        .insert([
          {
            cash_session_id: input.cashSessionId,
            type: "order_payment",
            direction: "in",
            amount_bani: cashAmt,
            payment_method: "cash",
            order_id: input.orderId,
            created_by_staff_id: staffId,
            category: null,
            description: null,
            order_delivery_mode: orderDeliveryMode,
            order_brand_id: orderBrandId,
          },
          {
            cash_session_id: input.cashSessionId,
            type: "order_payment",
            direction: "in",
            amount_bani: cardAmt,
            payment_method: "card",
            order_id: input.orderId,
            created_by_staff_id: staffId,
            category: null,
            description: null,
            order_delivery_mode: orderDeliveryMode,
            order_brand_id: orderBrandId,
          },
        ])
        .select("*")

      if (txErr || !txIns?.length) {
        console.error("[payOrder] insert tx", txErr?.message)
        return {
          data: null,
          error: txErr?.message ?? "insert_failed",
        }
      }
      transaction = txIns[0] as CashTransactionRow
    } else {
      const { data: txIns, error: txErr } = await (
        supabase.from("cash_transactions")
      )
        .insert({
          cash_session_id: input.cashSessionId,
          type: "order_payment",
          direction: "in",
          amount_bani: updatedOrder.total,
          payment_method: input.paymentMethod,
          order_id: input.orderId,
          created_by_staff_id: staffId,
          category: null,
          description: null,
          order_delivery_mode: orderDeliveryMode,
          order_brand_id: orderBrandId,
        })
        .select("*")
        .single()

      if (txErr || !txIns) {
        console.error("[payOrder] insert tx", txErr?.message)
        return {
          data: null,
          error: txErr?.message ?? "insert_failed",
        }
      }
      transaction = txIns as CashTransactionRow
    }
  }

  const orderId = input.orderId
  if (order.profile_id) {
    await processBonusAccrualOnOrderDone(
      String(order.profile_id),
      orderId,
      Number(order.total),
      order.bonus_multiplier ?? 1,
    ).catch((e) => console.error("bonus accrual failed", e))
  }

  return {
    data: {
      order: updatedOrder,
      transaction,
    },
    error: null,
  }
}
