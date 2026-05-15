import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { createClient } from "@/lib/supabase/server"
import type { StockAudit } from "@/types/database"

import { AuditsTable, type AuditListRow } from "./audits-table"

type RawAuditRow = {
  id: string
  brand_id: string
  note: string | null
  confirmed_at: string | null
  created_at: string
  stock_audit_items: unknown
}

function diffCostMdlTotalFromRow(row: RawAuditRow): number | null {
  const items = row.stock_audit_items
  if (!Array.isArray(items) || items.length === 0) return null

  let sum = 0
  let seen = false
  for (const it of items) {
    if (!it || typeof it !== "object") continue
    const raw = (it as { diff_cost?: unknown }).diff_cost

    if (raw === null || raw === undefined || raw === "") continue
    const n = Number(raw)
    if (!Number.isFinite(n)) continue
    seen = true
    sum += n
  }

  if (!seen) return null
  return sum
}

function itemCountFromRow(row: RawAuditRow): number {
  const items = row.stock_audit_items
  if (Array.isArray(items)) return items.length
  return 0
}

export default async function AdminInventoryAuditsPage() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("stock_audits")
    .select(`
      *,
      stock_audit_items(id, diff_cost)
    `)
    .order("created_at", { ascending: false })

  if (error) {
    return (
      <p className="text-destructive">
        Не удалось загрузить инвентаризации: {error.message}
      </p>
    )
  }

  const audits: AuditListRow[] = (data ?? []).map((row) => {
    const r = row as RawAuditRow
    const base: StockAudit = {
      id: r.id,
      brand_id: r.brand_id,
      note: r.note,
      confirmed_at: r.confirmed_at,
      created_at: r.created_at,
    }
    return {
      ...base,
      itemCount: itemCountFromRow(r),
      diffCostMdlTotal: diffCostMdlTotalFromRow(r),
    }
  })

  return (
    <div className="space-y-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <span className="text-muted-foreground">Склад</span>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Инвентаризации</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <AuditsTable audits={audits} />
    </div>
  )
}
