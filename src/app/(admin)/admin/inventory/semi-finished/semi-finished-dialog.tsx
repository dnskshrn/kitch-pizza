"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import {
  createSemiFinished,
  updateSemiFinished,
  type SemiFinishedItemInput,
} from "./actions"
import type { IngredientSelectOption, SemiFinishedWithItems } from "./types"
import {
  formatRecipeQtyNormalized,
  normalizeRecipeQtyInputBlur,
  parseRecipeQtyStrict,
  recipeEditorStorageUnitShort,
} from "@/lib/recipe-editor-qty"
import { displayUnit, toDisplayPrice } from "@/lib/inventory-units"
import { IngredientCombobox } from "../supplies/ingredient-combobox"
import { SemiFinishedCombobox } from "../semi-finished-combobox"
import {
  buildSemiFinishedCatalogMap,
  semiCostPerStorageUnitMdl,
} from "@/lib/semi-finished-cost"
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
  { value: "g" as const, label: "г" },
  { value: "ml" as const, label: "мл" },
  { value: "pcs" as const, label: "шт" },
]

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

type ItemRowType = "ingredient" | "semi"

type ItemRow = {
  rowType: ItemRowType
  refId: string
  quantityStr: string
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: "create" | "edit"
  semiFinished: SemiFinishedWithItems | null
  ingredientOptions: IngredientSelectOption[]
  ingredientCostById: Record<string, number>
  semiFinishedCatalog: SemiFinishedWithItems[]
}

function normalizeItems(raw: unknown): SemiFinishedWithItems["semi_finished_items"] {
  if (!raw) return []
  const list = Array.isArray(raw) ? raw : [raw]
  return list.map((row) => {
    const r = row as Record<string, unknown>
    const ing = r.ingredients
    const ingredients = Array.isArray(ing)
      ? (ing[0] as { name: string; unit: "g" | "ml" | "pcs" } | null) ?? null
      : (ing as { name: string; unit: "g" | "ml" | "pcs" } | null) ?? null
    const semiRef = r.semi_finished_ref
    const semi_finished_ref = Array.isArray(semiRef)
      ? (semiRef[0] as { name: string; yield_unit: "g" | "ml" | "pcs" } | null) ??
        null
      : (semiRef as { name: string; yield_unit: "g" | "ml" | "pcs" } | null) ??
        null
    return {
      ...(r as SemiFinishedWithItems["semi_finished_items"][number]),
      ingredients,
      semi_finished_ref,
    }
  })
}

export function SemiFinishedDialog({
  open,
  onOpenChange,
  mode,
  semiFinished,
  ingredientOptions,
  ingredientCostById,
  semiFinishedCatalog,
}: Props) {
  const [name, setName] = useState("")
  const [yieldQtyStr, setYieldQtyStr] = useState("")
  const [yieldUnit, setYieldUnit] = useState<"g" | "ml" | "pcs">("g")
  const [itemRows, setItemRows] = useState<ItemRow[]>([
    { rowType: "ingredient", refId: "", quantityStr: "" },
  ])
  const [pending, startTransition] = useTransition()

  const ingredientCostMap = useMemo(
    () => new Map(Object.entries(ingredientCostById)),
    [ingredientCostById]
  )

  const ingredientById = useMemo(() => {
    const map = new Map<string, EnrichedIngredient>()
    for (const o of ingredientOptions) {
      const storageCost = ingredientCostById[o.id]
      map.set(o.id, {
        id: o.id,
        name: o.name,
        unit: o.unit,
        avgCost:
          storageCost != null && storageCost > 0 ? storageCost : null,
      })
    }
    return map
  }, [ingredientOptions, ingredientCostById])

  const semiCatalogById = useMemo(
    () => buildSemiFinishedCatalogMap(semiFinishedCatalog),
    [semiFinishedCatalog]
  )

  const semiSelectOptions = useMemo(() => {
    const excludeId = mode === "edit" ? semiFinished?.id : null
    return semiFinishedCatalog
      .filter((s) => s.id !== excludeId)
      .map((s) => ({
        id: s.id,
        name: s.name,
        yield_unit: s.yield_unit,
        yield_qty: s.yield_qty,
      }))
  }, [semiFinishedCatalog, mode, semiFinished?.id])

  const ingredientComboboxOptions = useMemo(
    () =>
      ingredientOptions.map((o) => ({
        id: o.id,
        name: o.name,
        suffix: recipeEditorStorageUnitShort(o.unit),
      })),
    [ingredientOptions]
  )

  const semiComboboxOptions = useMemo(
    () =>
      semiSelectOptions.map((s) => ({
        id: s.id,
        name: s.name,
        suffix: recipeEditorStorageUnitShort(s.yield_unit),
      })),
    [semiSelectOptions]
  )

  const selectOptions: IngredientSelectOption[] = ingredientOptions

  const liveSummary = useMemo(() => {
    let inputTotal = 0
    const unitsOrdered: ("g" | "ml" | "pcs")[] = []
    let totalLineCost = 0

    for (const row of itemRows) {
      if (!row.refId) continue

      const q = parseRecipeQtyStrict(row.quantityStr ?? "")
      const qty = q != null && q > 0 ? q : 0
      inputTotal += qty

      if (row.rowType === "ingredient") {
        const ing = ingredientById.get(row.refId)
        const fromProp = ingredientOptions.find((o) => o.id === row.refId)
        const unit = ing?.unit ?? fromProp?.unit ?? "g"
        unitsOrdered.push(unit)

        const avgCost = ing?.avgCost
        if (qty > 0 && avgCost != null && avgCost > 0) {
          totalLineCost += qty * avgCost
        }
        continue
      }

      const semi = semiCatalogById.get(row.refId)
      const unit = semi?.yield_unit ?? "g"
      unitsOrdered.push(unit)

      const costPerUnit = semiCostPerStorageUnitMdl(
        row.refId,
        semiCatalogById,
        ingredientCostMap
      )
      if (qty > 0 && costPerUnit != null && costPerUnit > 0) {
        totalLineCost += qty * costPerUnit
      }
    }

    const firstUnit = unitsOrdered[0]
    const uniqueUnits = new Set(unitsOrdered)
    const inputUnitLabel =
      unitsOrdered.length === 0
        ? "—"
        : uniqueUnits.size === 1 && firstUnit
          ? recipeEditorStorageUnitShort(firstUnit)
          : "смеш."

    const yieldQtyRaw = parseRecipeQtyStrict(yieldQtyStr ?? "")
    const yieldQtyNum =
      yieldQtyRaw != null && yieldQtyRaw > 0 ? yieldQtyRaw : 0

    let lossesDisplay = "—"
    if (inputTotal > 0 && yieldQtyNum > 0) {
      const loss = inputTotal - yieldQtyNum
      const pct = ((inputTotal - yieldQtyNum) / inputTotal) * 100
      lossesDisplay = `${loss.toFixed(1)} (${pct.toFixed(1)}%)`
    }

    const yieldUnitLabel = recipeEditorStorageUnitShort(yieldUnit)
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
  }, [
    itemRows,
    yieldQtyStr,
    yieldUnit,
    ingredientById,
    ingredientCostMap,
    ingredientOptions,
    semiCatalogById,
  ])

  useEffect(() => {
    if (!open) return
    if (mode === "edit" && semiFinished) {
      setName(semiFinished.name ?? "")
      setYieldQtyStr(
        semiFinished.yield_qty !== null && semiFinished.yield_qty !== undefined
          ? formatRecipeQtyNormalized(Number(semiFinished.yield_qty))
          : ""
      )
      setYieldUnit(semiFinished.yield_unit)
      const items = normalizeItems(semiFinished.semi_finished_items)
      if (items.length === 0) {
        setItemRows([{ rowType: "ingredient", refId: "", quantityStr: "" }])
      } else {
        setItemRows(
          items.map((i) => ({
            rowType: i.semi_finished_ref_id ? "semi" : "ingredient",
            refId: i.semi_finished_ref_id ?? i.ingredient_id ?? "",
            quantityStr: formatRecipeQtyNormalized(Number(i.quantity)),
          }))
        )
      }
    } else {
      setName("")
      setYieldQtyStr("")
      setYieldUnit("g")
      setItemRows([{ rowType: "ingredient", refId: "", quantityStr: "" }])
    }
  }, [open, mode, semiFinished])

  function addRow() {
    setItemRows((prev) => [
      ...prev,
      { rowType: "ingredient", refId: "", quantityStr: "" },
    ])
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
    const filled = itemRows.filter((r) => (r.refId ?? "").trim() !== "")
    const keys = filled.map((r) =>
      r.rowType === "semi" ? `semi:${r.refId}` : `ing:${r.refId}`
    )
    if (keys.length === 0) {
      alert("Добавьте хотя бы один компонент состава")
      return null
    }
    const unique = new Set(keys)
    if (unique.size !== keys.length) {
      alert("Нельзя выбрать один и тот же компонент дважды")
      return null
    }
    const out: SemiFinishedItemInput[] = []
    for (const r of filled) {
      const q = parseRecipeQtyStrict(r.quantityStr ?? "")
      if (q == null || q <= 0) {
        alert("Укажите положительное количество для каждой строки")
        return null
      }
      out.push({
        ingredient_id: r.rowType === "ingredient" ? r.refId : null,
        semi_finished_ref_id: r.rowType === "semi" ? r.refId : null,
        quantity: q,
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
    const y = parseRecipeQtyStrict(yieldQtyStr ?? "")
    if (y == null || y <= 0) {
      alert("Укажите положительный выход (количество)")
      return
    }
    const items = buildPayload()
    if (!items) return

    const payload = {
      name: title,
      yield_qty: y,
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
    selectOptions.length > 0 ||
    ingredientOptions.length > 0 ||
    semiSelectOptions.length > 0

  function rowUnitAndCost(row: ItemRow): { unitText: string; costText: string } {
    const q = parseRecipeQtyStrict(row.quantityStr ?? "")
    const qty = q != null && q > 0 ? q : 0

    if (row.rowType === "semi") {
      const semi = row.refId ? semiCatalogById.get(row.refId) : undefined
      const u = semi?.yield_unit ?? "g"
      const unitText = recipeEditorStorageUnitShort(u)
      const costPerUnit = row.refId
        ? semiCostPerStorageUnitMdl(row.refId, semiCatalogById, ingredientCostMap)
        : null

      if (!row.refId || qty <= 0 || costPerUnit == null || costPerUnit === 0) {
        return { unitText, costText: "—" }
      }
      const displayUnitPrice = toDisplayPrice(costPerUnit, u)
      return {
        unitText,
        costText: `${displayUnitPrice.toFixed(4)} MDL/${displayUnit(u)} × ${new Intl.NumberFormat("ro-MD", { maximumFractionDigits: 6 }).format(qty)} ${unitText} = ${formatMdl2(costPerUnit * qty)}`,
      }
    }

    const ing = row.refId ? ingredientById.get(row.refId) : undefined
    const fromProp = row.refId
      ? ingredientOptions.find((o) => o.id === row.refId)
      : undefined
    const u = ing?.unit ?? fromProp?.unit ?? "g"
    const unitText = recipeEditorStorageUnitShort(u)
    const ac = ing?.avgCost

    if (!row.refId || qty <= 0 || ac == null || ac === 0) {
      return { unitText, costText: "—" }
    }
    const displayUnitPrice = toDisplayPrice(ac, u)
    return {
      unitText,
      costText: `${displayUnitPrice.toFixed(4)} MDL/${displayUnit(u)} × ${new Intl.NumberFormat("ro-MD", { maximumFractionDigits: 6 }).format(qty)} ${unitText} = ${formatMdl2(ac * qty)}`,
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
                onBlur={() =>
                  setYieldQtyStr((prev) => normalizeRecipeQtyInputBlur(prev))
                }
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
              <Label>Состав</Label>
              <Button type="button" variant="outline" size="sm" onClick={addRow}>
                Добавить строку
              </Button>
            </div>
            {!hasOptions ? (
              <p className="text-muted-foreground text-sm">
                Нет ингредиентов или полуфабрикатов для выбора. Сначала добавьте
                их в соответствующих разделах.
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
                      <div className="grid min-w-[120px] gap-1 sm:min-w-[132px]">
                        <span className="text-muted-foreground text-xs">Тип</span>
                        <Select
                          value={row.rowType}
                          onValueChange={(v) =>
                            updateRow(index, {
                              rowType: v as ItemRowType,
                              refId: "",
                            })
                          }
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ingredient">Ингредиент</SelectItem>
                            <SelectItem value="semi">Полуфабрикат</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid min-w-[140px] flex-1 gap-1 sm:min-w-[180px]">
                        <span className="text-muted-foreground text-xs">
                          {row.rowType === "semi" ? "Полуфабрикат" : "Ингредиент"}
                        </span>
                        {row.rowType === "semi" ? (
                          <SemiFinishedCombobox
                            value={row.refId}
                            onChange={(v) => updateRow(index, { refId: v })}
                            semiFinished={semiComboboxOptions}
                          />
                        ) : (
                          <IngredientCombobox
                            value={row.refId}
                            onChange={(v) => updateRow(index, { refId: v })}
                            ingredients={ingredientComboboxOptions}
                          />
                        )}
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
                            onBlur={() =>
                              updateRow(index, {
                                quantityStr: normalizeRecipeQtyInputBlur(
                                  row.quantityStr,
                                ),
                              })
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
