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
import type { IngredientSelectOption, SemiFinishedWithItems } from "./types"
import { InventorySearch } from "@/components/admin/inventory-search"
import { SemiFinishedDialog } from "./semi-finished-dialog"
import { displayUnit, toDisplayQty } from "@/lib/inventory-units"

function formatComposition(
  items: SemiFinishedWithItems["semi_finished_items"]
): string {
  if (!items.length) return "—"
  const parts = items.map((it) => {
    const name = it.ingredients?.name ?? "?"
    const u = it.ingredients?.unit
      ? displayUnit(it.ingredients.unit)
      : ""
    const qDisp = it.ingredients?.unit
      ? toDisplayQty(Number(it.quantity), it.ingredients.unit)
      : String(it.quantity)
    return `${name} (${qDisp} ${u})`.trim()
  })
  return parts.join(", ")
}

export function SemiFinishedTable({
  rows,
  ingredientOptions,
}: {
  rows: SemiFinishedWithItems[]
  ingredientOptions: IngredientSelectOption[]
}) {
  const [createOpen, setCreateOpen] = useState(false)
  const [editRow, setEditRow] = useState<SemiFinishedWithItems | null>(null)
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

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Название</TableHead>
            <TableHead>Выход</TableHead>
            <TableHead>Состав</TableHead>
            <TableHead className="w-28 text-right">Действия</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={4}
                className="text-muted-foreground text-center"
              >
                Пока нет полуфабрикатов
              </TableCell>
            </TableRow>
          ) : filteredRows.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={4}
                className="text-muted-foreground text-center"
              >
                Ничего не найдено
              </TableCell>
            </TableRow>
          ) : (
            filteredRows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">{row.name}</TableCell>
                <TableCell className="text-muted-foreground tabular-nums">
                  {new Intl.NumberFormat("ro-MD", {
                    maximumFractionDigits: 4,
                  }).format(toDisplayQty(row.yield_qty, row.yield_unit))}{" "}
                  {displayUnit(row.yield_unit)}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {formatComposition(row.semi_finished_items)}
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
            ))
          )}
        </TableBody>
      </Table>

      <SemiFinishedDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        mode="create"
        semiFinished={null}
        ingredientOptions={ingredientOptions}
      />
      <SemiFinishedDialog
        open={!!editRow}
        onOpenChange={(o) => !o && setEditRow(null)}
        mode="edit"
        semiFinished={editRow}
        ingredientOptions={ingredientOptions}
      />
    </>
  )
}
