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
import { createSupplyOrder } from "./actions"
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

function priceWithVatFromBase(price: string, vat: string): string {
  const parsedPrice = parseDecimal(price)
  if (parsedPrice == null) return ""
  const parsedVat = parseDecimal(vat) ?? 0
  return formatDecimalInput(parsedPrice * (1 + parsedVat / 100))
}

function priceBaseFromWithVat(priceWithVat: string, vat: string): string {
  const parsedPriceWithVat = parseDecimal(priceWithVat)
  if (parsedPriceWithVat == null) return ""
  const parsedVat = parseDecimal(vat) ?? 0
  return formatDecimalInput(parsedPriceWithVat / (1 + parsedVat / 100))
}

export type SupplyOrderViewModel = {
  id: string
  supplier_id: string
  delivery_date: string
  note: string | null
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

type EditableRow = {
  localKey: string
  ingredient_id: string
  quantityStr: string
  receivedQtyStr: string
  priceStr: string
  priceWithVatStr: string
  vatStr: string
}

function newLocalKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random()}`
}

function emptyRow(): EditableRow {
  return {
    localKey: newLocalKey(),
    ingredient_id: "",
    quantityStr: "",
    receivedQtyStr: "",
    priceStr: "",
    priceWithVatStr: "",
    vatStr: "20",
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
  const [supplierId, setSupplierId] = useState("")
  const [deliveryDate, setDeliveryDate] = useState(todayLocalISODate())
  const [note, setNote] = useState("")
  const [rows, setRows] = useState<EditableRow[]>([emptyRow()])
  const [pending, startTransition] = useTransition()

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
        order.items.map((it) => ({
          localKey: it.id,
          ingredient_id: it.ingredient_id,
          quantityStr: String(toDisplayQty(it.quantity, it.ingredient.unit)),
          receivedQtyStr:
            it.received_qty != null
              ? String(toDisplayQty(it.received_qty, it.ingredient.unit))
              : "",
          priceStr: String(toDisplayPrice(it.price_per_unit, it.ingredient.unit)),
          priceWithVatStr: String(
            toDisplayPrice(it.price_per_unit_with_vat, it.ingredient.unit),
          ),
          vatStr: String(it.vat_rate),
        }))
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
      const qty = parseDecimal(r.quantityStr) ?? 0
      const price = parseDecimal(r.priceStr) ?? 0
      const vat = parseDecimal(r.vatStr) ?? 0
      const priceWithVat =
        parseDecimal(r.priceWithVatStr) ?? round4(price * (1 + vat / 100))
      const lineEx = qty * price
      const lineInc = qty * priceWithVat
      return { ...r, qty, price, vat, priceWithVat, lineEx, lineInc }
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

  function updateRow(key: string, patch: Partial<EditableRow>) {
    setRows((prev) =>
      prev.map((r) => (r.localKey === key ? { ...r, ...patch } : r))
    )
  }

  function updateBasePrice(key: string, priceStr: string) {
    setRows((prev) =>
      prev.map((r) =>
        r.localKey === key
          ? {
              ...r,
              priceStr,
              priceWithVatStr: priceWithVatFromBase(priceStr, r.vatStr),
            }
          : r,
      ),
    )
  }

  function updatePriceWithVat(key: string, priceWithVatStr: string) {
    setRows((prev) =>
      prev.map((r) =>
        r.localKey === key
          ? {
              ...r,
              priceStr: priceBaseFromWithVat(priceWithVatStr, r.vatStr),
              priceWithVatStr,
            }
          : r,
      ),
    )
  }

  function updateVat(key: string, vatStr: string) {
    setRows((prev) =>
      prev.map((r) => {
        if (r.localKey !== key) return r
        if (r.priceWithVatStr.trim()) {
          return {
            ...r,
            vatStr,
            priceStr: priceBaseFromWithVat(r.priceWithVatStr, vatStr),
          }
        }
        return {
          ...r,
          vatStr,
          priceWithVatStr: priceWithVatFromBase(r.priceStr, vatStr),
        }
      }),
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
      received_qty: number | null
      price_per_unit: number
      vat_rate: number
    }[] = []

    for (const r of computedRows) {
      if (!r.ingredient_id.trim()) continue
      if (r.qty <= 0) {
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
      const receivedTrim = (r.receivedQtyStr ?? "").trim()
      let receivedStorage: number | null = null
      if (receivedTrim !== "") {
        const rq = parseDecimal(receivedTrim)
        if (rq == null || !Number.isFinite(rq) || rq < 0) {
          alert("Некорректное количество в поле «Получено»")
          return
        }
        receivedStorage = toStorageQty(rq, ing.unit)
      }
      payloadItems.push({
        ingredient_id: r.ingredient_id.trim(),
        quantity: toStorageQty(r.qty, ing.unit),
        received_qty: receivedStorage,
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
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
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
            <Table className="min-w-[1160px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[260px]">Ингредиент</TableHead>
                  <TableHead className="w-[190px]">Заказано</TableHead>
                  <TableHead className="w-[190px]">Получено</TableHead>
                  <TableHead className="w-[210px]">
                    Цена за кг / л / шт (без НДС)
                  </TableHead>
                  <TableHead className="w-[110px]">НДС %</TableHead>
                  <TableHead className="w-[190px]">С НДС / ед.</TableHead>
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
                  const viewReceived =
                    viewItem != null ? viewItem.received_qty : null

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
                              updateRow(r.localKey, { ingredient_id: v })
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
                          <div className="flex items-center gap-1">
                            <Input
                              className="min-w-[132px] flex-1"
                              inputMode="decimal"
                              value={r.quantityStr}
                              onChange={(e) =>
                                updateRow(r.localKey, {
                                  quantityStr: e.target.value,
                                })
                              }
                            />
                            <span className="text-muted-foreground w-8 shrink-0 text-xs">
                              {ing ? displayUnit(ing.unit) : ""}
                            </span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {readOnly ? (
                          <span className="text-sm">
                            {viewReceived != null && ingUnit ? (
                              <>
                                {toDisplayQty(viewReceived, ingUnit)}
                                {displayUnitSfx ? ` ${displayUnitSfx}` : ""}
                              </>
                            ) : (
                              <span className="text-muted-foreground">
                                = заказано
                              </span>
                            )}
                          </span>
                        ) : (
                          <div className="flex items-center gap-1">
                            <Input
                              className="min-w-[132px] flex-1"
                              inputMode="decimal"
                              placeholder="= заказано"
                              value={r.receivedQtyStr}
                              onChange={(e) =>
                                updateRow(r.localKey, {
                                  receivedQtyStr: e.target.value,
                                })
                              }
                            />
                            <span className="text-muted-foreground w-8 shrink-0 text-xs">
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
                            className="min-w-[170px]"
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
                            className="min-w-[80px]"
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
                            className="min-w-[150px]"
                            inputMode="decimal"
                            value={r.priceWithVatStr}
                            onChange={(e) =>
                              updatePriceWithVat(r.localKey, e.target.value)
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

        <DialogFooter className="border-t px-6 py-4 sm:justify-end">
          {readOnly ? (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Закрыть
            </Button>
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
