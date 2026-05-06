"use client"

import { useMemo, useState } from "react"
import type { IngredientWithStock } from "@/types/database"
import { displayUnit, toDisplayPrice, toDisplayQty } from "@/lib/inventory-units"
import { InventorySearch } from "@/components/admin/inventory-search"
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
import { IngredientDialog } from "./ingredient-dialog"

function formatCostLei(cost: number): string {
  return new Intl.NumberFormat("ro-MD", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  }).format(cost)
}

function formatAvgLei(
  st: IngredientWithStock["ingredient_stock"],
  unit: IngredientWithStock["unit"]
): string {
  if (!st) return "—"
  const v = Number(st.avg_cost)
  if (!Number.isFinite(v) || v <= 0) return "—"
  const display = toDisplayPrice(v, unit)
  return `${formatCostLei(display)} MDL/${displayUnit(unit)}`
}

export function IngredientsTable({
  ingredients,
}: {
  ingredients: IngredientWithStock[]
}) {
  const [createOpen, setCreateOpen] = useState(false)
  const [editIngredient, setEditIngredient] = useState<IngredientWithStock | null>(
    null
  )
  const [search, setSearch] = useState("")

  const filteredIngredients = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return ingredients
    return ingredients.filter((row) =>
      row.name.toLowerCase().includes(q)
    )
  }, [ingredients, search])

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Ингредиенты</h1>
        <Button className="gap-2" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          Добавить ингредиент
        </Button>
      </div>

      <div className="mb-4 max-w-md">
        <InventorySearch
          value={search}
          onChange={setSearch}
          placeholder="Search ingredients…"
        />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Название</TableHead>
            <TableHead>Единица</TableHead>
            <TableHead>Средн. себестоимость</TableHead>
            <TableHead>Текущий остаток</TableHead>
            <TableHead className="w-28 text-right">Действия</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {ingredients.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={5}
                className="text-muted-foreground text-center"
              >
                Пока нет ингредиентов
              </TableCell>
            </TableRow>
          ) : filteredIngredients.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={5}
                className="text-muted-foreground text-center"
              >
                Ничего не найдено
              </TableCell>
            </TableRow>
          ) : (
            filteredIngredients.map((row) => {
              const stock = row.ingredient_stock
              const u = displayUnit(row.unit)
              const stockLabel =
                stock !== null && stock !== undefined
                  ? `${new Intl.NumberFormat("ro-MD", {
                      maximumFractionDigits: 4,
                    }).format(toDisplayQty(stock.quantity, row.unit))} ${u}`
                  : "—"
              return (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.name}</TableCell>
                  <TableCell className="text-muted-foreground">{u}</TableCell>
                  <TableCell className="text-muted-foreground tabular-nums">
                    {formatAvgLei(row.ingredient_stock, row.unit)}
                  </TableCell>
                  <TableCell className="text-muted-foreground tabular-nums">
                    {stockLabel}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Редактировать"
                      onClick={() => setEditIngredient(row)}
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

      <IngredientDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        mode="create"
        ingredient={null}
      />
      <IngredientDialog
        open={!!editIngredient}
        onOpenChange={(o) => !o && setEditIngredient(null)}
        mode="edit"
        ingredient={editIngredient}
      />
    </>
  )
}
