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
  priceStr: string
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
    priceStr: "",
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
          priceStr: String(toDisplayPrice(it.price_per_unit, it.ingredient.unit)),
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
      const priceWithVat = round4(price * (1 + vat / 100))
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
      payloadItems.push({
        ingredient_id: r.ingredient_id.trim(),
        quantity: toStorageQty(r.qty, ing.unit),
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
      <DialogContent className="flex max-h-[90vh] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
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

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[200px]">Ингредиент</TableHead>
                  <TableHead className="w-36">Кол-во</TableHead>
                  <TableHead className="min-w-[200px]">
                    Цена за кг / л / шт (без НДС)
                  </TableHead>
                  <TableHead className="w-24">НДС %</TableHead>
                  <TableHead className="w-36">С НДС / ед.</TableHead>
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
                              className="min-w-0 flex-1"
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
                          <span className="text-sm">{r.priceStr}</span>
                        ) : (
                          <Input
                            inputMode="decimal"
                            value={r.priceStr}
                            onChange={(e) =>
                              updateRow(r.localKey, {
                                priceStr: e.target.value,
                              })
                            }
                          />
                        )}
                      </TableCell>
                      <TableCell>
                        {readOnly ? (
                          <span className="text-sm">{r.vatStr}</span>
                        ) : (
                          <Input
                            inputMode="decimal"
                            value={r.vatStr}
                            onChange={(e) =>
                              updateRow(r.localKey, { vatStr: e.target.value })
                            }
                          />
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatMdl(
                          readOnly && viewItem != null
                            ? toDisplayPrice(
                                viewItem.price_per_unit_with_vat,
                                viewItem.ingredient.unit
                              )
                            : r.priceWithVat
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
