import Link from "next/link"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Plus } from "lucide-react"

export const dynamic = "force-dynamic"

const REASON_LABELS: Record<string, string> = {
  waste: "Отход",
  spoilage: "Порча",
  tasting: "Дегустация",
  staff_meal: "Питание персонала",
  other: "Другое",
}

function reasonLabel(reason: string | null | undefined): string {
  if (reason == null || reason === "") return "—"
  return REASON_LABELS[reason] ?? reason
}

function formatDateDdMmYyyy(raw: string): string {
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return raw
  return d.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

function formatNote(note: string | null | undefined): string {
  const t = note != null ? String(note).trim() : ""
  return t !== "" ? t : "—"
}

function formatTotalMdl(sum: number | null): string {
  if (sum == null || !Number.isFinite(sum)) return "—"
  const s = sum.toLocaleString("ro-MD", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return `${s} MDL`
}

type ItemRow = { total_cost?: number | string | null }

function aggregateItems(items: ItemRow[] | null | undefined): {
  count: number
  sum: number | null
} {
  if (items == null || items.length === 0) {
    return { count: 0, sum: null }
  }
  let total = 0
  let hasCost = false
  for (const it of items) {
    const raw = it.total_cost
    if (raw != null && raw !== "") {
      const n = Number(raw)
      if (Number.isFinite(n)) {
        total += n
        hasCost = true
      }
    }
  }
  return {
    count: items.length,
    sum: hasCost ? total : null,
  }
}

type RawWriteoffRow = {
  id: string
  date: string
  reason: string | null
  note: string | null
  stock_writeoff_items: ItemRow[] | null
}

export default async function AdminInventoryWriteoffsPage() {
  let supabase: ReturnType<typeof createServiceRoleClient>
  try {
    supabase = createServiceRoleClient()
  } catch (e) {
    return (
      <p className="text-destructive">
        Не удалось подключиться к базе:{" "}
        {e instanceof Error ? e.message : "ошибка конфигурации"}
      </p>
    )
  }

  const { data, error } = await supabase
    .from("stock_writeoffs")
    .select(
      `
      id,
      date,
      reason,
      note,
      stock_writeoff_items (
        total_cost
      )
    `
    )
    .order("date", { ascending: false })

  if (error) {
    return (
      <p className="text-destructive">
        Не удалось загрузить списания: {error.message}
      </p>
    )
  }

  const rows = (data ?? []) as unknown as RawWriteoffRow[]

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold">Списания</h1>
        <Button asChild className="gap-2 sm:shrink-0">
          <Link href="/admin/inventory/writeoffs/new">
            <Plus className="h-4 w-4" />
            Новое списание
          </Link>
        </Button>
      </div>

      {rows.length === 0 ? (
        <p className="text-muted-foreground py-12 text-center">
          Списаний пока нет
        </p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Дата</TableHead>
                <TableHead>Причина</TableHead>
                <TableHead>Заметка</TableHead>
                <TableHead className="text-right">Кол-во позиций</TableHead>
                <TableHead className="text-right">Сумма</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const { count, sum } = aggregateItems(
                  row.stock_writeoff_items
                )
                return (
                  <TableRow key={row.id}>
                    <TableCell className="tabular-nums">
                      {formatDateDdMmYyyy(row.date)}
                    </TableCell>
                    <TableCell>{reasonLabel(row.reason ?? undefined)}</TableCell>
                    <TableCell className="max-w-[280px] truncate">
                      {formatNote(row.note)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {count}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatTotalMdl(sum)}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  )
}
