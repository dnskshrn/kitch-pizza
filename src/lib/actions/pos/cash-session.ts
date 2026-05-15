"use server"

import { processBonusAccrualOnOrderDone } from "@/lib/bonus"
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
  description: string | null
  order_id: string | null
  created_by_staff_id: string | null
  created_at: string
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

  const { data: session, error: sessionErr } = await (
    supabase.from("cash_sessions")
  )
    .insert({
      shift_log_id: input.shiftLogId,
      opening_balance_bani: input.openingBalanceBani,
      status: "open",
      opened_at: openedAt,
    })
    .select("*")
    .single()

  if (sessionErr || !session) {
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
    .select("*")
    .eq("cash_session_id", session.id)
    .order("created_at", { ascending: true })

  if (txErr) {
    console.error("[getCashSession] transactions", txErr.message)
    return { data: null, error: txErr.message }
  }

  const transactions = (txRows ?? []) as CashTransactionRow[]

  let cash_in_bani = 0
  let cash_out_bani = 0
  let card_revenue_bani = 0
  let encashment_bani = 0
  let expenses_bani = 0
  let income_bani = 0

  for (const t of transactions) {
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

  return {
    data: { session, transactions, aggregates },
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
  description?: string | null
  createdByStaffId?: string | null
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
      description: input.description ?? null,
      order_id: null,
      created_by_staff_id: input.createdByStaffId ?? null,
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

  const { data: updated, error: updErr } = await (
    supabase.from("cash_sessions")
  )
    .update({
      status: "closed",
      closed_at: closedAt,
      closing_balance_actual_bani: input.closingBalanceActualBani,
      closing_balance_expected_bani,
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

type OrderPayRow = {
  id: string
  total: number
  status: string
  paid_at: string | null
}

export type PayOrderInput = {
  orderId: string
  cashSessionId: string
  paymentMethod: "cash" | "card"
  createdByStaffId?: string | null
}

export type PayOrderResult =
  | {
      data: { order: OrderPayRow; transaction: CashTransactionRow }
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

  const { data: orderRow, error: orderErr } = await supabase
    .from("orders")
    .select("id, total, status, paid_at")
    .eq("id", input.orderId)
    .maybeSingle()

  if (orderErr) {
    console.error("[payOrder] order", orderErr.message)
    return { data: null, error: orderErr.message }
  }
  if (!orderRow) {
    return { data: null, error: "invalid_order_status" }
  }

  const order = orderRow as OrderPayRow

  if (order.status !== "delivery") {
    return { data: null, error: "invalid_order_status" }
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

  const { data: updatedOrders, error: updOrderErr } = await supabase
    .from("orders")
    .update({
      paid_at: paidAt,
      status: "done",
    })
    .eq("id", input.orderId)
    .eq("status", "delivery")
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
      created_by_staff_id: input.createdByStaffId ?? null,
      category: null,
      description: null,
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

  const orderId = input.orderId
  const { data: accrualOrder, error: accrualOrderErr } = await supabase
    .from("orders")
    .select("profile_id, total, bonuses_redeemed, id")
    .eq("id", orderId)
    .maybeSingle()

  if (accrualOrderErr) {
    console.error("[payOrder] bonus accrual select", accrualOrderErr.message)
  } else if (accrualOrder?.profile_id) {
    await processBonusAccrualOnOrderDone(
      String(accrualOrder.profile_id),
      orderId,
      Number(accrualOrder.total),
    ).catch((e) => console.error("bonus accrual failed", e))
  }

  return {
    data: {
      order: updatedOrder,
      transaction: txIns as CashTransactionRow,
    },
    error: null,
  }
}
