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
import { InventorySearch } from "@/components/admin/inventory-search"
import {
  TechCardDialog,
  type IngredientOption,
  type SemiFinishedOption,
} from "./tech-card-dialog"

export type TechCardTableRow = {
  key: string
  menuItemId: string
  variantId: string | null
  itemName: string
  variantLabel: string | null
  recipeCount: number
}

export function TechCardsTable({
  rows,
  ingredientOptions,
  semiFinishedOptions,
}: {
  rows: TechCardTableRow[]
  ingredientOptions: IngredientOption[]
  semiFinishedOptions: SemiFinishedOption[]
}) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<TechCardTableRow | null>(null)
  const [search, setSearch] = useState("")

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) => {
      const variant = (r.variantLabel ?? "").toLowerCase()
      return (
        r.itemName.toLowerCase().includes(q) ||
        variant.includes(q)
      )
    })
  }, [rows, search])

  function openEdit(r: TechCardTableRow) {
    setEditing(r)
    setDialogOpen(true)
  }

  function handleDialogOpen(open: boolean) {
    setDialogOpen(open)
    if (!open) setEditing(null)
  }

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Техкарты</h1>
      </div>

      <div className="mb-4 max-w-md">
        <InventorySearch
          value={search}
          onChange={setSearch}
          placeholder="Search dishes and variants…"
        />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Название блюда</TableHead>
            <TableHead>Вариант</TableHead>
            <TableHead className="w-44 text-right tabular-nums">
              Кол-во компонентов в техкарте
            </TableHead>
            <TableHead className="w-[200px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="text-muted-foreground text-center">
                Нет активных позиций меню
              </TableCell>
            </TableRow>
          ) : filteredRows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="text-muted-foreground text-center">
                Ничего не найдено
              </TableCell>
            </TableRow>
          ) : (
            filteredRows.map((r) => (
              <TableRow key={r.key}>
                <TableCell className="font-medium">{r.itemName}</TableCell>
                <TableCell className="text-muted-foreground">
                  {r.variantLabel ?? "—"}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {r.recipeCount}
                </TableCell>
                <TableCell>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => openEdit(r)}
                  >
                    Редактировать техкарту
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {editing ? (
        <TechCardDialog
          key={`${editing.menuItemId}-${editing.variantId ?? "null"}`}
          open={dialogOpen}
          onOpenChange={handleDialogOpen}
          menuItemId={editing.menuItemId}
          variantId={editing.variantId}
          itemName={editing.itemName}
          variantName={editing.variantLabel}
          ingredientOptions={ingredientOptions}
          semiFinishedOptions={semiFinishedOptions}
        />
      ) : null}
    </>
  )
}
