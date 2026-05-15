"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { useFormStatus } from "react-dom"
import type { StockAudit } from "@/types/database"
import { createAudit } from "./actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { InventorySearch } from "@/components/admin/inventory-search"
import { Plus } from "lucide-react"

export type AuditListRow = StockAudit & {
  itemCount: number
  diffCostMdlTotal: number | null
}

function formatCreated(iso: string): string {
  try {
    return new Date(iso).toLocaleString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  } catch {
    return iso
  }
}

function NewAuditSubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" className="gap-2" disabled={pending}>
      <Plus className="h-4 w-4" />
      {pending ? "Создание…" : "Новая инвентаризация"}
    </Button>
  )
}

type Props = {
  audits: AuditListRow[]
}

function DiffCostMdlListCell({ total }: { total: number | null }) {
  if (total === null) {
    return <span className="text-muted-foreground">—</span>
  }
  if (!Number.isFinite(total)) {
    return <span className="text-muted-foreground">—</span>
  }
  if (total === 0) {
    return <span className="text-muted-foreground tabular-nums">0 MDL</span>
  }
  if (total > 0) {
    return (
      <span className="font-medium text-green-600 tabular-nums">
        +{total.toFixed(2)} MDL
      </span>
    )
  }
  return (
    <span className="font-medium text-red-600 tabular-nums">
      {total.toFixed(2)} MDL
    </span>
  )
}

export function AuditsTable({ audits }: Props) {
  const [search, setSearch] = useState("")

  const filteredAudits = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return audits
    return audits.filter((a) => {
      const note = (a.note ?? "").toLowerCase()
      const created = formatCreated(a.created_at).toLowerCase()
      const status =
        a.confirmed_at == null ? "черновик" : "подтверждена"
      const count = String(a.itemCount)
      const haystack = [note, created, status, count].join(" ")
      return haystack.includes(q)
    })
  }, [audits, search])

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Инвентаризации</h1>
        <form action={createAudit}>
          <NewAuditSubmitButton />
        </form>
      </div>

      <div className="mb-4 max-w-md">
        <InventorySearch
          value={search}
          onChange={setSearch}
          placeholder="Search audits by date, note, or status…"
        />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Дата создания</TableHead>
            <TableHead>Статус</TableHead>
            <TableHead className="text-right">Кол-во позиций</TableHead>
            <TableHead className="min-w-[11rem] text-right">
              Расхождение (MDL)
            </TableHead>
            <TableHead className="w-28 text-right" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {audits.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={5}
                className="text-muted-foreground text-center"
              >
                Пока нет инвентаризаций
              </TableCell>
            </TableRow>
          ) : filteredAudits.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={5}
                className="text-muted-foreground text-center"
              >
                Ничего не найдено
              </TableCell>
            </TableRow>
          ) : (
            filteredAudits.map((a) => (
              <TableRow key={a.id}>
                <TableCell className="font-medium">
                  {formatCreated(a.created_at)}
                </TableCell>
                <TableCell>
                  {a.confirmed_at == null ? (
                    <Badge className="border-amber-500 bg-amber-100 text-amber-950 hover:bg-amber-100">
                      Черновик
                    </Badge>
                  ) : (
                    <Badge className="border-green-600 bg-green-100 text-green-950 hover:bg-green-100">
                      Подтверждена
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {a.itemCount}
                </TableCell>
                <TableCell className="text-right">
                  <DiffCostMdlListCell total={a.diffCostMdlTotal} />
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/admin/inventory/audits/${a.id}`}>
                      Открыть
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </>
  )
}
