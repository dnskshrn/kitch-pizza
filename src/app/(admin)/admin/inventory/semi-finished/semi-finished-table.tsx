"use client"

import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Pencil, Plus } from "lucide-react"
import type {
  IngredientSelectOption,
  SemiFinishedListRow,
  SemiFinishedWithItems,
} from "./types"
import { InventorySearch } from "@/components/admin/inventory-search"
import { SemiFinishedDialog } from "./semi-finished-dialog"
import { displayUnit, toDisplayQty } from "@/lib/inventory-units"

function formatCostMdl(cost: number | null): string {
  if (cost == null || !Number.isFinite(cost) || cost <= 0) return "—"
  return `${cost.toFixed(2)} MDL`
}

function formatComposition(
  items: SemiFinishedWithItems["semi_finished_items"]
): string {
  if (!items.length) return "—"
  const parts = items.map((it) => {
    const isSemiRef = Boolean(it.semi_finished_ref_id)
    const name = isSemiRef
      ? (it.semi_finished_ref?.name ?? "?")
      : (it.ingredients?.name ?? "?")
    const unit = isSemiRef
      ? it.semi_finished_ref?.yield_unit
      : it.ingredients?.unit
    const u = unit ? displayUnit(unit) : ""
    const qDisp = unit
      ? toDisplayQty(Number(it.quantity), unit)
      : String(it.quantity)
    const prefix = isSemiRef ? "п/ф " : ""
    return `${prefix}${name} (${qDisp} ${u})`.trim()
  })
  return parts.join(", ")
}

export function SemiFinishedTable({
  rows,
  ingredientOptions,
  ingredientCostById,
}: {
  rows: SemiFinishedListRow[]
  ingredientOptions: IngredientSelectOption[]
  ingredientCostById: Record<string, number>
}) {
  const [createOpen, setCreateOpen] = useState(false)
  const [editRow, setEditRow] = useState<SemiFinishedListRow | null>(null)
  const [search, setSearch] = useState("")

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((row) => {
      const composition = formatComposition(row.semi_finished_items).toLowerCase()
      return (
        row.name.toLowerCase().includes(q) || composition.includes(q)
      )
    })
  }, [rows, search])

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Полуфабрикаты</h1>
        <Button className="gap-2" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          Добавить полуфабрикат
        </Button>
      </div>

      <div className="mb-4 max-w-md">
        <InventorySearch
          value={search}
          onChange={setSearch}
          placeholder="Search semi-finished items…"
        />
      </div>

      <Table className="table-fixed">
        <TableHeader>
          <TableRow>
            <TableHead>Название</TableHead>
            <TableHead className="w-36">Выход</TableHead>
            <TableHead className="w-32 text-right">Себест.</TableHead>
            <TableHead className="max-w-md w-80">Состав</TableHead>
            <TableHead className="w-28 text-right">Действия</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={5}
                className="text-muted-foreground text-center"
              >
                Пока нет полуфабрикатов
              </TableCell>
            </TableRow>
          ) : filteredRows.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={5}
                className="text-muted-foreground text-center"
              >
                Ничего не найдено
              </TableCell>
            </TableRow>
          ) : (
            filteredRows.map((row) => {
              const composition = formatComposition(row.semi_finished_items)
              const costPerUnit =
                row.costMdl != null && row.yield_qty > 0
                  ? row.costMdl / row.yield_qty
                  : null
              const costTitle =
                row.costMdl != null
                  ? `Всего: ${formatCostMdl(row.costMdl)}${
                      costPerUnit != null
                        ? ` · ${costPerUnit.toFixed(4)} MDL/${displayUnit(row.yield_unit)}`
                        : ""
                    }`
                  : undefined
              return (
              <TableRow key={row.id}>
                <TableCell className="font-medium">{row.name}</TableCell>
                <TableCell className="text-muted-foreground tabular-nums">
                  {new Intl.NumberFormat("ro-MD", {
                    maximumFractionDigits: 4,
                  }).format(toDisplayQty(row.yield_qty, row.yield_unit))}{" "}
                  {displayUnit(row.yield_unit)}
                </TableCell>
                <TableCell
                  className="text-right text-sm tabular-nums"
                  title={costTitle}
                >
                  {formatCostMdl(row.costMdl)}
                </TableCell>
                <TableCell
                  className="max-w-md text-muted-foreground text-sm"
                  title={composition}
                >
                  <span className="block truncate">{composition}</span>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Редактировать"
                    onClick={() => setEditRow(row)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
              )
            })
          )}
        </TableBody>
      </Table>

      <SemiFinishedDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        mode="create"
        semiFinished={null}
        ingredientOptions={ingredientOptions}
        ingredientCostById={ingredientCostById}
        semiFinishedCatalog={rows}
      />
      <SemiFinishedDialog
        open={!!editRow}
        onOpenChange={(o) => !o && setEditRow(null)}
        mode="edit"
        semiFinished={editRow}
        ingredientOptions={ingredientOptions}
        ingredientCostById={ingredientCostById}
        semiFinishedCatalog={rows}
      />
    </>
  )
}
