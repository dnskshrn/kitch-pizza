"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { createClient } from "@/lib/supabase/client"
import type { ProductRecipeMeta } from "@/types/database"
import {
  saveProductRecipe,
  type ProductRecipeLineInput,
  type ProductRecipeMetaInput,
} from "./actions"
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
import {
  displayUnit,
  toDisplayPrice,
  toDisplayQty,
  toStorageQty,
  type StorageUnit,
} from "@/lib/inventory-units"

const EMPTY = "__none__"

const UNITS = [
  { value: "g" as const, label: "кг" },
  { value: "ml" as const, label: "л" },
  { value: "pcs" as const, label: "шт" },
]

function firstRelation<T extends Record<string, unknown>>(rel: unknown): T | null {
  if (rel == null) return null
  if (Array.isArray(rel)) return (rel[0] as T | undefined) ?? null
  return rel as T
}

function formatMdl2(n: number): string {
  return `${n.toFixed(2)} MDL`
}

type SemiFinishedApiRow = {
  id: string
  name: string
  yield_qty: number
  yield_unit: "g" | "ml" | "pcs"
  semi_finished_items: unknown
}

function calcSemiFinishedCostPerUnit(sf: SemiFinishedApiRow): number {
  const rawItems = sf.semi_finished_items
  const items = Array.isArray(rawItems) ? rawItems : rawItems ? [rawItems] : []
  let totalCost = 0
  for (const item of items) {
    const it = item as {
      quantity: number
      ingredients?: unknown
    }
    const ingRaw = it.ingredients
    const ing = Array.isArray(ingRaw)
      ? (ingRaw[0] as { ingredient_stock?: unknown } | undefined)
      : (ingRaw as { ingredient_stock?: unknown } | null)
    const st = firstRelation<{ avg_cost?: unknown }>(ing?.ingredient_stock)
    const avgCost = st?.avg_cost != null ? Number(st.avg_cost) : 0
    const q = Number(it.quantity) || 0
    totalCost += avgCost * q
  }
  const y = Number(sf.yield_qty) || 0
  return y > 0 ? totalCost / y : 0
}

export type IngredientOption = {
  id: string
  name: string
  unit: "g" | "ml" | "pcs"
}

export type SemiFinishedOption = {
  id: string
  name: string
  yield_unit: "g" | "ml" | "pcs"
}

type EnrichedIngredient = IngredientOption & {
  avgCost: number
}

type EnrichedSemi = SemiFinishedOption & {
  yield_qty: number
  costPerUnit: number
}

type CompType = "ingredient" | "semi_finished"

type RowState = {
  type: CompType
  refId: string
  quantityStr: string
}

function recipeRowStorageUnit(
  row: RowState,
  ingredientById: Map<string, EnrichedIngredient>,
  semiById: Map<string, EnrichedSemi>,
  ingredientOptions: IngredientOption[],
  semiFinishedOptions: SemiFinishedOption[]
): StorageUnit {
  if (row.type === "ingredient") {
    return (
      ingredientById.get(row.refId)?.unit ??
      ingredientOptions.find((o) => o.id === row.refId)?.unit ??
      "g"
    )
  }
  return (
    semiById.get(row.refId)?.yield_unit ??
    semiFinishedOptions.find((o) => o.id === row.refId)?.yield_unit ??
    "g"
  )
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  menuItemId: string
  variantId: string | null
  itemName: string
  variantName: string | null
  ingredientOptions: IngredientOption[]
  semiFinishedOptions: SemiFinishedOption[]
}

export function TechCardDialog({
  open,
  onOpenChange,
  menuItemId,
  variantId,
  itemName,
  variantName,
  ingredientOptions,
  semiFinishedOptions,
}: Props) {
  const [rows, setRows] = useState<RowState[]>([
    { type: "ingredient", refId: "", quantityStr: "" },
  ])
  const [outputQtyStr, setOutputQtyStr] = useState("")
  const [outputUnit, setOutputUnit] = useState<"g" | "ml" | "pcs">("g")
  const [enrichedIngredients, setEnrichedIngredients] = useState<
    EnrichedIngredient[]
  >([])
  const [enrichedSemi, setEnrichedSemi] = useState<EnrichedSemi[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loadingInitial, setLoadingInitial] = useState(false)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoadingInitial(true)
    setLoadError(null)

    ;(async () => {
      const supabase = createClient()

      const { data: menuRow, error: menuErr } = await supabase
        .from("menu_items")
        .select("brand_id")
        .eq("id", menuItemId)
        .single()

      if (cancelled) return

      if (menuErr || !menuRow?.brand_id) {
        setLoadingInitial(false)
        setLoadError(menuErr?.message ?? "Не удалось определить бренд позиции")
        return
      }

      const brandId = menuRow.brand_id as string

      let recipeQ = supabase
        .from("product_recipes")
        .select("*, ingredients(name, unit), semi_finished(name, yield_unit)")
        .eq("menu_item_id", menuItemId)

      recipeQ =
        variantId == null
          ? recipeQ.is("variant_id", null)
          : recipeQ.eq("variant_id", variantId)

      const metaBase = supabase
        .from("product_recipe_meta")
        .select("*")
        .eq("menu_item_id", menuItemId)

      const metaQ =
        variantId == null
          ? metaBase.is("variant_id", null).maybeSingle()
          : metaBase.eq("variant_id", variantId).maybeSingle()

      const [
        ingRes,
        semiRes,
        metaRes,
        recipeRes,
      ] = await Promise.all([
        supabase
          .from("ingredients")
          .select("id, name, unit, ingredient_stock(avg_cost)")
          .eq("brand_id", brandId)
          .order("name"),
        supabase
          .from("semi_finished")
          .select(
            "id, name, yield_qty, yield_unit, semi_finished_items(quantity, ingredients(unit, ingredient_stock(avg_cost)))"
          )
          .eq("brand_id", brandId)
          .order("name"),
        metaQ,
        recipeQ,
      ])

      const ingUnitById = new Map<string, StorageUnit>()
      for (const row of ingRes.data ?? []) {
        const r = row as { id: string; unit: StorageUnit }
        ingUnitById.set(r.id, r.unit)
      }
      const semiYieldById = new Map<string, StorageUnit>()
      for (const row of semiRes.data ?? []) {
        const r = row as SemiFinishedApiRow
        semiYieldById.set(r.id, r.yield_unit)
      }

      if (cancelled) return
      setLoadingInitial(false)

      if (ingRes.error) {
        setLoadError(ingRes.error.message)
        setEnrichedIngredients([])
      } else {
        setEnrichedIngredients(
          (ingRes.data ?? []).map((row: unknown) => {
            const r = row as {
              id: string
              name: string
              unit: "g" | "ml" | "pcs"
              ingredient_stock: unknown
            }
            const st = firstRelation<{ avg_cost?: unknown }>(r.ingredient_stock)
            const avgCost =
              st?.avg_cost != null && Number.isFinite(Number(st.avg_cost))
                ? Number(st.avg_cost)
                : 0
            return {
              id: r.id,
              name: r.name,
              unit: r.unit,
              avgCost,
            }
          })
        )
      }

      if (semiRes.error) {
        setLoadError((prev) => prev ?? semiRes.error!.message)
        setEnrichedSemi([])
      } else {
        setEnrichedSemi(
          (semiRes.data ?? []).map((row: unknown) => {
            const r = row as SemiFinishedApiRow
            const costPerUnit = calcSemiFinishedCostPerUnit(r)
            return {
              id: r.id,
              name: r.name,
              yield_unit: r.yield_unit,
              yield_qty: Number(r.yield_qty) || 0,
              costPerUnit,
            }
          })
        )
      }

      if (metaRes.error) {
        setLoadError((prev) => prev ?? metaRes.error!.message)
      } else {
        const meta = metaRes.data as ProductRecipeMeta | null
        if (meta && meta.output_qty != null && meta.output_unit) {
          setOutputQtyStr(
            String(toDisplayQty(Number(meta.output_qty), meta.output_unit))
          )
          setOutputUnit(meta.output_unit)
        } else {
          setOutputQtyStr("")
          setOutputUnit("g")
        }
      }

      if (recipeRes.error) {
        setLoadError((prev) => prev ?? recipeRes.error!.message)
        const defaultType: CompType =
          ingredientOptions.length > 0 ? "ingredient" : "semi_finished"
        setRows([{ type: defaultType, refId: "", quantityStr: "" }])
        return
      }

      const list = (recipeRes.data ?? []) as Array<{
        ingredient_id: string | null
        semi_finished_id: string | null
        quantity: number
      }>

      if (list.length === 0) {
        const defaultType: CompType =
          ingredientOptions.length > 0 ? "ingredient" : "semi_finished"
        setRows([{ type: defaultType, refId: "", quantityStr: "" }])
        return
      }

      setRows(
        list.map((r) => {
          if (r.ingredient_id) {
            const u = ingUnitById.get(r.ingredient_id) ?? "g"
            return {
              type: "ingredient" as const,
              refId: r.ingredient_id,
              quantityStr: String(toDisplayQty(Number(r.quantity), u)),
            }
          }
          const u = semiYieldById.get(r.semi_finished_id ?? "") ?? "g"
          return {
            type: "semi_finished" as const,
            refId: r.semi_finished_id ?? "",
            quantityStr: String(toDisplayQty(Number(r.quantity), u)),
          }
        })
      )
    })()

    return () => {
      cancelled = true
    }
  }, [
    open,
    menuItemId,
    variantId,
    ingredientOptions.length,
    semiFinishedOptions.length,
  ])

  const ingredientById = useMemo(() => {
    const m = new Map<string, EnrichedIngredient>()
    for (const x of enrichedIngredients) m.set(x.id, x)
    return m
  }, [enrichedIngredients])

  const semiById = useMemo(() => {
    const m = new Map<string, EnrichedSemi>()
    for (const x of enrichedSemi) m.set(x.id, x)
    return m
  }, [enrichedSemi])

  const selectIngredients: IngredientOption[] = useMemo(
    () =>
      enrichedIngredients.length > 0 ? enrichedIngredients : ingredientOptions,
    [enrichedIngredients, ingredientOptions]
  )

  const selectSemi: SemiFinishedOption[] = useMemo(
    () => (enrichedSemi.length > 0 ? enrichedSemi : semiFinishedOptions),
    [enrichedSemi, semiFinishedOptions]
  )

  const liveSummary = useMemo(() => {
    let inputTotal = 0
    let dishCost = 0

    for (const row of rows) {
      if (!row.refId.trim()) continue
      const q = parseFloat((row.quantityStr ?? "").replace(",", "."))
      const qty = Number.isFinite(q) && q > 0 ? q : 0
      inputTotal += qty

      if (qty <= 0) continue

      if (row.type === "ingredient") {
        const ing = ingredientById.get(row.refId)
        const prop = ingredientOptions.find((o) => o.id === row.refId)
        const u = ing?.unit ?? prop?.unit ?? "g"
        const ac = ing?.avgCost ?? 0
        if (ac > 0) dishCost += qty * toDisplayPrice(ac, u)
      } else {
        const sf = semiById.get(row.refId)
        const propSf = semiFinishedOptions.find((o) => o.id === row.refId)
        const u = sf?.yield_unit ?? propSf?.yield_unit ?? "g"
        const cpu = sf?.costPerUnit ?? 0
        if (cpu > 0) dishCost += qty * toDisplayPrice(cpu, u)
      }
    }

    const outRaw = parseFloat((outputQtyStr ?? "").replace(",", "."))
    const outputQtyNum =
      Number.isFinite(outRaw) && outRaw > 0 ? outRaw : 0
    const outputUnitLabel = displayUnit(outputUnit)

    let lossesDisplay = "—"
    if (inputTotal > 0 && outputQtyNum > 0) {
      const loss = inputTotal - outputQtyNum
      const pct = ((inputTotal - outputQtyNum) / inputTotal) * 100
      lossesDisplay = `${loss.toFixed(1)} (${pct.toFixed(1)}%)`
    }

    const outputQtyDisplay =
      outputQtyNum > 0
        ? new Intl.NumberFormat("ro-MD", { maximumFractionDigits: 6 }).format(
            outputQtyNum
          )
        : "—"

    return {
      inputTotal,
      outputQtyNum,
      outputQtyDisplay,
      outputUnitLabel,
      lossesDisplay,
      dishCostStr: formatMdl2(dishCost),
    }
  }, [rows, outputQtyStr, outputUnit, ingredientById, semiById, ingredientOptions, semiFinishedOptions])

  function addRow() {
    const defaultType: CompType =
      selectIngredients.length > 0 ? "ingredient" : "semi_finished"
    setRows((prev) => [
      ...prev,
      { type: defaultType, refId: "", quantityStr: "" },
    ])
  }

  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index))
  }

  function updateRow(index: number, patch: Partial<RowState>) {
    setRows((prev) =>
      prev.map((r, i) => (i === index ? { ...r, ...patch } : r))
    )
  }

  function rowUnitAndCost(row: RowState): { unitText: string; costText: string } {
    if (!row.refId.trim()) {
      return { unitText: "—", costText: "—" }
    }
    const q = parseFloat((row.quantityStr ?? "").replace(",", "."))
    const qty = Number.isFinite(q) && q > 0 ? q : 0

    if (row.type === "ingredient") {
      const ing = ingredientById.get(row.refId)
      const prop = ingredientOptions.find((o) => o.id === row.refId)
      const u = ing?.unit ?? prop?.unit ?? "g"
      const unitText = displayUnit(u)
      const ac = ing?.avgCost ?? 0
      if (qty <= 0 || ac <= 0) {
        return { unitText, costText: "—" }
      }
      const p = toDisplayPrice(ac, u)
      return { unitText, costText: formatMdl2(p * qty) }
    }

    const sf = semiById.get(row.refId)
    const propSf = semiFinishedOptions.find((o) => o.id === row.refId)
    const u = sf?.yield_unit ?? propSf?.yield_unit ?? "g"
    const unitText = displayUnit(u)
    const cpu = sf?.costPerUnit ?? 0
    if (qty <= 0 || cpu <= 0) {
      return { unitText, costText: "—" }
    }
    const p = toDisplayPrice(cpu, u)
    return { unitText, costText: formatMdl2(p * qty) }
  }

  function buildPayload(): ProductRecipeLineInput[] | null {
    const filled = rows.filter((r) => (r.refId ?? "").trim() !== "")
    for (const r of filled) {
      const q = parseFloat((r.quantityStr ?? "").replace(",", "."))
      if (!Number.isFinite(q) || q <= 0) {
        alert("Укажите положительное количество для каждой строки")
        return null
      }
    }
    return filled.map((r) => ({
      ingredient_id: r.type === "ingredient" ? r.refId : null,
      semi_finished_id: r.type === "semi_finished" ? r.refId : null,
      quantity: toStorageQty(
        parseFloat((r.quantityStr ?? "").replace(",", ".")),
        recipeRowStorageUnit(
          r,
          ingredientById,
          semiById,
          ingredientOptions,
          semiFinishedOptions
        )
      ),
    }))
  }

  function handleSave() {
    const payload = buildPayload()
    if (!payload) return

    const outParsed = parseFloat((outputQtyStr ?? "").replace(",", "."))
    const recipeMeta: ProductRecipeMetaInput | null =
      Number.isFinite(outParsed) && outParsed > 0
        ? {
            output_qty: toStorageQty(outParsed, outputUnit),
            output_unit: outputUnit,
          }
        : null

    startTransition(async () => {
      try {
        await saveProductRecipe(menuItemId, variantId, payload, recipeMeta)
        onOpenChange(false)
      } catch (e) {
        console.error(e)
        alert(e instanceof Error ? e.message : "Ошибка сохранения")
      }
    })
  }

  const title =
    variantName && variantName.trim() !== ""
      ? `${itemName} (${variantName})`
      : itemName

  const hasIngredientOptions = selectIngredients.length > 0
  const hasSemiOptions = selectSemi.length > 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(90vh,720px)] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Техкарта: {title}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          {loadingInitial ? (
            <p className="text-muted-foreground text-sm">Загрузка…</p>
          ) : null}
          {loadError ? (
            <p className="text-destructive text-sm">{loadError}</p>
          ) : null}

          <div className="grid gap-2 sm:grid-cols-2 sm:gap-4">
            <div className="grid gap-2 sm:col-span-2 sm:grid-cols-2 sm:gap-4">
              <div className="grid gap-2">
                <Label htmlFor="tc-output-qty">Выход блюда</Label>
                <Input
                  id="tc-output-qty"
                  type="text"
                  inputMode="decimal"
                  value={outputQtyStr}
                  onChange={(e) => setOutputQtyStr(e.target.value)}
                  placeholder="0"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="tc-output-unit">Ед. изм.</Label>
                <Select
                  value={outputUnit}
                  onValueChange={(v) =>
                    setOutputUnit(v as "g" | "ml" | "pcs")
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
          </div>

          <div className="flex items-center justify-between">
            <Label>Компоненты</Label>
            <Button type="button" variant="outline" size="sm" onClick={addRow}>
              Добавить компонент
            </Button>
          </div>

          {!hasIngredientOptions && !hasSemiOptions ? (
            <p className="text-muted-foreground text-sm">
              Добавьте ингредиенты и полуфабрикаты в соответствующих разделах.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {rows.map((row, index) => {
                const { unitText, costText } = rowUnitAndCost(row)
                return (
                  <div
                    key={index}
                    className="flex flex-col gap-2 border-b pb-3 last:border-0 last:pb-0 sm:flex-row sm:flex-wrap sm:items-end"
                  >
                    <div className="grid min-w-[100px] flex-1 gap-1 sm:max-w-[140px]">
                      <span className="text-muted-foreground text-xs">Тип</span>
                      <Select
                        value={row.type}
                        onValueChange={(v) =>
                          updateRow(index, {
                            type: v as CompType,
                            refId: "",
                          })
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem
                            value="ingredient"
                            disabled={!hasIngredientOptions}
                          >
                            Ингредиент
                          </SelectItem>
                          <SelectItem
                            value="semi_finished"
                            disabled={!hasSemiOptions}
                          >
                            Полуфабрикат
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid min-w-[140px] flex-[2] gap-1">
                      <span className="text-muted-foreground text-xs">
                        {row.type === "ingredient"
                          ? "Ингредиент"
                          : "Полуфабрикат"}
                      </span>
                      <Select
                        value={row.refId || EMPTY}
                        onValueChange={(v) =>
                          updateRow(index, { refId: v === EMPTY ? "" : v })
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Выберите" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={EMPTY}>—</SelectItem>
                          {row.type === "ingredient"
                            ? selectIngredients.map((o) => (
                                <SelectItem key={o.id} value={o.id}>
                                  {o.name}
                                </SelectItem>
                              ))
                            : selectSemi.map((o) => (
                                <SelectItem key={o.id} value={o.id}>
                                  {o.name}
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
                      <div className="grid min-w-[min(100%,120px)] flex-1 gap-1">
                        <span className="text-muted-foreground text-xs">
                          Стоимость
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
        <DialogFooter className="flex-col gap-3 sm:gap-3">
          <div className="text-muted-foreground w-full space-y-1.5 border-t pt-3 text-sm tabular-nums">
            <div className="flex justify-between gap-4">
              <span>Вход:</span>
              <span className="text-right">
                {liveSummary.inputTotal} ед.
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span>Выход:</span>
              <span className="text-right">
                {liveSummary.outputQtyDisplay}{" "}
                {liveSummary.outputUnitLabel}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span>Потери:</span>
              <span className="text-right">{liveSummary.lossesDisplay}</span>
            </div>
            <div className="border-border border-t pt-1.5" />
            <div className="flex justify-between gap-4">
              <span>Себестоимость блюда:</span>
              <span className="text-right">{liveSummary.dishCostStr}</span>
            </div>
          </div>
          <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Отмена
            </Button>
            <Button
              onClick={handleSave}
              disabled={
                pending ||
                loadingInitial ||
                (!hasIngredientOptions && !hasSemiOptions)
              }
            >
              {pending ? "Сохранение..." : "Сохранить"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
