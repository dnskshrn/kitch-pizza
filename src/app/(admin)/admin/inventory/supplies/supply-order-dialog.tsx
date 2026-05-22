"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import type { Ingredient, Supplier } from "@/types/database"
import {
  displayUnit,
  toDisplayPrice,
  toDisplayQty,
  toStoragePrice,
  toStorageQty,
} from "@/lib/inventory-units"
import { useRouter } from "next/navigation"
import { createSupplyOrder, annulSupplyOrder } from "./actions"
import { IngredientCombobox } from "./ingredient-combobox"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

function round4(value: number): number {
  return Math.round(value * 10000) / 10000
}

function todayLocalISODate(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function parseDecimal(s: string): number | null {
  const t = (s ?? "").trim().replace(",", ".")
  if (t === "") return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

function formatMdl(value: number): string {
  return value.toLocaleString("ro-MD", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  })
}

function formatDecimalInput(value: number): string {
  return Number.isFinite(value) ? String(round4(value)) : ""
}

function priceBaseFromWithVat(priceWithVat: string, vat: string): string {
  const parsedPriceWithVat = parseDecimal(priceWithVat)
  if (parsedPriceWithVat == null) return ""
  const parsedVat = parseDecimal(vat) ?? 0
  return formatDecimalInput(parsedPriceWithVat / (1 + parsedVat / 100))
}

function effectiveDisplayQty(row: EditableRow): number | null {
  return parseDecimal(row.quantityStr)
}

function recalcRow(row: EditableRow): EditableRow {
  const qty = effectiveDisplayQty(row)
  const vat = parseDecimal(row.vatStr) ?? 0
  const vatFactor = 1 + vat / 100

  if (qty == null || qty <= 0) {
    const price = parseDecimal(row.priceStr)
    const priceWithVat =
      parseDecimal(row.priceWithVatStr) ??
      (price != null ? round4(price * vatFactor) : null)
    return {
      ...row,
      priceWithVatStr:
        row.priceAnchor === "unit_ex" && price != null
          ? formatDecimalInput(priceWithVat ?? 0)
          : row.priceWithVatStr,
      priceStr:
        row.priceAnchor === "unit_inc" && priceWithVat != null
          ? priceBaseFromWithVat(row.priceWithVatStr, row.vatStr)
          : row.priceStr,
    }
  }

  switch (row.priceAnchor) {
    case "unit_inc": {
      const priceWithVat = parseDecimal(row.priceWithVatStr)
      if (priceWithVat == null) return row
      const price = round4(priceWithVat / vatFactor)
      const lineEx = round4(qty * price)
      const lineInc = round4(qty * priceWithVat)
      return {
        ...row,
        priceStr: formatDecimalInput(price),
        lineTotalExStr: formatDecimalInput(lineEx),
        lineTotalIncStr: formatDecimalInput(lineInc),
      }
    }
    case "line_ex": {
      const lineEx = parseDecimal(row.lineTotalExStr)
      if (lineEx == null) return row
      const price = round4(lineEx / qty)
      const priceWithVat = round4(price * vatFactor)
      const lineInc = round4(qty * priceWithVat)
      return {
        ...row,
        priceStr: formatDecimalInput(price),
        priceWithVatStr: formatDecimalInput(priceWithVat),
        lineTotalIncStr: formatDecimalInput(lineInc),
      }
    }
    case "line_inc": {
      const lineInc = parseDecimal(row.lineTotalIncStr)
      if (lineInc == null) return row
      const priceWithVat = round4(lineInc / qty)
      const price = round4(priceWithVat / vatFactor)
      const lineEx = round4(qty * price)
      return {
        ...row,
        priceStr: formatDecimalInput(price),
        priceWithVatStr: formatDecimalInput(priceWithVat),
        lineTotalExStr: formatDecimalInput(lineEx),
      }
    }
    case "unit_ex":
    default: {
      const price = parseDecimal(row.priceStr)
      if (price == null) return row
      const priceWithVat = round4(price * vatFactor)
      const lineEx = round4(qty * price)
      const lineInc = round4(qty * priceWithVat)
      return {
        ...row,
        priceWithVatStr: formatDecimalInput(priceWithVat),
        lineTotalExStr: formatDecimalInput(lineEx),
        lineTotalIncStr: formatDecimalInput(lineInc),
      }
    }
  }
}

export type SupplyOrderViewModel = {
  id: string
  supplier_id: string
  delivery_date: string
  note: string | null
  annulled_at: string | null
  total_cost_ex_vat: number | null
  total_cost_inc_vat: number | null
  items: {
    id: string
    ingredient_id: string
    quantity: number
    received_qty: number | null
    price_per_unit: number
    vat_rate: number
    price_per_unit_with_vat: number
    ingredient: { name: string; unit: Ingredient["unit"] }
  }[]
}

export type SupplyOrderDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: "create" | "view"
  order: SupplyOrderViewModel | null
  suppliers: Supplier[]
  ingredients: Ingredient[]
  supplierNameById?: Record<string, string>
}

type PriceAnchor = "unit_ex" | "unit_inc" | "line_ex" | "line_inc"

type EditableRow = {
  localKey: string
  ingredient_id: string
  quantityStr: string
  priceStr: string
  priceWithVatStr: string
  vatStr: string
  lineTotalExStr: string
  lineTotalIncStr: string
  priceAnchor: PriceAnchor
}

function newLocalKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random()}`
}

const SUPPLY_ROW_INPUT_CLASS = "w-[132px]"

function emptyRow(): EditableRow {
  return {
    localKey: newLocalKey(),
    ingredient_id: "",
    quantityStr: "",
    priceStr: "",
    priceWithVatStr: "",
    vatStr: "20",
    lineTotalExStr: "",
    lineTotalIncStr: "",
    priceAnchor: "unit_ex",
  }
}

export function SupplyOrderDialog({
  open,
  onOpenChange,
  mode,
  order,
  suppliers,
  ingredients,
  supplierNameById = {},
}: SupplyOrderDialogProps) {
  const router = useRouter()
  const [supplierId, setSupplierId] = useState("")
  const [deliveryDate, setDeliveryDate] = useState(todayLocalISODate())
  const [note, setNote] = useState("")
  const [rows, setRows] = useState<EditableRow[]>([emptyRow()])
  const [pending, startTransition] = useTransition()
  const [annulPending, startAnnulTransition] = useTransition()

  const isAnnulled = mode === "view" && order?.annulled_at != null

  const activeSuppliers = useMemo(
    () => suppliers.filter((s) => s.is_active),
    [suppliers]
  )

  const ingredientComboboxItems = useMemo(
    () =>
      ingredients.map((i) => ({
        id: i.id,
        name: i.name,
        unit: displayUnit(i.unit),
      })),
    [ingredients]
  )

  useEffect(() => {
    if (!open) return
    if (mode === "view" && order) {
      setSupplierId(order.supplier_id)
      setDeliveryDate(order.delivery_date.slice(0, 10))
      setNote(order.note ?? "")
      setRows(
        order.items.map((it) => {
          const billingQtyDisplay = toDisplayQty(it.quantity, it.ingredient.unit)
          const priceExDisplay = toDisplayPrice(it.price_per_unit, it.ingredient.unit)
          const priceIncDisplay = toDisplayPrice(
            it.price_per_unit_with_vat,
            it.ingredient.unit,
          )
          const lineEx = round4(billingQtyDisplay * priceExDisplay)
          const lineInc = round4(billingQtyDisplay * priceIncDisplay)
          return {
            localKey: it.id,
            ingredient_id: it.ingredient_id,
            quantityStr: String(billingQtyDisplay),
            priceStr: String(priceExDisplay),
            priceWithVatStr: String(priceIncDisplay),
            vatStr: String(it.vat_rate),
            lineTotalExStr: formatDecimalInput(lineEx),
            lineTotalIncStr: formatDecimalInput(lineInc),
            priceAnchor: "unit_ex" as const,
          }
        }),
      )
      return
    }
    setSupplierId("")
    setDeliveryDate(todayLocalISODate())
    setNote("")
    setRows([emptyRow()])
  }, [open, mode, order])

  const computedRows = useMemo(() => {
    return rows.map((r) => {
      const billingQty = effectiveDisplayQty(r) ?? 0
      const price = parseDecimal(r.priceStr) ?? 0
      const vat = parseDecimal(r.vatStr) ?? 0
      const priceWithVat =
        parseDecimal(r.priceWithVatStr) ?? round4(price * (1 + vat / 100))
      const lineEx = parseDecimal(r.lineTotalExStr) ?? round4(billingQty * price)
      const lineInc =
        parseDecimal(r.lineTotalIncStr) ?? round4(billingQty * priceWithVat)
      return { ...r, billingQty, price, vat, priceWithVat, lineEx, lineInc }
    })
  }, [rows])

  const footerTotals = useMemo(() => {
    return computedRows.reduce(
      (acc, r) => ({
        ex: acc.ex + r.lineEx,
        inc: acc.inc + r.lineInc,
      }),
      { ex: 0, inc: 0 }
    )
  }, [computedRows])

  const showFooterLive = mode === "create"

  function addRow() {
    setRows((prev) => [...prev, emptyRow()])
  }

  function removeRow(key: string) {
    setRows((prev) => {
      if (prev.length <= 1) return prev
      return prev.filter((r) => r.localKey !== key)
    })
  }

  function patchRow(key: string, patch: Partial<EditableRow>) {
    setRows((prev) =>
      prev.map((r) => (r.localKey === key ? recalcRow({ ...r, ...patch }) : r)),
    )
  }

  function updateBasePrice(key: string, priceStr: string) {
    setRows((prev) =>
      prev.map((r) =>
        r.localKey === key
          ? recalcRow({ ...r, priceStr, priceAnchor: "unit_ex" })
          : r,
      ),
    )
  }

  function updatePriceWithVat(key: string, priceWithVatStr: string) {
    setRows((prev) =>
      prev.map((r) =>
        r.localKey === key
          ? recalcRow({ ...r, priceWithVatStr, priceAnchor: "unit_inc" })
          : r,
      ),
    )
  }

  function updateLineTotalEx(key: string, lineTotalExStr: string) {
    setRows((prev) =>
      prev.map((r) =>
        r.localKey === key
          ? recalcRow({ ...r, lineTotalExStr, priceAnchor: "line_ex" })
          : r,
      ),
    )
  }

  function updateLineTotalInc(key: string, lineTotalIncStr: string) {
    setRows((prev) =>
      prev.map((r) =>
        r.localKey === key
          ? recalcRow({ ...r, lineTotalIncStr, priceAnchor: "line_inc" })
          : r,
      ),
    )
  }

  function updateVat(key: string, vatStr: string) {
    setRows((prev) =>
      prev.map((r) => {
        if (r.localKey !== key) return r
        const next = { ...r, vatStr }
        if (next.priceAnchor === "unit_inc" || next.priceAnchor === "line_inc") {
          return recalcRow(next)
        }
        if (next.priceAnchor === "line_ex" && next.lineTotalExStr.trim()) {
          return recalcRow(next)
        }
        return recalcRow({ ...next, priceAnchor: "unit_ex" })
      }),
    )
  }

  function updateQuantity(key: string, quantityStr: string) {
    setRows((prev) =>
      prev.map((r) =>
        r.localKey === key ? recalcRow({ ...r, quantityStr }) : r,
      ),
    )
  }

  function handleSave() {
    if (mode !== "create") return
    const sid = (supplierId ?? "").trim()
    if (!sid) {
      alert("Выберите поставщика")
      return
    }

    const payloadItems: {
      ingredient_id: string
      quantity: number
      price_per_unit: number
      vat_rate: number
    }[] = []

    for (const r of computedRows) {
      if (!r.ingredient_id.trim()) continue
      if (r.billingQty <= 0) {
        alert("Укажите количество больше нуля во всех заполненных строках")
        return
      }
      if (r.price < 0) {
        alert("Цена без НДС не может быть отрицательной")
        return
      }
      const ing = ingredients.find((i) => i.id === r.ingredient_id.trim())
      if (!ing) {
        alert("Не найден ингредиент")
        return
      }
      payloadItems.push({
        ingredient_id: r.ingredient_id.trim(),
        quantity: toStorageQty(r.billingQty, ing.unit),
        price_per_unit: toStoragePrice(r.price, ing.unit),
        vat_rate: r.vat,
      })
    }

    if (payloadItems.length === 0) {
      alert("Добавьте хотя бы одну позицию с ингредиентом")
      return
    }

    startTransition(async () => {
      try {
        await createSupplyOrder({
          supplier_id: sid,
          delivery_date: deliveryDate,
          note: (note ?? "").trim() || null,
          items: payloadItems,
        })
        onOpenChange(false)
      } catch (e) {
        console.error(e)
        alert(e instanceof Error ? e.message : "Ошибка сохранения")
      }
    })
  }

  function handleAnnul() {
    if (!order || isAnnulled) return
    const ok = window.confirm(
      "Аннулировать поставку? Остатки будут уменьшены на полученные количества. Запись останется в списке как аннулированная.",
    )
    if (!ok) return

    startAnnulTransition(async () => {
      try {
        await annulSupplyOrder(order.id)
        onOpenChange(false)
        router.refresh()
      } catch (e) {
        alert(e instanceof Error ? e.message : "Не удалось аннулировать поставку")
      }
    })
  }

  const viewSupplierLabel =
    mode === "view" && order
      ? supplierNameById[order.supplier_id] ?? "—"
      : null

  const title =
    mode === "create"
      ? "Новая поставка"
      : `Поставка от ${order ? order.delivery_date.slice(0, 10) : ""}`

  const readOnly = mode === "view"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] !w-[calc(100vw-16px)] !max-w-[1280px] flex-col gap-0 overflow-hidden p-0 sm:!max-w-[calc(100vw-32px)] xl:!w-[1280px] xl:!max-w-[1280px]">
        <DialogHeader className="border-b px-6 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <DialogTitle>{title}</DialogTitle>
            {isAnnulled ? (
              <Badge
                variant="secondary"
                className="bg-zinc-200 text-zinc-700 hover:bg-zinc-200"
              >
                Аннулирована
              </Badge>
            ) : null}
          </div>
        </DialogHeader>

        <div
          className={cn(
            "min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6",
            isAnnulled && "opacity-80",
          )}
        >
          <div className="mb-4 grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Поставщик</Label>
              {readOnly ? (
                <p className="text-sm">{viewSupplierLabel}</p>
              ) : (
                <Select value={supplierId} onValueChange={setSupplierId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Выберите поставщика" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeSuppliers.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="supply-delivery-date">Дата поставки</Label>
              {readOnly ? (
                <p className="text-sm">{deliveryDate}</p>
              ) : (
                <Input
                  id="supply-delivery-date"
                  type="date"
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                />
              )}
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="supply-note">Примечание</Label>
              {readOnly ? (
                <p className="text-sm whitespace-pre-wrap">
                  {note.trim() ? note : "—"}
                </p>
              ) : (
                <Textarea
                  id="supply-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  placeholder="Необязательно"
                />
              )}
            </div>
          </div>

          <div className="mb-2 flex items-center justify-between">
            <Label className="text-base">Позиции</Label>
            {!readOnly && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addRow}
              >
                Добавить позицию
              </Button>
            )}
          </div>

          <div className="overflow-x-auto rounded-md border">
            <Table className="min-w-[1220px] table-fixed">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[240px]">Ингредиент</TableHead>
                  <TableHead className="w-[148px]">Количество</TableHead>
                  <TableHead className="w-[148px]">
                    Цена за кг / л / шт (без НДС)
                  </TableHead>
                  <TableHead className="w-[148px]">НДС %</TableHead>
                  <TableHead className="w-[148px]">С НДС / ед.</TableHead>
                  <TableHead className="w-[148px]">Итого без НДС</TableHead>
                  <TableHead className="w-[148px]">Итого с НДС</TableHead>
                  {!readOnly && <TableHead className="w-12" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {computedRows.map((r, idx) => {
                  const ing = ingredients.find((i) => i.id === r.ingredient_id)
                  const viewItem = readOnly && order ? order.items[idx] : null
                  const displayName =
                    viewItem != null ? viewItem.ingredient.name : ing?.name
                  const ingUnit =
                    viewItem != null
                      ? viewItem.ingredient.unit
                      : ing?.unit
                  const displayUnitSfx = ingUnit ? displayUnit(ingUnit) : ""

                  return (
                    <TableRow key={r.localKey}>
                      <TableCell>
                        {readOnly ? (
                          <span className="text-sm">
                            {displayName
                              ? `${displayName} (${displayUnitSfx})`
                              : "—"}
                          </span>
                        ) : (
                          <IngredientCombobox
                            value={r.ingredient_id}
                            onChange={(v) =>
                              patchRow(r.localKey, { ingredient_id: v })
                            }
                            ingredients={ingredientComboboxItems}
                          />
                        )}
                      </TableCell>
                      <TableCell>
                        {readOnly ? (
                          <span className="text-sm">
                            {r.quantityStr}
                            {displayUnitSfx ? ` ${displayUnitSfx}` : ""}
                          </span>
                        ) : (
                          <div className={cn("relative", SUPPLY_ROW_INPUT_CLASS)}>
                            <Input
                              className="w-full pr-8"
                              inputMode="decimal"
                              value={r.quantityStr}
                              onChange={(e) =>
                                updateQuantity(r.localKey, e.target.value)
                              }
                            />
                            <span className="text-muted-foreground pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-xs">
                              {ing ? displayUnit(ing.unit) : ""}
                            </span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {readOnly ? (
                          <span className="text-sm">{r.priceStr}</span>
                        ) : (
                          <Input
                            className={SUPPLY_ROW_INPUT_CLASS}
                            inputMode="decimal"
                            value={r.priceStr}
                            onChange={(e) => updateBasePrice(r.localKey, e.target.value)}
                          />
                        )}
                      </TableCell>
                      <TableCell>
                        {readOnly ? (
                          <span className="text-sm">{r.vatStr}</span>
                        ) : (
                          <Input
                            className={SUPPLY_ROW_INPUT_CLASS}
                            inputMode="decimal"
                            value={r.vatStr}
                            onChange={(e) => updateVat(r.localKey, e.target.value)}
                          />
                        )}
                      </TableCell>
                      <TableCell>
                        {readOnly ? (
                          <span className="text-muted-foreground text-sm">
                            {formatMdl(
                              viewItem != null
                                ? toDisplayPrice(
                                    viewItem.price_per_unit_with_vat,
                                    viewItem.ingredient.unit
                                  )
                                : r.priceWithVat
                            )}
                          </span>
                        ) : (
                          <Input
                            className={SUPPLY_ROW_INPUT_CLASS}
                            inputMode="decimal"
                            value={r.priceWithVatStr}
                            onChange={(e) =>
                              updatePriceWithVat(r.localKey, e.target.value)
                            }
                          />
                        )}
                      </TableCell>
                      <TableCell>
                        {readOnly ? (
                          <span className="text-sm tabular-nums">
                            {formatMdl(r.lineEx)} лей
                          </span>
                        ) : (
                          <Input
                            className={SUPPLY_ROW_INPUT_CLASS}
                            inputMode="decimal"
                            value={r.lineTotalExStr}
                            onChange={(e) =>
                              updateLineTotalEx(r.localKey, e.target.value)
                            }
                          />
                        )}
                      </TableCell>
                      <TableCell>
                        {readOnly ? (
                          <span className="text-sm tabular-nums">
                            {formatMdl(r.lineInc)} лей
                          </span>
                        ) : (
                          <Input
                            className={SUPPLY_ROW_INPUT_CLASS}
                            inputMode="decimal"
                            value={r.lineTotalIncStr}
                            onChange={(e) =>
                              updateLineTotalInc(r.localKey, e.target.value)
                            }
                          />
                        )}
                      </TableCell>
                      {!readOnly && (
                        <TableCell className="text-right">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Удалить строку"
                            onClick={() => removeRow(r.localKey)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>

          <div className="mt-4 flex flex-wrap justify-end gap-6 text-sm">
            <div>
              <span className="text-muted-foreground">Итого без НДС: </span>
              <span className="font-medium tabular-nums">
                {formatMdl(
                  showFooterLive
                    ? footerTotals.ex
                    : (order?.total_cost_ex_vat ?? 0)
                )}{" "}
                лей
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Итого с НДС: </span>
              <span className="font-medium tabular-nums">
                {formatMdl(
                  showFooterLive
                    ? footerTotals.inc
                    : (order?.total_cost_inc_vat ?? 0)
                )}{" "}
                лей
              </span>
            </div>
          </div>
        </div>

        <DialogFooter
          className={cn(
            "border-t px-6 py-4",
            readOnly ? "sm:justify-between" : "sm:justify-end",
          )}
        >
          {readOnly ? (
            <>
              {!isAnnulled ? (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleAnnul}
                  disabled={annulPending}
                >
                  {annulPending ? "Аннулирование…" : "Аннулировать поставку"}
                </Button>
              ) : (
                <span className="text-muted-foreground text-sm">
                  Поставка аннулирована
                  {order?.annulled_at
                    ? ` · ${order.annulled_at.slice(0, 16).replace("T", " ")}`
                    : ""}
                </span>
              )}
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Закрыть
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Отмена
              </Button>
              <Button onClick={handleSave} disabled={pending}>
                {pending ? "Сохранение..." : "Сохранить"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
