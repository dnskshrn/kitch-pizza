import { getAdminBrandId } from "@/lib/get-admin-brand-id"
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

function itemCountFromRow(row: RawAuditRow): number {
  const items = row.stock_audit_items
  if (Array.isArray(items)) return items.length
  return 0
}

export default async function AdminInventoryAuditsPage() {
  const brandId = await getAdminBrandId()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("stock_audits")
    .select("*, stock_audit_items(id)")
    .eq("brand_id", brandId)
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
    }
  })

  return <AuditsTable audits={audits} />
}
