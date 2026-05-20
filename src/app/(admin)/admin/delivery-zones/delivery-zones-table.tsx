"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { DeliveryZoneWithSchedules } from "./page"
import {
  formatScheduleSlotSummary,
  sortSchedules,
} from "./zone-schedule-utils"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Moon, Pencil, Plus, Trash2 } from "lucide-react"
import { DeleteZoneDialog } from "./delete-zone-dialog"
import { ZoneDialog } from "./zone-dialog"

const FALLBACK_ZONE_COLOR = "#5F7600"

function formatLei(bani: number): string {
  return (bani / 100).toLocaleString("ro-MD", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
}

function ScheduleSlotsBadge({
  schedules,
}: {
  schedules: DeliveryZoneWithSchedules["delivery_zone_schedules"]
}) {
  const sorted = sortSchedules(schedules ?? [])
  if (sorted.length === 0) return null

  const label =
    sorted.length === 1
      ? "1 слот"
      : `${sorted.length} слотов`

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          variant="secondary"
          className="cursor-default font-normal"
          tabIndex={0}
        >
          {label}
        </Badge>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-sm">
        <ul className="grid gap-1">
          {sorted.map((s) => (
            <li key={s.id}>{formatScheduleSlotSummary(s)}</li>
          ))}
        </ul>
      </TooltipContent>
    </Tooltip>
  )
}

export function DeliveryZonesTable({ zones }: { zones: DeliveryZoneWithSchedules[] }) {
  const [createOpen, setCreateOpen] = useState(false)
  const [editZone, setEditZone] = useState<DeliveryZoneWithSchedules | null>(null)
  const [deleteZone, setDeleteZone] = useState<DeliveryZoneWithSchedules | null>(null)

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Зоны доставки</h1>
        <Button className="gap-2" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          Добавить зону
        </Button>
      </div>

      <TooltipProvider>
      <div className="grid gap-8 lg:grid-cols-[1fr_minmax(0,420px)]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Название</TableHead>
              <TableHead className="w-28">Цвет</TableHead>
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
                <TableCell className="font-medium">
                  <span className="inline-flex flex-wrap items-center gap-2">
                    {z.name}
                    <ScheduleSlotsBadge schedules={z.delivery_zone_schedules} />
                  </span>
                </TableCell>
                <TableCell>
                  <span className="inline-flex items-center gap-2">
                    <span
                      className="size-4 rounded-full border border-border"
                      style={{ backgroundColor: z.color || FALLBACK_ZONE_COLOR }}
                      aria-hidden
                    />
                    <span className="font-mono text-xs uppercase text-muted-foreground">
                      {z.color || FALLBACK_ZONE_COLOR}
                    </span>
                  </span>
                </TableCell>
                <TableCell>
                  <span className="inline-flex flex-wrap items-center gap-1.5">
                    <span>{formatLei(z.delivery_price_bani)} MDL</span>
                    {z.night_delivery_price_bani != null ? (
                      <>
                        <span className="text-muted-foreground">/</span>
                        <Moon
                          className="size-3.5 shrink-0 text-muted-foreground"
                          aria-hidden
                        />
                        <span>{formatLei(z.night_delivery_price_bani)} MDL</span>
                      </>
                    ) : null}
                  </span>
                </TableCell>
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
      </TooltipProvider>

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
