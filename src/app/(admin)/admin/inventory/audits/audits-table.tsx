"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import type { StockAudit } from "@/types/database"
import { AuditDialog } from "./audit-dialog"
import { createAudit, getAuditDetail, type AuditDetail } from "./actions"
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

type Props = {
  audits: AuditListRow[]
}

export function AuditsTable({ audits }: Props) {
  const router = useRouter()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogDetail, setDialogDetail] = useState<AuditDetail | null>(null)
  const [pending, startTransition] = useTransition()
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

  function openAudit(detail: AuditDetail) {
    setDialogDetail(detail)
    setDialogOpen(true)
  }

  async function handleOpenById(id: string) {
    try {
      const d = await getAuditDetail(id)
      openAudit(d)
    } catch (e) {
      console.error(e)
      alert(e instanceof Error ? e.message : "Не удалось открыть")
    }
  }

  function handleNewAudit() {
    startTransition(async () => {
      try {
        const detail = await createAudit()
        openAudit(detail)
        router.refresh()
      } catch (e) {
        console.error(e)
        alert(e instanceof Error ? e.message : "Не удалось создать")
      }
    })
  }

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Инвентаризации</h1>
        <Button
          className="gap-2"
          onClick={handleNewAudit}
          disabled={pending}
        >
          <Plus className="h-4 w-4" />
          Новая инвентаризация
        </Button>
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
            <TableHead className="w-28 text-right" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {audits.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={4}
                className="text-muted-foreground text-center"
              >
                Пока нет инвентаризаций
              </TableCell>
            </TableRow>
          ) : filteredAudits.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={4}
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
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenById(a.id)}
                  >
                    Открыть
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <AuditDialog
        open={dialogOpen}
        onOpenChange={(o) => {
          setDialogOpen(o)
          if (!o) setDialogDetail(null)
        }}
        detail={dialogDetail}
      />
    </>
  )
}
