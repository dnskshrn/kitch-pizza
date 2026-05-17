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

type ListRow = {
  id: string
  phone: string | null
  name: string | null
  order_count: number
  ltv: number
  bonus_balance: number
  first_order_at: string | null
  last_order_at: string | null
}

function formatDateDdMmYyyy(raw: string | null): string {
  if (raw == null || raw === "") return "—"
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

function formatLtvMdlFromBani(bani: number): string {
  if (!Number.isFinite(bani)) return "—"
  const lei = bani / 100
  const formatted = lei.toLocaleString("ro-MD", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return `${formatted} MDL`
}

export function AdminCustomersTable({ rows }: { rows: ListRow[] }) {
  const router = useRouter()

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Телефон</TableHead>
            <TableHead>Имя</TableHead>
            <TableHead className="text-right">Заказов</TableHead>
            <TableHead className="text-right">LTV (MDL)</TableHead>
            <TableHead className="text-right">Бонусов</TableHead>
            <TableHead>Первый заказ</TableHead>
            <TableHead>Последний заказ</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow
              key={row.id}
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => router.push(`/admin/customers/${row.id}`)}
            >
              <TableCell className="font-mono tabular-nums">
                {row.phone ?? "—"}
              </TableCell>
              <TableCell>
                {row.name != null && row.name.trim() !== "" ? row.name : "—"}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {row.order_count}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatLtvMdlFromBani(row.ltv)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {Number.isFinite(row.bonus_balance)
                  ? Math.round(row.bonus_balance)
                  : "—"}
              </TableCell>
              <TableCell className="tabular-nums">
                {formatDateDdMmYyyy(row.first_order_at)}
              </TableCell>
              <TableCell className="tabular-nums">
                {formatDateDdMmYyyy(row.last_order_at)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
