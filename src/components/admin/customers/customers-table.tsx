"use client"

import { useRouter } from "next/navigation"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { CustomerRow } from "@/types/customers"

type CustomersTableProps = {
  rows: CustomerRow[]
  loading: boolean
}

const dateFmt = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "short",
  year: "numeric",
})

function formatDate(raw: string | null): string {
  if (raw == null || raw === "") return "—"
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return "—"
  return dateFmt.format(d)
}

function formatMdl(bani: number): string {
  return (bani / 100).toLocaleString("ru-RU") + " MDL"
}

function TableSkeleton() {
  return (
    <>
      {Array.from({ length: 8 }).map((_, i) => (
        <TableRow key={i}>
          {Array.from({ length: 6 }).map((__, j) => (
            <TableCell key={j}>
              <Skeleton className="h-5 w-full max-w-[120px]" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  )
}

export function CustomersTable({ rows, loading }: CustomersTableProps) {
  const router = useRouter()

  if (!loading && rows.length === 0) {
    return (
      <p className="text-muted-foreground py-16 text-center text-sm">
        Клиенты не найдены
      </p>
    )
  }

  return (
    <TooltipProvider>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Клиент</TableHead>
              <TableHead>Зарегистрирован</TableHead>
              <TableHead className="text-right">Заказов</TableHead>
              <TableHead className="text-right">Потрачено</TableHead>
              <TableHead>Последний заказ</TableHead>
              <TableHead className="text-right">Бонусы</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableSkeleton />
            ) : (
              rows.map((row) => {
                const siteCount = row.site_orders_count
                const posterCount = row.poster_orders_count ?? 0
                return (
                  <TableRow
                    key={row.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => router.push(`/admin/customers/${row.id}`)}
                  >
                    <TableCell>
                      <div className="font-medium tabular-nums">{row.phone}</div>
                      {row.name != null && row.name.trim() !== "" ? (
                        <div className="text-muted-foreground text-xs">
                          {row.name}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {formatDate(row.created_at)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="cursor-default underline decoration-dotted underline-offset-2">
                            {row.total_orders_count}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          Сайт: {siteCount}, Poster: {posterCount}
                        </TooltipContent>
                      </Tooltip>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMdl(row.site_total_spend)}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {formatDate(row.last_order_at)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.bonus_balance > 0
                        ? `${row.bonus_balance} pts`
                        : "—"}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </TooltipProvider>
  )
}
