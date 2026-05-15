"use client"

import { useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Label } from "@/components/ui/label"
import {
  displayUnit,
  toDisplayPrice,
  toDisplayQty,
  type StorageUnit,
} from "@/lib/inventory-units"

export type StockLedgerListRow = {
  id: string
  created_at: string
  ingredient_id: string
  movement_type: string
  quantity_delta: number
  cost_per_unit: number | null
  note: string | null
  ingredient_name: string
  ingredient_unit: StorageUnit
}

type MovementFilter = "all" | "sale" | "supply" | "writeoff" | "audit"

const movementTypeLabel: Record<string, string> = {
  supply: "Поставка",
  sale: "Продажа",
  writeoff: "Списание",
  audit: "Инвентаризация",
  audit_adjustment: "Инвентаризация",
  manual: "Вручную",
}

function formatLedgerDateTime(iso: string | null | undefined): string {
  if (!iso) return "—"
  try {
    const d = new Date(iso)
    const pad = (n: number) => String(n).padStart(2, "0")
    return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
  } catch {
    return iso
  }
}

function formatQtyDisplay(n: number): string {
  if (!Number.isFinite(n)) return String(n)
  const s = Number.parseFloat(n.toFixed(6))
  if (Number.isInteger(s)) return String(s)
  return String(s)
}

function formatQuantityDelta(delta: number, unit: StorageUnit): string {
  if (!Number.isFinite(delta) || delta === 0) {
    const z = formatQtyDisplay(toDisplayQty(0, unit))
    return `0 ${displayUnit(unit)}`
  }
  const sign = delta > 0 ? "+" : "−"
  const absDisplay = toDisplayQty(Math.abs(delta), unit)
  return `${sign}${formatQtyDisplay(absDisplay)} ${displayUnit(unit)}`
}

function formatCostPerUnitMdl(
  costPerUnit: number | null,
  unit: StorageUnit,
): string {
  if (costPerUnit == null || !Number.isFinite(Number(costPerUnit))) return "—"
  const display = toDisplayPrice(Number(costPerUnit), unit)
  if (!Number.isFinite(display)) return "—"
  return `${display.toFixed(4)} MDL/${displayUnit(unit)}`
}

function formatTotalMdl(
  quantityDelta: number,
  costPerUnit: number | null,
): string {
  if (costPerUnit == null || !Number.isFinite(Number(costPerUnit))) return "—"
  const total = Number(quantityDelta) * Number(costPerUnit)
  if (!Number.isFinite(total)) return "—"
  const sign = total < 0 ? "−" : ""
  return `${sign}${Math.abs(total).toFixed(2)} MDL`
}

function MovementTypeBadge({ type }: { type: string }) {
  const label = movementTypeLabel[type] ?? type
  switch (type) {
    case "sale":
      return (
        <Badge variant="destructive" className="shrink-0">
          {label}
        </Badge>
      )
    case "supply":
      return (
        <Badge
          className="shrink-0 border-0 bg-green-600 text-white hover:bg-green-600/90"
        >
          {label}
        </Badge>
      )
    case "writeoff":
      return (
        <Badge
          className="shrink-0 border-0 bg-orange-500 text-white hover:bg-orange-500/90"
        >
          {label}
        </Badge>
      )
    case "audit":
    case "audit_adjustment":
      return (
        <Badge
          className="shrink-0 border-0 bg-blue-600 text-white hover:bg-blue-600/90"
        >
          {label}
        </Badge>
      )
    default:
      return (
        <Badge variant="secondary" className="shrink-0">
          {label}
        </Badge>
      )
  }
}

type Props = {
  rows: StockLedgerListRow[]
}

export function LedgerTable({ rows }: Props) {
  const [movementFilter, setMovementFilter] = useState<MovementFilter>("all")

  const filtered = useMemo(() => {
    if (movementFilter === "all") return rows
    return rows.filter((r) => r.movement_type === movementFilter)
  }, [rows, movementFilter])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">История движений</h1>
          <p className="text-muted-foreground text-sm">
            Журнал складских операций (до 200 последних записей)
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-4">
        <div className="flex w-full min-w-0 flex-col gap-1.5 sm:w-[260px]">
          <Label className="text-muted-foreground text-xs">Тип движения</Label>
          <Select
            value={movementFilter}
            onValueChange={(v) => setMovementFilter(v as MovementFilter)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Все" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все</SelectItem>
              <SelectItem value="sale">Продажа</SelectItem>
              <SelectItem value="supply">Поставка</SelectItem>
              <SelectItem value="writeoff">Списание</SelectItem>
              <SelectItem value="audit">Аудит</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="whitespace-nowrap">Дата/время</TableHead>
              <TableHead>Ингредиент</TableHead>
              <TableHead className="whitespace-nowrap">Тип</TableHead>
              <TableHead className="text-right whitespace-nowrap">
                Изменение
              </TableHead>
              <TableHead className="text-right whitespace-nowrap">
                Себест. за ед.
              </TableHead>
              <TableHead className="text-right whitespace-nowrap">Итого</TableHead>
              <TableHead>Заметка</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-muted-foreground h-28 text-center"
                >
                  Нет данных о движениях
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="whitespace-nowrap text-muted-foreground text-sm tabular-nums">
                    {formatLedgerDateTime(row.created_at)}
                  </TableCell>
                  <TableCell className="font-medium">{row.ingredient_name}</TableCell>
                  <TableCell>
                    <MovementTypeBadge type={row.movement_type} />
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm tabular-nums">
                    {formatQuantityDelta(row.quantity_delta, row.ingredient_unit)}
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums text-muted-foreground">
                    {formatCostPerUnitMdl(row.cost_per_unit, row.ingredient_unit)}
                  </TableCell>
                  <TableCell className="text-right text-sm font-medium tabular-nums">
                    {formatTotalMdl(row.quantity_delta, row.cost_per_unit)}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate text-muted-foreground text-sm">
                    {row.note?.trim() ? row.note : "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
