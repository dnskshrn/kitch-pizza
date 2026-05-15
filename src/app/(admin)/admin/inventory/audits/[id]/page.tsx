import Link from "next/link"
import { notFound } from "next/navigation"
import { format, parseISO } from "date-fns"

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/lib/supabase/server"
import type { Ingredient } from "@/types/database"

import {
  AuditConfirmFooter,
  AuditItemsTable,
  type AuditItemsTableRowProps,
} from "./audit-items-table"

function firstRelation<T extends Record<string, unknown>>(rel: unknown): T | null {
  if (rel == null) return null
  if (Array.isArray(rel)) {
    const x = rel[0]
    return x != null && typeof x === "object" ? (x as T) : null
  }
  if (typeof rel === "object") return rel as T
  return null
}

function formatAuditDateTime(iso: string): string {
  try {
    return format(parseISO(iso), "dd.MM.yyyy, HH:mm")
  } catch {
    return iso
  }
}

export default async function StockAuditDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const supabase = await createClient()

  const { data: audit, error } = await supabase
    .from("stock_audits")
    .select(`
      *,
      stock_audit_items(
        id,
        expected_qty,
        actual_qty,
        diff,
        diff_cost,
        cost_per_unit,
        ingredient_id,
        ingredients(name, unit)
      )
    `)
    .eq("id", params.id)
    .single()

  if (error) {
    if (error.code === "PGRST116") notFound()
    throw new Error(error.message)
  }
  if (!audit) notFound()

  type NestedItem = {
    id: string
    expected_qty: number | string
    actual_qty: number | string | null
    diff: number | string | null
    diff_cost: number | string | null
    cost_per_unit: number | string | null
    ingredient_id: string
    ingredients: unknown
  }

  type Row = typeof audit & {
    stock_audit_items: NestedItem[] | null
  }

  const row = audit as Row
  const isConfirmed = row.confirmed_at != null

  const items: AuditItemsTableRowProps[] = (row.stock_audit_items ?? []).map(
    (it: NestedItem) => {
      const ing = firstRelation<{ name: string; unit: string }>(
        it.ingredients
      )
      return {
        id: it.id,
        expected_qty: Number(it.expected_qty),
        actual_qty:
          it.actual_qty === null || it.actual_qty === ""
            ? null
            : Number(it.actual_qty),
        diff:
          it.diff === null || it.diff === "" ? null : Number(it.diff),
        diff_cost:
          it.diff_cost === null ||
          it.diff_cost === undefined ||
          it.diff_cost === ""
            ? null
            : Number(it.diff_cost),
        cost_per_unit:
          it.cost_per_unit === null ||
          it.cost_per_unit === undefined ||
          it.cost_per_unit === ""
            ? null
            : Number(it.cost_per_unit),
        ingredient: {
          name: ing?.name ?? "—",
          unit: (ing?.unit ?? "g") as Ingredient["unit"],
        },
      }
    }
  )

  const titleDate = formatAuditDateTime(row.created_at)

  const statusBadge = isConfirmed ? (
    <Badge className="border-0 bg-green-600 text-white hover:bg-green-600/90">
      Подтверждена
    </Badge>
  ) : (
    <Badge
      variant="outline"
      className="border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100"
    >
      Черновик
    </Badge>
  )

  return (
    <div className="space-y-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <span className="text-muted-foreground">Склад</span>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/admin/inventory/audits">Инвентаризации</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{titleDate}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            Инвентаризация от {titleDate}
          </h1>
          {statusBadge}
        </div>
        {row.note ? (
          <p className="text-muted-foreground text-sm">{row.note}</p>
        ) : null}
      </header>

      {items.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Нет ингредиентов для инвентаризации.
        </p>
      ) : (
        <>
          <AuditItemsTable
            auditId={row.id}
            items={items}
            isConfirmed={isConfirmed}
          />
          {!isConfirmed && (
            <AuditConfirmFooter auditId={row.id} items={items} />
          )}
        </>
      )}
    </div>
  )
}
