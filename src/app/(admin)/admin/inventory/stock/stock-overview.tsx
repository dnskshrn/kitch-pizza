"use client"

import { useMemo, useState } from "react"
import type { IngredientWithStock } from "@/types/database"
import { displayUnit, toDisplayQty } from "@/lib/inventory-units"
import { InventorySearch } from "@/components/admin/inventory-search"
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

export type StockOverviewRow = IngredientWithStock & {
  costPerUnitLabel: string
}

type StockFilter = "all" | "in_stock" | "out_of_stock"

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—"
  try {
    return new Date(iso).toLocaleString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  } catch {
    return iso
  }
}

function formatQty(n: number): string {
  if (!Number.isFinite(n)) return String(n)
  if (Number.isInteger(n)) return String(n)
  return String(Number.parseFloat(n.toFixed(6)))
}

type Props = {
  rows: StockOverviewRow[]
  lastUpdatedGlobal: string | null
}

export function StockOverview({ rows, lastUpdatedGlobal }: Props) {
  const [filter, setFilter] = useState<StockFilter>("all")
  const [search, setSearch] = useState("")

  const summary = useMemo(() => {
    const total = rows.length
    const inStock = rows.filter(
      (r) => r.ingredient_stock != null && Number(r.ingredient_stock.quantity) > 0
    ).length
    const outOfStock = rows.filter(
      (r) =>
        r.ingredient_stock == null ||
        Number(r.ingredient_stock.quantity) === 0
    ).length
    return { total, inStock, outOfStock }
  }, [rows])

  const filteredByAvailability = useMemo(() => {
    if (filter === "all") return rows
    if (filter === "in_stock") {
      return rows.filter(
        (r) =>
          r.ingredient_stock != null &&
          Number(r.ingredient_stock.quantity) > 0
      )
    }
    return rows.filter(
      (r) =>
        r.ingredient_stock == null ||
        Number(r.ingredient_stock.quantity) === 0
    )
  }, [rows, filter])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return filteredByAvailability
    return filteredByAvailability.filter((r) =>
      r.name.toLowerCase().includes(q)
    )
  }, [filteredByAvailability, search])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Остатки на складе</h1>
          <p className="text-muted-foreground text-sm">
            Обновлено: {formatDateTime(lastUpdatedGlobal)}
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="bg-card rounded-lg border p-4">
          <p className="text-muted-foreground text-sm">Всего позиций</p>
          <p className="text-2xl font-semibold tabular-nums">{summary.total}</p>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <p className="text-muted-foreground text-sm">В наличии</p>
          <p className="text-2xl font-semibold tabular-nums text-green-600">
            {summary.inStock}
          </p>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <p className="text-muted-foreground text-sm">Нет в наличии</p>
          <p className="text-2xl font-semibold tabular-nums text-red-600">
            {summary.outOfStock}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["all", "Все"],
            ["in_stock", "В наличии"],
            ["out_of_stock", "Нет в наличии"],
          ] as const
        ).map(([key, label]) => (
          <Button
            key={key}
            type="button"
            variant={filter === key ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(key)}
          >
            {label}
          </Button>
        ))}
      </div>

      <div className="mb-4 max-w-md">
        <InventorySearch
          value={search}
          onChange={setSearch}
          placeholder="Search stock by ingredient name…"
        />
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ингредиент</TableHead>
              <TableHead className="w-28">Единица</TableHead>
              <TableHead className="min-w-[140px] text-right">
                Себестоимость / ед.
              </TableHead>
              <TableHead className="min-w-[200px]">Остаток</TableHead>
              <TableHead className="w-44">Последнее обновление</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-muted-foreground text-center"
                >
                  {search.trim() && filteredByAvailability.length > 0
                    ? "Ничего не найдено"
                    : "Нет позиций по выбранному фильтру"}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((row) => {
                const st = row.ingredient_stock
                const qtyStorage = st != null ? Number(st.quantity) : null
                const qtyDisplay =
                  qtyStorage != null
                    ? toDisplayQty(qtyStorage, row.unit)
                    : null
                const unitSfx = displayUnit(row.unit)

                return (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell>{unitSfx}</TableCell>
                    <TableCell className="text-right text-muted-foreground tabular-nums">
                      {row.costPerUnitLabel}
                    </TableCell>
                    <TableCell>
                      {st == null ? (
                        <span className="inline-flex flex-wrap items-center gap-2">
                          <span className="text-muted-foreground">—</span>
                          <Badge variant="secondary" className="text-xs">
                            Не отслеживается
                          </Badge>
                        </span>
                      ) : qtyDisplay !== null && qtyDisplay > 0 ? (
                        <span className="font-medium text-green-600 tabular-nums">
                          {formatQty(qtyDisplay)} {unitSfx}
                        </span>
                      ) : (
                        <span className="inline-flex flex-wrap items-center gap-2">
                          <span className="tabular-nums">0</span>
                          <Badge
                            variant="destructive"
                            className="text-xs font-normal"
                          >
                            Нет
                          </Badge>
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDateTime(st?.updated_at)}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
