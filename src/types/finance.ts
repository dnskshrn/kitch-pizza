export type ExpenseCategoryType =
  | "variable"
  | "fixed"
  | "operational"
  | "commission"

export interface ExpenseCategory {
  id: string
  name: string
  type: ExpenseCategoryType
  sort_order: number
  is_active: boolean
  requires_description: boolean
}

export interface Expense {
  id: string
  expense_category_id: string
  expense_category?: ExpenseCategory
  amount_bani: number
  payment_source: "bank_transfer" | "card_online" | "cash_manual"
  description: string
  expense_date: string
  receipt_url: string | null
  staff_recipient: string | null
  created_by_staff_id: string | null
  created_at: string
}

export interface GlovoSettlement {
  id: string
  period_start: string
  period_end: string
  gross_amount_bani: number
  commission_bani: number
  vat_bani: number
  net_received_bani: number
  received_at: string | null
  bank_reference: string | null
  notes: string | null
  created_at: string
}

export interface FinanceSettings {
  bank_commission_blended_pct: number
  min_bank_commission_monthly: number
}

export interface PnLData {
  revenue: {
    ownCash: number
    ownCard: number
    glovoCashGross: number
    glovoCardGross: number
    totalGross: number
  }
  commissions: {
    glovoCalculated: number
    glovoActual: number | null
    bankCalculated: number
    bankActual: number | null
  }
  netRevenue: number
  expenses: {
    variable: number
    supplyOrders: number
    fixed: number
    operational: number
    commission: number
  }
  grossProfit: number
  grossMarginPct: number
  operatingProfit: number
  operatingMarginPct: number
  netProfit: number
  netMarginPct: number
}
