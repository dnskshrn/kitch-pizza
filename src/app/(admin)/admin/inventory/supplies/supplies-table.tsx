"use client"

import { useMemo, useState } from "react"
import type { Ingredient, Supplier } from "@/types/database"
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
import { Plus } from "lucide-react"
import {
  SupplyOrderDialog,
  type SupplyOrderViewModel,
} from "./supply-order-dialog"

function formatMdlTable(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(Number(value))) return "—"
  return Number(value).toLocaleString("ro-MD", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  })
}

type Props = {
  orders: SupplyOrderViewModel[]
  suppliers: Supplier[]
  ingredients: Ingredient[]
}

export function SuppliesTable({ orders, suppliers, ingredients }: Props) {
  const [createOpen, setCreateOpen] = useState(false)
  const [viewOrder, setViewOrder] = useState<SupplyOrderViewModel | null>(null)
  const [search, setSearch] = useState("")

  const supplierNameById = useMemo(() => {
    const m: Record<string, string> = {}
    for (const s of suppliers) {
      m[s.id] = s.name
    }
    return m
  }, [suppliers])

  const ingredientNameById = useMemo(() => {
    const m: Record<string, string> = {}
    for (const ing of ingredients) {
      m[ing.id] = ing.name
    }
    return m
  }, [ingredients])

  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return orders
    return orders.filter((o) => {
      const supplier = (
        supplierNameById[o.supplier_id] ?? ""
      ).toLowerCase()
      const note = (o.note ?? "").toLowerCase()
      const delivery = o.delivery_date.toLowerCase()
      const totals = [
        o.total_cost_ex_vat != null
          ? formatMdlTable(o.total_cost_ex_vat).toLowerCase()
          : "",
        o.total_cost_inc_vat != null
          ? formatMdlTable(o.total_cost_inc_vat).toLowerCase()
          : "",
      ].join(" ")
      const itemNames = o.items
        .map((it) =>
          (ingredientNameById[it.ingredient_id] ?? "").toLowerCase()
        )
        .join(" ")
      const haystack = [supplier, note, delivery, totals, itemNames].join(" ")
      return haystack.includes(q)
    })
  }, [orders, search, supplierNameById, ingredientNameById])

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Поставки</h1>
        <Button className="gap-2" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          Новая поставка
        </Button>
      </div>

      <div className="mb-4 max-w-md">
        <InventorySearch
          value={search}
          onChange={setSearch}
          placeholder="Search supply orders…"
        />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Дата поставки</TableHead>
            <TableHead>Поставщик</TableHead>
            <TableHead className="text-right">Кол-во позиций</TableHead>
            <TableHead className="text-right">Сумма без НДС</TableHead>
            <TableHead className="text-right">Сумма с НДС</TableHead>
            <TableHead className="w-28 text-right" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={6}
                className="text-muted-foreground text-center"
              >
                Пока нет поставок
              </TableCell>
            </TableRow>
          ) : filteredOrders.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={6}
                className="text-muted-foreground text-center"
              >
                Ничего не найдено
              </TableCell>
            </TableRow>
          ) : (
            filteredOrders.map((o) => (
              <TableRow key={o.id}>
                <TableCell className="font-medium">
                  {o.delivery_date.slice(0, 10)}
                </TableCell>
                <TableCell>
                  {supplierNameById[o.supplier_id] ?? "—"}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {o.items.length}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatMdlTable(o.total_cost_ex_vat)} лей
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatMdlTable(o.total_cost_inc_vat)} лей
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setViewOrder(o)}
                  >
                    Открыть
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <SupplyOrderDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        mode="create"
        order={null}
        suppliers={suppliers}
        ingredients={ingredients}
        supplierNameById={supplierNameById}
      />
      <SupplyOrderDialog
        open={!!viewOrder}
        onOpenChange={(open) => !open && setViewOrder(null)}
        mode="view"
        order={viewOrder}
        suppliers={suppliers}
        ingredients={ingredients}
        supplierNameById={supplierNameById}
      />
    </>
  )
}
