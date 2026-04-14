"use client"

import { useState } from "react"
import type { PromoCode } from "@/types/database"
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
import { Pencil, Plus, Trash2 } from "lucide-react"
import { DeletePromoCodeDialog } from "./delete-promo-code-dialog"
import { PromoCodeDialog } from "./promo-code-dialog"

function formatLei(bani: number): string {
  return (bani / 100).toLocaleString("ro-MD", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
}

function typeValueLabel(p: PromoCode): string {
  if (p.discount_type === "percent") {
    return `${p.discount_value}%`
  }
  return `${formatLei(p.discount_value)} лей`
}

function minOrderCell(p: PromoCode): string {
  if (p.min_order_bani == null) return "—"
  return `от ${formatLei(p.min_order_bani)} лей`
}

function usesCell(p: PromoCode): string {
  const max =
    p.max_uses == null ? "∞" : String(p.max_uses)
  return `${p.uses_count} / ${max}`
}

function validCell(p: PromoCode): string {
  if (!p.valid_from && !p.valid_until) return "Бессрочный"
  const fmt = (iso: string) =>
    new Date(iso).toLocaleString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  if (p.valid_from && p.valid_until) {
    return `${fmt(p.valid_from)} — ${fmt(p.valid_until)}`
  }
  if (p.valid_from) return `с ${fmt(p.valid_from)}`
  return `до ${fmt(p.valid_until!)}`
}

export function PromoCodesTable({ promoCodes }: { promoCodes: PromoCode[] }) {
  const [createOpen, setCreateOpen] = useState(false)
  const [editRow, setEditRow] = useState<PromoCode | null>(null)
  const [deleteRow, setDeleteRow] = useState<PromoCode | null>(null)

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Промокоды</h1>
        <Button className="gap-2" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          Добавить промокод
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Код</TableHead>
            <TableHead>Тип и значение</TableHead>
            <TableHead>Мин. заказ</TableHead>
            <TableHead>Использования</TableHead>
            <TableHead>Срок</TableHead>
            <TableHead>Статус</TableHead>
            <TableHead className="w-28 text-right">Действия</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {promoCodes.map((p) => (
            <TableRow key={p.id}>
              <TableCell className="font-mono uppercase">{p.code}</TableCell>
              <TableCell>{typeValueLabel(p)}</TableCell>
              <TableCell>{minOrderCell(p)}</TableCell>
              <TableCell>{usesCell(p)}</TableCell>
              <TableCell className="max-w-[220px] text-sm">
                {validCell(p)}
              </TableCell>
              <TableCell>
                {p.is_active ? (
                  <Badge>Активен</Badge>
                ) : (
                  <Badge variant="secondary">Неактивен</Badge>
                )}
              </TableCell>
              <TableCell className="text-right">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Редактировать"
                  onClick={() => setEditRow(p)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Удалить"
                  onClick={() => setDeleteRow(p)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <PromoCodeDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        mode="create"
        promo={null}
      />
      <PromoCodeDialog
        open={!!editRow}
        onOpenChange={(o) => !o && setEditRow(null)}
        mode="edit"
        promo={editRow}
      />
      <DeletePromoCodeDialog
        promo={deleteRow}
        open={!!deleteRow}
        onOpenChange={(o) => !o && setDeleteRow(null)}
      />
    </>
  )
}
