"use server"

import { revalidatePath } from "next/cache"
import { getAdminSession } from "@/lib/admin-session"
import { createServiceRoleClient as createServiceSupabaseClient } from "@/lib/supabase/service-role"
import type {
  Expense,
  ExpenseCategory,
  ExpenseCategoryType,
  FinanceSettings,
  GlovoSettlement,
  PnLData,
} from "@/types/finance"

const BANK_COMMISSION_EXPENSE_CATEGORY_ID =
  "ec000001-0000-0000-0000-000000000014"

const DEFAULT_FINANCE_SETTINGS: FinanceSettings = {
  bank_commission_blended_pct: 1.8,
  min_bank_commission_monthly: 35_000,
}

const DEFAULT_GLOVO_COMMISSION_PERCENT = 25
const DEFAULT_GLOVO_VAT_ON_COMMISSION_PERCENT = 20

type MaybeJoin<T> = T | T[] | null | undefined

type RawExpenseCategoryRow = ExpenseCategory

type RawExpenseRow = {
  id: string
  expense_category_id: string
  amount_bani: number | string | null
  payment_source: Expense["payment_source"]
  description: string
  expense_date: string
  receipt_url: string | null
  staff_recipient: string | null
  created_by_staff_id: string | null
  created_at: string
  expense_category: MaybeJoin<RawExpenseCategoryRow>
}

type RawFinanceSettingsRow = {
  bank_commission_blended_pct: number | string | null
  min_bank_commission_monthly: number | string | null
}

type RawStaffRow = {
  id: string
  name: string
}

type RawGlovoSettlementRow = {
  id: string
  period_start: string
  period_end: string
  gross_amount_bani: number | string | null
  commission_bani: number | string | null
  vat_bani: number | string | null
  net_received_bani: number | string | null
  received_at: string | null
  bank_reference: string | null
  notes: string | null
  created_at: string
}

type RawOrderRow = {
  total: number | string | null
  payment_method: "cash" | "card" | "aggregator_card" | "mixed"
  delivery_mode: "delivery" | "pickup" | "aggregator"
  aggregator: "glovo" | null
  cash_amount: number | string | null
  card_amount: number | string | null
}

type RawSupplyOrderRow = {
  total_cost_inc_vat: number | string | null
}

type RawExpenseCategoryTypeRow = {
  type: ExpenseCategoryType
}

type RawCashTransactionExpenseRow = {
  amount_bani: number | string | null
  expense_category_id: string | null
  expense_category: MaybeJoin<RawExpenseCategoryTypeRow>
}

type RawAggregatorSettingsRow = {
  commission_percent: number | string | null
  vat_on_commission_percent: number | string | null
}

function firstFromJoin<T>(value: MaybeJoin<T>): T | null {
  if (!value) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}

function toNumber(value: number | string | null | undefined): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0
  }

  if (typeof value === "string") {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }

  return 0
}

function toInteger(value: number | string | null | undefined): number {
  return Math.round(toNumber(value))
}

function normalizeDateString(value: string, fieldName: string): string {
  const trimmed = value.trim()
  const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/

  if (!isoDatePattern.test(trimmed)) {
    throw new Error(`Некорректная дата в поле "${fieldName}"`)
  }

  const parsed = new Date(`${trimmed}T00:00:00.000Z`)
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Некорректная дата в поле "${fieldName}"`)
  }

  return trimmed
}

function resolveDateRange(params: {
  dateFrom: string
  dateTo: string
}): {
  dateFrom: string
  dateTo: string
  dateTimeFrom: string
  dateTimeToExclusive: string
} {
  const dateFrom = normalizeDateString(params.dateFrom, "dateFrom")
  const dateTo = normalizeDateString(params.dateTo, "dateTo")

  const fromDate = new Date(`${dateFrom}T00:00:00.000Z`)
  const toDate = new Date(`${dateTo}T00:00:00.000Z`)

  if (fromDate.getTime() > toDate.getTime()) {
    throw new Error("Дата начала не может быть позже даты окончания")
  }

  const dateTimeToExclusive = new Date(toDate)
  dateTimeToExclusive.setUTCDate(dateTimeToExclusive.getUTCDate() + 1)

  return {
    dateFrom,
    dateTo,
    dateTimeFrom: fromDate.toISOString(),
    dateTimeToExclusive: dateTimeToExclusive.toISOString(),
  }
}

function mapExpenseCategory(
  category: MaybeJoin<RawExpenseCategoryRow>,
): ExpenseCategory | undefined {
  const row = firstFromJoin(category)
  if (!row) return undefined

  return {
    id: row.id,
    name: row.name,
    type: row.type,
    sort_order: toInteger(row.sort_order),
    is_active: Boolean(row.is_active),
    requires_description: Boolean(row.requires_description),
  }
}

function mapExpense(row: RawExpenseRow): Expense {
  return {
    id: row.id,
    expense_category_id: row.expense_category_id,
    expense_category: mapExpenseCategory(row.expense_category),
    amount_bani: toInteger(row.amount_bani),
    payment_source: row.payment_source,
    description: row.description,
    expense_date: row.expense_date,
    receipt_url: row.receipt_url,
    staff_recipient: row.staff_recipient,
    created_by_staff_id: row.created_by_staff_id,
    created_at: row.created_at,
  }
}

function mapGlovoSettlement(row: RawGlovoSettlementRow): GlovoSettlement {
  return {
    id: row.id,
    period_start: row.period_start,
    period_end: row.period_end,
    gross_amount_bani: toInteger(row.gross_amount_bani),
    commission_bani: toInteger(row.commission_bani),
    vat_bani: toInteger(row.vat_bani),
    net_received_bani: toInteger(row.net_received_bani),
    received_at: row.received_at,
    bank_reference: row.bank_reference,
    notes: row.notes,
    created_at: row.created_at,
  }
}

function getExpenseCategoryType(
  category: MaybeJoin<RawExpenseCategoryTypeRow>,
): ExpenseCategoryType | null {
  return firstFromJoin(category)?.type ?? null
}

function marginPct(value: number, totalGross: number): number {
  if (totalGross === 0) return 0
  return (value / totalGross) * 100
}

export async function getExpenseCategories(): Promise<ExpenseCategory[]> {
  const supabase = createServiceSupabaseClient()
  const { data, error } = await supabase
    .from("expense_categories")
    .select("id, name, type, sort_order, is_active, requires_description")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  const rows = (data ?? []) as RawExpenseCategoryRow[]
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    type: row.type,
    sort_order: toInteger(row.sort_order),
    is_active: Boolean(row.is_active),
    requires_description: Boolean(row.requires_description),
  }))
}

export async function getStaffList(): Promise<{ id: string; name: string }[]> {
  const supabase = createServiceSupabaseClient()
  const { data, error } = await supabase
    .from("staff")
    .select("id, name")
    .eq("is_active", true)
    .order("name", { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  const rows = (data ?? []) as RawStaffRow[]
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
  }))
}

export async function getFinanceSettings(): Promise<FinanceSettings> {
  const supabase = createServiceSupabaseClient()
  const { data, error } = await supabase
    .from("finance_settings")
    .select("bank_commission_blended_pct, min_bank_commission_monthly")
    .eq("id", 1)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  const row = data as RawFinanceSettingsRow | null
  if (!row) {
    return DEFAULT_FINANCE_SETTINGS
  }

  return {
    bank_commission_blended_pct:
      toNumber(row.bank_commission_blended_pct) ||
      DEFAULT_FINANCE_SETTINGS.bank_commission_blended_pct,
    min_bank_commission_monthly:
      toInteger(row.min_bank_commission_monthly) ||
      DEFAULT_FINANCE_SETTINGS.min_bank_commission_monthly,
  }
}

export async function getExpenses(params: {
  dateFrom: string
  dateTo: string
}): Promise<Expense[]> {
  const { dateFrom, dateTo } = resolveDateRange(params)
  const supabase = createServiceSupabaseClient()

  const { data, error } = await supabase
    .from("expenses")
    .select(`
      id,
      expense_category_id,
      amount_bani,
      payment_source,
      description,
      expense_date,
      receipt_url,
      staff_recipient,
      created_by_staff_id,
      created_at,
      expense_category:expense_categories (
        id,
        name,
        type,
        sort_order,
        is_active,
        requires_description
      )
    `)
    .gte("expense_date", dateFrom)
    .lte("expense_date", dateTo)
    .order("expense_date", { ascending: false })
    .order("created_at", { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  const rows = (data ?? []) as RawExpenseRow[]
  return rows.map(mapExpense)
}

export async function createExpense(data: {
  expense_category_id: string
  amount_bani: number
  payment_source: "bank_transfer" | "card_online" | "cash_manual"
  description: string
  expense_date: string
  receipt_url?: string
  staff_recipient?: string
}): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getAdminSession()
    if (!session?.staffId) {
      return { success: false, error: "Не удалось определить администратора" }
    }

    const expenseDate = normalizeDateString(data.expense_date, "expense_date")
    const description = data.description.trim()
    const expenseCategoryId = data.expense_category_id.trim()
    const amountBani = Math.round(data.amount_bani)
    const receiptUrl = data.receipt_url?.trim() || null
    const staffRecipient = data.staff_recipient?.trim() || null

    if (!expenseCategoryId) {
      return { success: false, error: "Не выбрана категория расхода" }
    }

    if (!Number.isFinite(amountBani) || amountBani <= 0) {
      return { success: false, error: "Некорректная сумма расхода" }
    }

    const supabase = createServiceSupabaseClient()
    const { error } = await supabase.from("expenses").insert({
      expense_category_id: expenseCategoryId,
      amount_bani: amountBani,
      payment_source: data.payment_source,
      description,
      expense_date: expenseDate,
      receipt_url: receiptUrl,
      staff_recipient: staffRecipient,
      created_by_staff_id: session.staffId,
    })

    if (error) {
      return { success: false, error: error.message }
    }

    revalidatePath("/admin/finances")
    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Не удалось создать расход",
    }
  }
}

export async function deleteExpense(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const expenseId = id.trim()
    if (!expenseId) {
      return { success: false, error: "Не указан расход для удаления" }
    }

    const supabase = createServiceSupabaseClient()
    const { error } = await supabase.from("expenses").delete().eq("id", expenseId)

    if (error) {
      return { success: false, error: error.message }
    }

    revalidatePath("/admin/finances")
    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Не удалось удалить расход",
    }
  }
}

export async function getGlovoSettlements(params: {
  dateFrom: string
  dateTo: string
}): Promise<GlovoSettlement[]> {
  const { dateFrom, dateTo } = resolveDateRange(params)
  const supabase = createServiceSupabaseClient()

  const { data, error } = await supabase
    .from("glovo_settlements")
    .select(`
      id,
      period_start,
      period_end,
      gross_amount_bani,
      commission_bani,
      vat_bani,
      net_received_bani,
      received_at,
      bank_reference,
      notes,
      created_at
    `)
    .gte("period_start", dateFrom)
    .lte("period_end", dateTo)
    .order("period_start", { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  const rows = (data ?? []) as RawGlovoSettlementRow[]
  return rows.map(mapGlovoSettlement)
}

export async function createGlovoSettlement(
  data: Omit<GlovoSettlement, "id" | "created_at">,
): Promise<{ success: boolean; error?: string }> {
  try {
    const periodStart = normalizeDateString(data.period_start, "period_start")
    const periodEnd = normalizeDateString(data.period_end, "period_end")

    if (periodStart > periodEnd) {
      return {
        success: false,
        error: "Дата начала периода не может быть позже даты окончания",
      }
    }

    const receivedAt = data.received_at
      ? normalizeDateString(data.received_at, "received_at")
      : null

    const supabase = createServiceSupabaseClient()
    const { error } = await supabase.from("glovo_settlements").insert({
      period_start: periodStart,
      period_end: periodEnd,
      gross_amount_bani: Math.round(data.gross_amount_bani),
      commission_bani: Math.round(data.commission_bani),
      vat_bani: Math.round(data.vat_bani),
      net_received_bani: Math.round(data.net_received_bani),
      received_at: receivedAt,
      bank_reference: data.bank_reference?.trim() || null,
      notes: data.notes?.trim() || null,
    })

    if (error) {
      return { success: false, error: error.message }
    }

    revalidatePath("/admin/finances")
    return { success: true }
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Не удалось сохранить выплату Glovo",
    }
  }
}

export async function deleteGlovoSettlement(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const settlementId = id.trim()
    if (!settlementId) {
      return { success: false, error: "Не указана выплата Glovo для удаления" }
    }

    const supabase = createServiceSupabaseClient()
    const { error } = await supabase
      .from("glovo_settlements")
      .delete()
      .eq("id", settlementId)

    if (error) {
      return { success: false, error: error.message }
    }

    revalidatePath("/admin/finances")
    return { success: true }
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Не удалось удалить выплату Glovo",
    }
  }
}

export async function computePnL(params: {
  dateFrom: string
  dateTo: string
}): Promise<PnLData> {
  const { dateFrom, dateTo, dateTimeFrom, dateTimeToExclusive } =
    resolveDateRange(params)

  const supabase = createServiceSupabaseClient()

  const [
    settings,
    expenses,
    settlements,
    ordersResult,
    supplyOrdersResult,
    cashTransactionsResult,
    aggregatorSettingsResult,
  ] = await Promise.all([
    getFinanceSettings(),
    getExpenses({ dateFrom, dateTo }),
    getGlovoSettlements({ dateFrom, dateTo }),
    supabase
      .from("orders")
      .select(
        "total, payment_method, delivery_mode, aggregator, cash_amount, card_amount",
      )
      .neq("status", "cancelled")
      .neq("status", "rejected")
      .gte("created_at", dateTimeFrom)
      .lt("created_at", dateTimeToExclusive),
    supabase
      .from("supply_orders")
      .select("total_cost_inc_vat")
      .is("annulled_at", null)
      .gte("delivery_date", dateFrom)
      .lte("delivery_date", dateTo),
    supabase
      .from("cash_transactions")
      .select(`
        amount_bani,
        expense_category_id,
        expense_category:expense_categories (
          type
        )
      `)
      .eq("type", "expense")
      .is("voided_at", null)
      .gte("created_at", dateTimeFrom)
      .lt("created_at", dateTimeToExclusive),
    supabase
      .from("aggregator_settings")
      .select("commission_percent, vat_on_commission_percent")
      .eq("id", 1)
      .maybeSingle(),
  ])

  if (ordersResult.error) {
    throw new Error(ordersResult.error.message)
  }

  if (supplyOrdersResult.error) {
    throw new Error(supplyOrdersResult.error.message)
  }

  if (cashTransactionsResult.error) {
    throw new Error(cashTransactionsResult.error.message)
  }

  if (aggregatorSettingsResult.error) {
    throw new Error(aggregatorSettingsResult.error.message)
  }

  const orderRows = (ordersResult.data ?? []) as RawOrderRow[]

  let ownCash = 0
  let ownCard = 0
  let glovoCashGross = 0
  let glovoCardGross = 0
  let totalGross = 0

  for (const row of orderRows) {
    const total = toInteger(row.total)
    const cashAmount = toInteger(row.cash_amount)
    const cardAmount = toInteger(row.card_amount)
    const isGlovo = row.aggregator === "glovo"

    totalGross += total

    if (isGlovo) {
      if (row.payment_method === "cash") {
        glovoCashGross += total
      } else if (row.payment_method === "aggregator_card") {
        glovoCardGross += total
      } else if (row.payment_method === "mixed") {
        glovoCashGross += cashAmount
        glovoCardGross += cardAmount
      }
      continue
    }

    if (row.payment_method === "cash") {
      ownCash += total
    } else if (row.payment_method === "card") {
      ownCard += cardAmount > 0 ? cardAmount : total
    } else if (row.payment_method === "mixed") {
      ownCash += cashAmount
      ownCard += cardAmount
    }
  }

  const aggregatorSettings = aggregatorSettingsResult.data as
    | RawAggregatorSettingsRow
    | null

  const glovoCommissionPercent =
    toNumber(aggregatorSettings?.commission_percent) ||
    DEFAULT_GLOVO_COMMISSION_PERCENT
  const glovoVatOnCommissionPercent =
    toNumber(aggregatorSettings?.vat_on_commission_percent) ||
    DEFAULT_GLOVO_VAT_ON_COMMISSION_PERCENT
  const glovoEffectiveRate =
    (glovoCommissionPercent * (1 + glovoVatOnCommissionPercent / 100)) / 100

  const glovoCalculated = Math.round(
    (glovoCashGross + glovoCardGross) * glovoEffectiveRate,
  )

  let glovoActualSum = 0
  let hasGlovoActual = false
  for (const settlement of settlements) {
    glovoActualSum += settlement.commission_bani + settlement.vat_bani
    hasGlovoActual = true
  }

  const bankRevenue = ownCard
  const bankCalculated = Math.round(
    bankRevenue * (settings.bank_commission_blended_pct / 100),
  )

  let variableExpenses = 0
  let fixedExpenses = 0
  let operationalExpenses = 0
  let commissionExpenses = 0
  let bankActualSum = 0
  let hasBankActual = false

  for (const expense of expenses) {
    const expenseType = expense.expense_category?.type
    if (!expenseType) continue

    if (expense.expense_category_id === BANK_COMMISSION_EXPENSE_CATEGORY_ID) {
      bankActualSum += expense.amount_bani
      hasBankActual = true
    }

    if (expenseType === "variable") {
      variableExpenses += expense.amount_bani
    } else if (expenseType === "fixed") {
      fixedExpenses += expense.amount_bani
    } else if (expenseType === "operational") {
      operationalExpenses += expense.amount_bani
    } else if (expenseType === "commission") {
      commissionExpenses += expense.amount_bani
    }
  }

  const cashTransactionRows = (cashTransactionsResult.data ??
    []) as RawCashTransactionExpenseRow[]

  for (const row of cashTransactionRows) {
    const expenseType = getExpenseCategoryType(row.expense_category)
    const amount = toInteger(row.amount_bani)

    if (!expenseType || amount === 0) continue

    if (expenseType === "variable") {
      variableExpenses += amount
    } else if (expenseType === "fixed") {
      fixedExpenses += amount
    } else if (expenseType === "operational") {
      operationalExpenses += amount
    }
  }

  const supplyOrderRows = (supplyOrdersResult.data ?? []) as RawSupplyOrderRow[]
  const supplyOrders = supplyOrderRows.reduce((sum, row) => {
    return sum + Math.round(toNumber(row.total_cost_inc_vat) * 100)
  }, 0)

  const glovoActual = hasGlovoActual ? glovoActualSum : null
  const bankActual = hasBankActual ? bankActualSum : null
  const variable = supplyOrders + variableExpenses

  const netRevenue =
    totalGross -
    (glovoActual ?? glovoCalculated) -
    (bankActual ?? bankCalculated)

  const grossProfit = netRevenue - variable
  const grossMarginPct = marginPct(grossProfit, totalGross)

  const operatingProfit = grossProfit - fixedExpenses - operationalExpenses
  const operatingMarginPct = marginPct(operatingProfit, totalGross)

  const netProfit = operatingProfit - commissionExpenses
  const netMarginPct = marginPct(netProfit, totalGross)

  return {
    revenue: {
      ownCash,
      ownCard,
      glovoCashGross,
      glovoCardGross,
      totalGross,
    },
    commissions: {
      glovoCalculated,
      glovoActual,
      bankCalculated,
      bankActual,
    },
    netRevenue,
    expenses: {
      variable,
      supplyOrders,
      fixed: fixedExpenses,
      operational: operationalExpenses,
      commission: commissionExpenses,
    },
    grossProfit,
    grossMarginPct,
    operatingProfit,
    operatingMarginPct,
    netProfit,
    netMarginPct,
  }
}
