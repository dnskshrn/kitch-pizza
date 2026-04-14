"use client"

import { useState } from "react"
import type { DeliveryZone } from "@/types/database"
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
import { DeleteZoneDialog } from "./delete-zone-dialog"
import { ZoneDialog } from "./zone-dialog"

function formatLei(bani: number): string {
  return (bani / 100).toLocaleString("ro-MD", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
}

export function DeliveryZonesTable({ zones }: { zones: DeliveryZone[] }) {
  const [createOpen, setCreateOpen] = useState(false)
  const [editZone, setEditZone] = useState<DeliveryZone | null>(null)
  const [deleteZone, setDeleteZone] = useState<DeliveryZone | null>(null)

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Зоны доставки</h1>
        <Button className="gap-2" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          Добавить зону
        </Button>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_minmax(0,420px)]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Название</TableHead>
              <TableHead>Цена доставки</TableHead>
              <TableHead>Мин. заказ</TableHead>
              <TableHead>Бесплатно от</TableHead>
              <TableHead>Время</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead className="w-28 text-right">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {zones.map((z) => (
              <TableRow key={z.id}>
                <TableCell className="font-medium">{z.name}</TableCell>
                <TableCell>{formatLei(z.delivery_price_bani)} лей</TableCell>
                <TableCell>{formatLei(z.min_order_bani)} лей</TableCell>
                <TableCell>
                  {z.free_delivery_from_bani != null
                    ? `${formatLei(z.free_delivery_from_bani)} лей`
                    : "—"}
                </TableCell>
                <TableCell>{z.delivery_time_min} мин</TableCell>
                <TableCell>
                  {z.is_active ? (
                    <Badge>Активна</Badge>
                  ) : (
                    <Badge variant="secondary">Скрыта</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Редактировать"
                    onClick={() => setEditZone(z)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Удалить"
                    onClick={() => setDeleteZone(z)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ZoneDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        mode="create"
        zone={null}
        allZones={zones}
      />
      <ZoneDialog
        open={!!editZone}
        onOpenChange={(o) => !o && setEditZone(null)}
        mode="edit"
        zone={editZone}
        allZones={zones}
      />
      <DeleteZoneDialog
        zone={deleteZone}
        open={!!deleteZone}
        onOpenChange={(o) => !o && setDeleteZone(null)}
      />
    </>
  )
}
