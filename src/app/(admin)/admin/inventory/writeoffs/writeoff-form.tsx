"use client"

import { useMemo, useState, useTransition } from "react"
import { isRedirectError } from "next/dist/client/components/redirect"
import {
  displayUnit,
  toStorageQty,
  type StorageUnit,
} from "@/lib/inventory-units"
import { createWriteoff } from "./actions"
import { IngredientCombobox } from "../supplies/ingredient-combobox"
import { Button } from "@/components/ui/button"
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
import Link from "next/link"

const REASON_OPTIONS: { value: string; label: string }[] = [
  { value: "waste", label: "Отход" },
  { value: "spoilage", label: "Порча" },
  { value: "tasting", label: "Дегустация" },
  { value: "staff_meal", label: "Питание персонала" },
  { value: "other", label: "Другое" },
]

export type WriteoffIngredientOption = {
  id: string
  name: string
  unit: StorageUnit
  avgCost: number | null
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
  return `${value.toLocaleString("ro-MD", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} MDL`
}

function newLocalKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random()}`
}

type EditableRow = {
  localKey: string
  ingredient_id: string
  quantityStr: string
}

function emptyRow(): EditableRow {
  return {
    localKey: newLocalKey(),
    ingredient_id: "",
    quantityStr: "",
  }
}

type Props = {
  ingredients: WriteoffIngredientOption[]
}

export function WriteoffForm({ ingredients }: Props) {
  const [dateStr, setDateStr] = useState(todayLocalISODate())
  const [reason, setReason] = useState("")
  const [note, setNote] = useState("")
  const [rows, setRows] = useState<EditableRow[]>([emptyRow()])
  const [pending, startTransition] = useTransition()

  const ingredientById = useMemo(() => {
    const m = new Map<string, WriteoffIngredientOption>()
    for (const i of ingredients) {
      m.set(i.id, i)
    }
    return m
  }, [ingredients])

  const comboboxItems = useMemo(
    () =>
      ingredients.map((i) => ({
        id: i.id,
        name: i.name,
        unit: displayUnit(i.unit),
      })),
    [ingredients]
  )

  const computedRows = useMemo(() => {
    return rows.map((r) => {
      const qtyDisplay = parseDecimal(r.quantityStr) ?? 0
      const ing = r.ingredient_id
        ? ingredientById.get(r.ingredient_id.trim())
        : undefined
      let lineCostMdl: number | null = null
      if (
        ing &&
        qtyDisplay > 0 &&
        ing.avgCost != null &&
        Number.isFinite(ing.avgCost)
      ) {
        const storageQty = toStorageQty(qtyDisplay, ing.unit)
        lineCostMdl = ing.avgCost * storageQty
      }
      return { ...r, qtyDisplay, ing, lineCostMdl }
    })
  }, [rows, ingredientById])

  const totalMdl = useMemo(() => {
    return computedRows.reduce((s, r) => {
      if (r.lineCostMdl != null && Number.isFinite(r.lineCostMdl)) {
        return s + r.lineCostMdl
      }
      return s
    }, 0)
  }, [computedRows])

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

  function handleSubmit() {
    const payloadItems: { ingredient_id: string; quantity: number }[] = []
    for (const r of computedRows) {
      if (!r.ingredient_id.trim()) continue
      if (r.qtyDisplay <= 0) {
        alert("Укажите количество больше нуля во всех заполненных строках")
        return
      }
      const ing = ingredientById.get(r.ingredient_id.trim())
      if (!ing) {
        alert("Не найден ингредиент")
        return
      }
      payloadItems.push({
        ingredient_id: r.ingredient_id.trim(),
        quantity: toStorageQty(r.qtyDisplay, ing.unit),
      })
    }

    if (payloadItems.length === 0) {
      alert("Добавьте хотя бы одну позицию с ингредиентом")
      return
    }

    if (!reason.trim()) {
      alert("Выберите причину списания")
      return
    }

    startTransition(async () => {
      try {
        await createWriteoff({
          date: dateStr,
          reason: reason.trim(),
          note: note.trim() !== "" ? note.trim() : null,
          items: payloadItems,
        })
      } catch (e) {
        if (isRedirectError(e)) throw e
        console.error(e)
        alert(e instanceof Error ? e.message : "Ошибка сохранения")
      }
    })
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold">Новое списание</h1>
        <Button variant="outline" asChild>
          <Link href="/admin/inventory/writeoffs">К списку</Link>
        </Button>
      </div>

      <div className="grid max-w-2xl gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="writeoff-date">Дата</Label>
          <Input
            id="writeoff-date"
            type="date"
            value={dateStr}
            onChange={(e) => setDateStr(e.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label>Причина</Label>
          <Select value={reason} onValueChange={setReason}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Выберите причину" />
            </SelectTrigger>
            <SelectContent>
              {REASON_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor="writeoff-note">Заметка</Label>
          <Textarea
            id="writeoff-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="Необязательно"
          />
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <Label className="text-base">Позиции</Label>
          <Button type="button" variant="outline" size="sm" onClick={addRow}>
            Добавить позицию
          </Button>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[200px]">Ингредиент</TableHead>
                <TableHead className="w-40">Кол-во</TableHead>
                <TableHead className="w-44">Стоимость</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {computedRows.map((r) => {
                const ing = r.ingredient_id
                  ? ingredientById.get(r.ingredient_id.trim())
                  : undefined
                const unitSfx = ing ? displayUnit(ing.unit) : ""

                return (
                  <TableRow key={r.localKey}>
                    <TableCell>
                      <IngredientCombobox
                        value={r.ingredient_id}
                        onChange={(v) =>
                          updateRow(r.localKey, { ingredient_id: v })
                        }
                        ingredients={comboboxItems}
                      />
                    </TableCell>
                    <TableCell>
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
                        <span className="text-muted-foreground w-10 shrink-0 text-xs">
                          {unitSfx}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm tabular-nums">
                      {r.lineCostMdl != null && Number.isFinite(r.lineCostMdl)
                        ? formatMdl(r.lineCostMdl)
                        : "—"}
                    </TableCell>
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
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>

        <div className="mt-4 flex justify-end text-sm">
          <div>
            <span className="text-muted-foreground">Итого: </span>
            <span className="font-medium tabular-nums">{formatMdl(totalMdl)}</span>
          </div>
        </div>
      </div>

      <Button type="button" onClick={handleSubmit} disabled={pending}>
        {pending ? "Сохранение..." : "Сохранить"}
      </Button>
    </div>
  )
}
