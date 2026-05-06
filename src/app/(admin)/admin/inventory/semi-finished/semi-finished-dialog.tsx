"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import type { SemiFinishedItem } from "@/types/database"
import { createClient } from "@/lib/supabase/client"
import {
  createSemiFinished,
  updateSemiFinished,
  type SemiFinishedItemInput,
} from "./actions"
import type { IngredientSelectOption, SemiFinishedWithItems } from "./types"
import {
  displayUnit,
  toDisplayPrice,
  toDisplayQty,
  toStorageQty,
} from "@/lib/inventory-units"
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
import { Trash2 } from "lucide-react"

const UNITS = [
  { value: "g" as const, label: "кг" },
  { value: "ml" as const, label: "л" },
  { value: "pcs" as const, label: "шт" },
]

const EMPTY = "__none__"

function firstRelation<T extends Record<string, unknown>>(rel: unknown): T | null {
  if (rel == null) return null
  if (Array.isArray(rel)) return (rel[0] as T | undefined) ?? null
  return rel as T
}

function readAdminBrandSlug(): string | null {
  if (typeof document === "undefined") return null
  const m = document.cookie.match(/(?:^|;\s*)admin-brand-slug=([^;]*)/)
  return m ? decodeURIComponent(m[1].trim()) : null
}

function formatMdl2(n: number): string {
  return `${n.toFixed(2)} MDL`
}

type EnrichedIngredient = {
  id: string
  name: string
  unit: "g" | "ml" | "pcs"
  /** null если нет строки остатков; 0 — явный ноль себестоимости */
  avgCost: number | null
}

type ItemRow = {
  ingredientId: string
  quantityStr: string
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: "create" | "edit"
  semiFinished: SemiFinishedWithItems | null
  ingredientOptions: IngredientSelectOption[]
}

function normalizeItems(
  raw: unknown
): Array<
  SemiFinishedItem & {
    ingredients: { name: string; unit: "g" | "ml" | "pcs" } | null
  }
> {
  if (!raw) return []
  const list = Array.isArray(raw) ? raw : [raw]
  return list.map((row) => {
    const r = row as {
      ingredients?:
        | { name: string; unit: "g" | "ml" | "pcs" }
        | { name: string; unit: "g" | "ml" | "pcs" }[]
        | null
    } & SemiFinishedItem
    const ing = r.ingredients
    const ingredients = Array.isArray(ing)
      ? ing[0] ?? null
      : ing ?? null
    return { ...r, ingredients }
  })
}

export function SemiFinishedDialog({
  open,
  onOpenChange,
  mode,
  semiFinished,
  ingredientOptions,
}: Props) {
  const [name, setName] = useState("")
  const [yieldQtyStr, setYieldQtyStr] = useState("")
  const [yieldUnit, setYieldUnit] = useState<"g" | "ml" | "pcs">("g")
  const [itemRows, setItemRows] = useState<ItemRow[]>([
    { ingredientId: "", quantityStr: "" },
  ])
  const [pending, startTransition] = useTransition()
  const [enrichedIngredients, setEnrichedIngredients] = useState<
    EnrichedIngredient[]
  >([])
  const [ingredientsLoading, setIngredientsLoading] = useState(false)
  const [ingredientsError, setIngredientsError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setIngredientsLoading(true)
    setIngredientsError(null)

    ;(async () => {
      const supabase = createClient()
      let brandId: string | null = semiFinished?.brand_id ?? null
      if (!brandId) {
        const slug = readAdminBrandSlug()
        if (slug) {
          const { data } = await supabase
            .from("brands")
            .select("id")
            .eq("slug", slug)
            .eq("is_active", true)
            .maybeSingle()
          brandId = data?.id ?? null
        }
      }

      if (!brandId) {
        if (!cancelled) {
          setIngredientsLoading(false)
          setIngredientsError("Не удалось определить бренд")
          setEnrichedIngredients([])
        }
        return
      }

      const { data, error } = await supabase
        .from("ingredients")
        .select("id, name, unit, ingredient_stock(avg_cost)")
        .eq("brand_id", brandId)
        .order("name")

      if (cancelled) return
      setIngredientsLoading(false)

      if (error) {
        setIngredientsError(error.message)
        setEnrichedIngredients([])
        return
      }

      const rows = (data ?? []).map((row: unknown) => {
        const r = row as {
          id: string
          name: string
          unit: "g" | "ml" | "pcs"
          ingredient_stock: unknown
        }
        const st = firstRelation<{ avg_cost?: unknown }>(r.ingredient_stock)
        let avgCost: number | null = null
        if (st && "avg_cost" in st && st.avg_cost != null) {
          const v = Number(st.avg_cost)
          avgCost = Number.isFinite(v) ? v : null
        }
        return {
          id: r.id,
          name: r.name,
          unit: r.unit,
          avgCost,
        } satisfies EnrichedIngredient
      })
      setEnrichedIngredients(rows)
    })()

    return () => {
      cancelled = true
    }
  }, [open, semiFinished?.brand_id])

  const ingredientById = useMemo(() => {
    const map = new Map<string, EnrichedIngredient>()
    for (const ing of enrichedIngredients) map.set(ing.id, ing)
    return map
  }, [enrichedIngredients])

  const selectOptions: IngredientSelectOption[] = useMemo(() => {
    if (enrichedIngredients.length > 0) {
      return enrichedIngredients.map((i) => ({
        id: i.id,
        name: i.name,
        unit: i.unit,
      }))
    }
    return ingredientOptions
  }, [enrichedIngredients, ingredientOptions])

  const liveSummary = useMemo(() => {
    let inputTotal = 0
    const unitsOrdered: ("g" | "ml" | "pcs")[] = []
    let totalLineCost = 0

    for (const row of itemRows) {
      if (!row.ingredientId) continue

      const ing = ingredientById.get(row.ingredientId)
      const fromProp = ingredientOptions.find((o) => o.id === row.ingredientId)
      const unit = ing?.unit ?? fromProp?.unit ?? "g"
      if (row.ingredientId) {
        unitsOrdered.push(unit)
      }

      const q = parseFloat((row.quantityStr ?? "").replace(",", "."))
      const qty = Number.isFinite(q) && q > 0 ? q : 0
      inputTotal += qty

      const avgCost = ing?.avgCost
      if (qty > 0 && avgCost != null && avgCost > 0) {
        totalLineCost += qty * toDisplayPrice(avgCost, unit)
      }
    }

    const firstUnit = unitsOrdered[0]
    const uniqueUnits = new Set(unitsOrdered)
    const inputUnitLabel =
      unitsOrdered.length === 0
        ? "—"
        : uniqueUnits.size === 1 && firstUnit
          ? displayUnit(firstUnit)
          : "смеш."

    const yieldQtyRaw = parseFloat((yieldQtyStr ?? "").replace(",", "."))
    const yieldQtyNum =
      Number.isFinite(yieldQtyRaw) && yieldQtyRaw > 0 ? yieldQtyRaw : 0

    let lossesDisplay = "—"
    if (inputTotal > 0 && yieldQtyNum > 0) {
      const loss = inputTotal - yieldQtyNum
      const pct = ((inputTotal - yieldQtyNum) / inputTotal) * 100
      lossesDisplay = `${loss.toFixed(1)} (${pct.toFixed(1)}%)`
    }

    const yieldUnitLabel = displayUnit(yieldUnit)
    const totalCostStr = formatMdl2(totalLineCost)
    const costPerYield =
      yieldQtyNum <= 0 ? "—" : formatMdl2(totalLineCost / yieldQtyNum)

    const yieldQtyDisplay =
      yieldQtyNum > 0
        ? new Intl.NumberFormat("ro-MD", { maximumFractionDigits: 6 }).format(
            yieldQtyNum
          )
        : "—"

    return {
      inputTotal,
      inputUnitLabel,
      yieldQtyNum,
      yieldQtyDisplay,
      yieldUnitLabel,
      lossesDisplay,
      totalCostStr,
      costPerYield,
    }
  }, [itemRows, yieldQtyStr, yieldUnit, ingredientById, ingredientOptions])

  useEffect(() => {
    if (!open) return
    if (mode === "edit" && semiFinished) {
      setName(semiFinished.name ?? "")
      setYieldQtyStr(
        semiFinished.yield_qty !== null && semiFinished.yield_qty !== undefined
          ? String(
              toDisplayQty(Number(semiFinished.yield_qty), semiFinished.yield_unit)
            )
          : ""
      )
      setYieldUnit(semiFinished.yield_unit)
      const items = normalizeItems(semiFinished.semi_finished_items)
      if (items.length === 0) {
        setItemRows([{ ingredientId: "", quantityStr: "" }])
      } else {
        setItemRows(
          items.map((i) => ({
            ingredientId: i.ingredient_id,
            quantityStr: String(
              toDisplayQty(
                Number(i.quantity),
                i.ingredients?.unit ?? "g"
              )
            ),
          }))
        )
      }
    } else {
      setName("")
      setYieldQtyStr("")
      setYieldUnit("g")
      setItemRows([{ ingredientId: "", quantityStr: "" }])
    }
  }, [open, mode, semiFinished])

  function addRow() {
    setItemRows((prev) => [...prev, { ingredientId: "", quantityStr: "" }])
  }

  function removeRow(index: number) {
    setItemRows((prev) => prev.filter((_, i) => i !== index))
  }

  function updateRow(index: number, patch: Partial<ItemRow>) {
    setItemRows((prev) =>
      prev.map((r, i) => (i === index ? { ...r, ...patch } : r))
    )
  }

  function buildPayload(): SemiFinishedItemInput[] | null {
    const filled = itemRows.filter((r) => (r.ingredientId ?? "").trim() !== "")
    const ids = filled.map((r) => r.ingredientId)
    const unique = new Set(ids)
    if (ids.length === 0) {
      alert("Добавьте хотя бы один ингредиент")
      return null
    }
    if (unique.size !== ids.length) {
      alert("Нельзя выбрать один и тот же ингредиент дважды")
      return null
    }
    const out: SemiFinishedItemInput[] = []
    for (const r of filled) {
      const q = parseFloat((r.quantityStr ?? "").replace(",", "."))
      if (!Number.isFinite(q) || q <= 0) {
        alert("Укажите положительное количество для каждой строки")
        return null
      }
      const ing =
        ingredientById.get(r.ingredientId) ??
        ingredientOptions.find((o) => o.id === r.ingredientId)
      const u = ing?.unit ?? "g"
      out.push({
        ingredient_id: r.ingredientId,
        quantity: toStorageQty(q, u),
      })
    }
    return out
  }

  function handleSave() {
    const title = (name ?? "").trim()
    if (!title) {
      alert("Укажите название")
      return
    }
    const y = parseFloat((yieldQtyStr ?? "").replace(",", "."))
    if (!Number.isFinite(y) || y <= 0) {
      alert("Укажите положительный выход (количество)")
      return
    }
    const items = buildPayload()
    if (!items) return

    const payload = {
      name: title,
      yield_qty: toStorageQty(y, yieldUnit),
      yield_unit: yieldUnit,
    }

    startTransition(async () => {
      try {
        if (mode === "create") {
          await createSemiFinished(payload, items)
        } else if (semiFinished) {
          await updateSemiFinished(semiFinished.id, payload, items)
        }
        onOpenChange(false)
      } catch (e) {
        console.error(e)
        alert(e instanceof Error ? e.message : "Ошибка сохранения")
      }
    })
  }

  const hasOptions =
    selectOptions.length > 0 || ingredientOptions.length > 0

  function rowUnitAndCost(row: ItemRow): { unitText: string; costText: string } {
    const ing = row.ingredientId ? ingredientById.get(row.ingredientId) : undefined
    const fromProp = row.ingredientId
      ? ingredientOptions.find((o) => o.id === row.ingredientId)
      : undefined
    const u = ing?.unit ?? fromProp?.unit ?? "g"
    const unitText = displayUnit(u)

    const q = parseFloat((row.quantityStr ?? "").replace(",", "."))
    const qty = Number.isFinite(q) && q > 0 ? q : 0
    const ac = ing?.avgCost

    if (!row.ingredientId || qty <= 0 || ac == null || ac === 0) {
      return { unitText, costText: "—" }
    }
    const p = toDisplayPrice(ac, u)
    return {
      unitText,
      costText: `${p.toFixed(2)} × ${new Intl.NumberFormat("ro-MD", { maximumFractionDigits: 6 }).format(qty)} = ${formatMdl2(p * qty)}`,
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(90vh,720px)] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Новый полуфабрикат" : "Редактировать полуфабрикат"}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="sf-name">Название</Label>
            <Input
              id="sf-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Название"
            />
          </div>
          <div className="grid gap-2 sm:grid-cols-2 sm:gap-4">
            <div className="grid gap-2">
              <Label htmlFor="sf-yield-qty">Выход (количество)</Label>
              <Input
                id="sf-yield-qty"
                type="text"
                inputMode="decimal"
                value={yieldQtyStr}
                onChange={(e) => setYieldQtyStr(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="grid gap-2">
              <Label>Единица выхода</Label>
              <Select
                value={yieldUnit}
                onValueChange={(v) =>
                  setYieldUnit(v as "g" | "ml" | "pcs")
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UNITS.map((u) => (
                    <SelectItem key={u.value} value={u.value}>
                      {u.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label>Ингредиенты</Label>
              <Button type="button" variant="outline" size="sm" onClick={addRow}>
                Добавить ингредиент
              </Button>
            </div>
            {ingredientsLoading ? (
              <p className="text-muted-foreground text-sm">Загрузка ингредиентов…</p>
            ) : null}
            {ingredientsError ? (
              <p className="text-destructive text-sm">{ingredientsError}</p>
            ) : null}
            {!hasOptions ? (
              <p className="text-muted-foreground text-sm">
                Нет ингредиентов для выбора. Сначала добавьте их в разделе
                «Ингредиенты».
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {itemRows.map((row, index) => {
                  const { unitText, costText } = rowUnitAndCost(row)
                  return (
                    <div
                      key={index}
                      className="flex flex-col gap-2 border-b pb-3 last:border-0 last:pb-0 sm:flex-row sm:flex-wrap sm:items-end"
                    >
                      <div className="grid min-w-[140px] flex-1 gap-1 sm:min-w-[180px]">
                        <span className="text-muted-foreground text-xs">
                          Ингредиент
                        </span>
                        <Select
                          value={row.ingredientId || EMPTY}
                          onValueChange={(v) =>
                            updateRow(index, {
                              ingredientId: v === EMPTY ? "" : v,
                            })
                          }
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Выберите" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={EMPTY}>—</SelectItem>
                            {selectOptions.map((opt) => (
                              <SelectItem key={opt.id} value={opt.id}>
                                {opt.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex flex-wrap items-end gap-2">
                        <div className="grid w-24 gap-1 sm:w-28">
                          <span className="text-muted-foreground text-xs">
                            Количество
                          </span>
                          <Input
                            type="text"
                            inputMode="decimal"
                            value={row.quantityStr}
                            onChange={(e) =>
                              updateRow(index, { quantityStr: e.target.value })
                            }
                            placeholder="0"
                          />
                        </div>
                        <div className="grid min-w-[2.5rem] gap-1 pb-2">
                          <span className="text-muted-foreground text-xs select-none">
                            &nbsp;
                          </span>
                          <span className="text-muted-foreground text-sm leading-none">
                            {unitText}
                          </span>
                        </div>
                        <div className="grid min-w-[min(100%,220px)] flex-1 gap-1 sm:min-w-[200px] sm:flex-[1.25]">
                          <span className="text-muted-foreground text-xs">
                            Стоимость строки
                          </span>
                          <p className="text-muted-foreground py-2 text-sm tabular-nums sm:py-0 sm:leading-9">
                            {costText}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="shrink-0"
                          aria-label="Удалить строку"
                          onClick={() => removeRow(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
        <DialogFooter className="flex-col gap-3 sm:gap-3">
          <div className="text-muted-foreground w-full space-y-1.5 border-t pt-3 text-sm tabular-nums">
            <div className="flex justify-between gap-4">
              <span>Вход:</span>
              <span className="text-right">
                {liveSummary.inputTotal}{" "}
                {liveSummary.inputUnitLabel}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span>Выход:</span>
              <span className="text-right">
                {liveSummary.yieldQtyDisplay} {liveSummary.yieldUnitLabel}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span>Потери:</span>
              <span className="text-right">{liveSummary.lossesDisplay}</span>
            </div>
            <div className="border-border border-t pt-1.5" />
            <div className="flex justify-between gap-4">
              <span>Себестоимость п/ф:</span>
              <span className="text-right">{liveSummary.totalCostStr}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span>Себестоимость / {liveSummary.yieldUnitLabel}:</span>
              <span className="text-right">{liveSummary.costPerYield}</span>
            </div>
          </div>
          <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Отмена
            </Button>
            <Button
              onClick={handleSave}
              disabled={pending || !hasOptions || !(name ?? "").trim()}
            >
              {pending ? "Сохранение..." : "Сохранить"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
