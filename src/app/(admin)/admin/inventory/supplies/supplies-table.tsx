"use client"

import { format, parseISO } from "date-fns"
import { useMemo, useState, useTransition } from "react"
import { toast } from "sonner"
import type { Ingredient, Supplier } from "@/types/database"
import { PeriodFilter } from "@/components/admin/finances/period-filter"
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
import { Camera, Plus } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  toStoragePrice,
  toStorageQty,
  type StorageUnit,
} from "@/lib/inventory-units"
import { createSupplyOrder } from "./actions"
import {
  InvoiceOcrModal,
  type InvoiceOcrCompletePayload,
} from "./invoice-ocr-modal"
import { SupplyOrderDialog } from "./supply-order-dialog"
import type { SupplyOrderViewModel, SupplyPeriodTotals } from "./types"

const DEFAULT_OCR_VAT_RATE = 20

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
  dateFrom: string
  dateTo: string
  periodTotals: SupplyPeriodTotals
}

function formatPeriodLabel(dateFrom: string, dateTo: string): string {
  return `${format(parseISO(dateFrom), "dd.MM.yyyy")} – ${format(parseISO(dateTo), "dd.MM.yyyy")}`
}

export function SuppliesTable({
  orders,
  suppliers,
  ingredients,
  dateFrom,
  dateTo,
  periodTotals,
}: Props) {
  const [createOpen, setCreateOpen] = useState(false)
  const [ocrModalOpen, setOcrModalOpen] = useState(false)
  const [viewOrder, setViewOrder] = useState<SupplyOrderViewModel | null>(null)
  const [search, setSearch] = useState("")
  const [ocrPending, startOcrTransition] = useTransition()

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
      const delivery = (o.delivery_date ?? "").toLowerCase()
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

  const ocrSuppliers = useMemo(
    () => suppliers.map((s) => ({ id: s.id, name: s.name })),
    [suppliers]
  )

  const ocrIngredients = useMemo(
    () =>
      ingredients.map((i) => ({
        id: i.id,
        name: i.name,
        unit: i.unit,
      })),
    [ingredients]
  )

  function handleOcrComplete(payload: InvoiceOcrCompletePayload) {
    const supplierId = (payload.supplierId ?? payload.matched_supplier_id ?? "").trim()
    if (!supplierId) {
      toast.error("Выберите поставщика")
      return
    }

    const payloadItems: {
      ingredient_id: string
      quantity: number
      price_per_unit: number
      vat_rate: number
    }[] = []

    for (const item of payload.items) {
      if (!item.matched_ingredient_id) continue
      if (item.display_quantity <= 0) continue
      const unit = item.matched_ingredient_unit as StorageUnit | null
      if (unit !== "g" && unit !== "ml" && unit !== "pcs") continue

      const vatRate =
        Number.isFinite(Number(item.vat_rate)) && Number(item.vat_rate) >= 0
          ? Number(item.vat_rate)
          : DEFAULT_OCR_VAT_RATE

      payloadItems.push({
        ingredient_id: item.matched_ingredient_id,
        quantity: toStorageQty(item.display_quantity, unit),
        price_per_unit: toStoragePrice(item.unit_price, unit),
        vat_rate: vatRate,
      })
    }

    if (payloadItems.length === 0) return

    startOcrTransition(async () => {
      try {
        await createSupplyOrder({
          supplier_id: supplierId,
          delivery_date: payload.date ?? format(new Date(), "yyyy-MM-dd"),
          note: "Создано из фото накладной",
          items: payloadItems,
        })
        toast.success("Поставка создана")
        setOcrModalOpen(false)
        window.location.reload()
      } catch (e) {
        toast.error(
          e instanceof Error ? e.message : "Ошибка создания поставки"
        )
      }
    })
  }

  return (
    <>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Поставки</h1>
          <p className="text-muted-foreground text-sm">
            Период {formatPeriodLabel(dateFrom, dateTo)}
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            onClick={() => setOcrModalOpen(true)}
            disabled={ocrPending}
          >
            <Camera className="h-4 w-4" />
            Из фото
          </Button>
          <Button className="gap-2" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            Новая поставка
          </Button>
        </div>
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-md flex-1">
          <InventorySearch
            value={search}
            onChange={setSearch}
            placeholder="Поиск по поставщику, позициям…"
          />
        </div>
        <PeriodFilter dateFrom={dateFrom} dateTo={dateTo} />
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border bg-card px-4 py-3">
          <p className="text-muted-foreground text-xs">Активных поставок</p>
          <p className="mt-1 text-xl font-semibold tabular-nums">
            {periodTotals.orderCount}
          </p>
          {periodTotals.annulledCount > 0 ? (
            <p className="text-muted-foreground mt-1 text-xs">
              +{periodTotals.annulledCount} аннулированных (не в сумме)
            </p>
          ) : null}
        </div>
        <div className="rounded-lg border bg-card px-4 py-3">
          <p className="text-muted-foreground text-xs">Потрачено без НДС</p>
          <p className="mt-1 text-xl font-semibold tabular-nums">
            {formatMdlTable(periodTotals.totalExVat)} лей
          </p>
        </div>
        <div className="rounded-lg border bg-card px-4 py-3">
          <p className="text-muted-foreground text-xs">Потрачено с НДС</p>
          <p className="mt-1 text-xl font-semibold tabular-nums">
            {formatMdlTable(periodTotals.totalIncVat)} лей
          </p>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Дата поставки</TableHead>
            <TableHead>Поставщик</TableHead>
            <TableHead className="text-right">Кол-во позиций</TableHead>
            <TableHead className="text-right">Сумма без НДС</TableHead>
            <TableHead className="text-right">Сумма с НДС</TableHead>
            <TableHead className="w-[120px]">Статус</TableHead>
            <TableHead className="w-28 text-right" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={7}
                className="text-muted-foreground text-center"
              >
                Нет поставок за выбранный период
              </TableCell>
            </TableRow>
          ) : filteredOrders.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={7}
                className="text-muted-foreground text-center"
              >
                Ничего не найдено
              </TableCell>
            </TableRow>
          ) : (
            filteredOrders.map((o) => {
              const isAnnulled = o.annulled_at != null
              return (
              <TableRow
                key={o.id}
                className={cn(
                  isAnnulled && "bg-muted/50 text-muted-foreground",
                )}
              >
                <TableCell
                  className={cn("font-medium", isAnnulled && "line-through")}
                >
                  {(o.delivery_date ?? "").slice(0, 10) || "—"}
                </TableCell>
                <TableCell className={cn(isAnnulled && "line-through")}>
                  {supplierNameById[o.supplier_id] ?? "—"}
                </TableCell>
                <TableCell
                  className={cn(
                    "text-right tabular-nums",
                    isAnnulled && "line-through",
                  )}
                >
                  {o.items.length}
                </TableCell>
                <TableCell
                  className={cn(
                    "text-right tabular-nums",
                    isAnnulled && "line-through",
                  )}
                >
                  {formatMdlTable(o.total_cost_ex_vat)} лей
                </TableCell>
                <TableCell
                  className={cn(
                    "text-right tabular-nums",
                    isAnnulled && "line-through",
                  )}
                >
                  {formatMdlTable(o.total_cost_inc_vat)} лей
                </TableCell>
                <TableCell>
                  {isAnnulled ? (
                    <Badge
                      variant="secondary"
                      className="bg-zinc-200 text-zinc-700 hover:bg-zinc-200"
                    >
                      Аннулирована
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground text-xs">Активна</span>
                  )}
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
            )})
          )}
        </TableBody>
      </Table>

      <InvoiceOcrModal
        open={ocrModalOpen}
        onOpenChange={setOcrModalOpen}
        suppliers={ocrSuppliers}
        ingredients={ocrIngredients}
        onComplete={handleOcrComplete}
      />

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
        mode={
          viewOrder
            ? viewOrder.annulled_at != null
              ? "view"
              : "edit"
            : "view"
        }
        order={viewOrder}
        suppliers={suppliers}
        ingredients={ingredients}
        supplierNameById={supplierNameById}
      />
    </>
  )
}
