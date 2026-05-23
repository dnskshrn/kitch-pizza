"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { type StorageUnit } from "@/lib/inventory-units"
import {
  formatRecipeQtyNormalized,
  parseRecipeQtyStrict,
  recipeEditorStorageUnitShort,
  roundRecipeQtyNumber,
} from "@/lib/recipe-editor-qty"
import type {
  RecipeCompositionIngredient,
  RecipeCompositionSemi,
} from "@/lib/recipe-composition-types"
import {
  compositionRowGrossBlurState,
  compositionRowGrossInputState,
  compositionRowNetBlurState,
  compositionRowNetInputState,
  ingredientWastePercentFromMaps,
} from "@/lib/recipe-composition-row-updates"
import { wasteYieldFactor } from "@/lib/recipe-composition-waste"
import { recipeIngredientStockStorageQty } from "@/lib/product-recipe-ingredient-qty"
import {
  buildSemiCostPerUnitById,
  computeMaterialRecipeCostMdl,
  computeReferencedMenuItemRecipeCostMdl,
  enrichProductRecipeCostContext,
  productRecipeLineCostMdl,
  type ProductRecipeCostContext,
  type ProductRecipeCostLine,
} from "@/lib/product-recipe-cost"
import { RecipeNameCombobox } from "@/components/admin/menu/RecipeNameCombobox"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Plus, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"

const BASE_TAB = "__base__"

type ComboMenuCatalogRow = {
  id: string
  name_ru: string
  has_sizes: boolean
  variants: { id: string; name: string }[]
}

export type RecipeEditorRow = {
  clientKey: string
  id: string | null
  variant_id: string | null
  type: "ingredient" | "semi" | "menu_ref"
  ref_id: string
  /** Для `menu_ref`: вариант вложенной позиции (`menu_item_ref_variant_id`). */
  menu_ref_variant_id: string | null
  /** Нетто в единицах хранения (г / мл / шт), строка инпута. */
  quantityStr: string
  /** Брутто в тех же единицах; для п/ф дублирует quantityStr. */
  quantityGrossStr: string
  _dirty: boolean
}

type RecipeEditorModalProps = {
  brandId: string
  item: { id: string; name_ru: string }
  variants: { id: string; name: string }[]
  open: boolean
  onClose: () => void
  onSaved: () => void
}

type IngredientWithCost = RecipeCompositionIngredient
type SemiCatalog = RecipeCompositionSemi

function newClientKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `n-${crypto.randomUUID()}`
  }
  return `n-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function rowStorageUnit(
  row: RecipeEditorRow,
  ingById: Map<string, IngredientWithCost>,
  semiById: Map<string, SemiCatalog>,
): StorageUnit {
  if (row.type === "ingredient") {
    return ingById.get(row.ref_id)?.unit ?? "g"
  }
  if (row.type === "menu_ref") {
    return "g"
  }
  return semiById.get(row.ref_id)?.yield_unit ?? "g"
}

function rowIsSavable(
  row: RecipeEditorRow,
  comboMenuCandidates: ComboMenuCatalogRow[],
): boolean {
  if (row.type === "menu_ref") {
    if (!row.ref_id.trim()) return false
    const cand = comboMenuCandidates.find((c) => c.id === row.ref_id)
    if (!cand) return false
    if (cand.has_sizes) {
      if (!row.menu_ref_variant_id?.trim()) return false
      return cand.variants.some((v) => v.id === row.menu_ref_variant_id)
    }
    return true
  }
  if (!row.ref_id.trim()) return false
  const q = parseRecipeQtyStrict(row.quantityStr)
  return q != null && q > 0
}

function stockAvgCostFromRelation(stock: unknown): number {
  if (stock == null) return 0
  if (Array.isArray(stock)) {
    const row = stock[0] as { avg_cost?: unknown } | undefined
    return Number(row?.avg_cost ?? 0) || 0
  }
  return Number((stock as { avg_cost?: unknown }).avg_cost ?? 0) || 0
}

function calcRowCost(
  row: RecipeEditorRow,
  ctx: ProductRecipeCostContext,
): number {
  if (!row.ref_id.trim()) return 0

  if (row.type === "menu_ref") {
    return computeReferencedMenuItemRecipeCostMdl(
      row.ref_id,
      row.menu_ref_variant_id,
      ctx,
    )
  }

  const gross = parseRecipeQtyStrict(row.quantityGrossStr)
  if (gross == null || gross <= 0) return 0

  return productRecipeLineCostMdl(
    {
      ingredient_id: row.type === "ingredient" ? row.ref_id : null,
      semi_finished_id: row.type === "semi" ? row.ref_id : null,
      quantity: gross,
      quantity_gross: gross,
    },
    ctx,
  )
}

function normalizeEmbedArray<T>(raw: unknown): T[] {
  if (raw == null) return []
  if (Array.isArray(raw)) return raw as T[]
  return [raw as T]
}

function relationOne(rel: unknown): Record<string, unknown> | null {
  const rows = normalizeEmbedArray<Record<string, unknown>>(rel)
  const x = rows[0]
  return x != null && typeof x === "object" ? x : null
}

function menuRefRecipePreviewStorageKey(
  menuItemRefId: string,
  resolvedVariantId: string | null,
): string {
  return `${menuItemRefId}\u0000${resolvedVariantId ?? ""}`
}

function parseIngredientUnit(u: unknown): StorageUnit {
  const s = String(u ?? "")
  return (["g", "ml", "pcs"].includes(s) ? s : "g") as StorageUnit
}

function formatMassWithUnit(sum: number, unit: StorageUnit): string {
  const n = roundRecipeQtyNumber(sum)
  return `${formatRecipeQtyNormalized(n)} ${recipeEditorStorageUnitShort(unit)}`
}

type MenuRefRecipePreview = {
  bruttoText: string
  nettoText: string
  costText: string
  costMdlSum: number
  isRecipeEmpty: boolean
  mixedMass: boolean
}

function rawRecipeRowsToCostLines(
  menuItemId: string,
  rawRows: Record<string, unknown>[],
): ProductRecipeCostLine[] {
  return rawRows.map((line) => ({
    menu_item_id: menuItemId,
    variant_id: null,
    ingredient_id: (line.ingredient_id as string | null) ?? null,
    semi_finished_id: (line.semi_finished_id as string | null) ?? null,
    menu_item_ref_id: (line.menu_item_ref_id as string | null) ?? null,
    quantity: Number(line.quantity) || 0,
    quantity_gross:
      line.quantity_gross !== null &&
      line.quantity_gross !== undefined &&
      line.quantity_gross !== ""
        ? Number(line.quantity_gross)
        : null,
  }))
}

function computeReferencedMenuItemRecipePreview(
  menuItemId: string,
  rawRows: Record<string, unknown>[],
  ctx: ProductRecipeCostContext,
): MenuRefRecipePreview {
  const bruttoByUnit: Partial<Record<StorageUnit, number>> = {}
  const netByUnit: Partial<Record<StorageUnit, number>> = {}
  let materialLineCount = 0

  for (const line of rawRows) {
    if (line.menu_item_ref_id != null && line.menu_item_ref_id !== "") {
      continue
    }

    const ingId = line.ingredient_id
    const semiId = line.semi_finished_id
    const qtyRaw = Number(line.quantity)
    const qty = Number.isFinite(qtyRaw) ? qtyRaw : 0
    const qgRaw = line.quantity_gross
    const qgParsed =
      qgRaw !== null && qgRaw !== undefined && qgRaw !== ""
        ? Number(qgRaw)
        : NaN
    const quantityGross =
      Number.isFinite(qgParsed) ? qgParsed : null

    if (ingId) {
      const ing = relationOne(line.ingredients)
      const unit = parseIngredientUnit(ing?.unit)
      const grossAmt = recipeIngredientStockStorageQty({
        quantity: qty,
        quantity_gross: quantityGross,
      })
      bruttoByUnit[unit] = (bruttoByUnit[unit] ?? 0) + grossAmt
      netByUnit[unit] = (netByUnit[unit] ?? 0) + qty
      materialLineCount += 1
      continue
    }

    if (semiId) {
      const semi = relationOne(line.semi_finished)
      if (!semi) continue
      const yieldUnit = parseIngredientUnit(semi.yield_unit)
      const grossAmt = recipeIngredientStockStorageQty({
        quantity: qty,
        quantity_gross: quantityGross,
      })
      bruttoByUnit[yieldUnit] = (bruttoByUnit[yieldUnit] ?? 0) + grossAmt
      netByUnit[yieldUnit] = (netByUnit[yieldUnit] ?? 0) + qty
      materialLineCount += 1
    }
  }

  const costLines = rawRecipeRowsToCostLines(menuItemId, rawRows)
  const costMdlSum = computeMaterialRecipeCostMdl(costLines, ctx)

  if ((rawRows?.length ?? 0) === 0 || materialLineCount === 0) {
    return {
      bruttoText: "—",
      nettoText: "—",
      costText: "—",
      costMdlSum: 0,
      isRecipeEmpty: true,
      mixedMass: false,
    }
  }

  const orderU: StorageUnit[] = ["g", "ml", "pcs"]
  const bruttoNz = orderU.filter((u) => (bruttoByUnit[u] ?? 0) !== 0)
  const netNz = orderU.filter((u) => (netByUnit[u] ?? 0) !== 0)
  const mixedBrutto = bruttoNz.length > 1
  const mixedNet = netNz.length > 1

  const bruttoText =
    mixedBrutto || bruttoNz.length === 0
      ? "—"
      : formatMassWithUnit(bruttoByUnit[bruttoNz[0]!]!, bruttoNz[0]!)
  const nettoText =
    mixedNet || netNz.length === 0
      ? "—"
      : formatMassWithUnit(netByUnit[netNz[0]!]!, netNz[0]!)

  const costText =
    costMdlSum > 0 ? `${roundRecipeQtyNumber(costMdlSum).toFixed(2)} MDL` : "—"

  return {
    bruttoText,
    nettoText,
    costText,
    costMdlSum,
    isRecipeEmpty: false,
    mixedMass: mixedBrutto || mixedNet,
  }
}

/** Read-only суммы превью вложенного рецепта (строки «Блюдо (комбо)»). `TooltipProvider` — снаружи. */
function MenuRefTotalsReadonlyCell({
  column,
  selectionComplete,
  preview,
}: {
  column: "brutto" | "netto" | "cost"
  selectionComplete: boolean
  preview: MenuRefRecipePreview | "loading" | undefined
}) {
  if (!selectionComplete) {
    return <span className="text-muted-foreground text-sm">—</span>
  }
  if (preview === "loading") {
    return <span className="text-muted-foreground text-sm">…</span>
  }
  if (!preview) {
    return <span className="text-muted-foreground text-sm">…</span>
  }

  const text =
    column === "brutto"
      ? preview.bruttoText
      : column === "netto"
        ? preview.nettoText
        : preview.costText

  let tooltip: string | null = null
  if (
    preview.isRecipeEmpty &&
    text === "—" &&
    (column === "brutto" ||
      column === "netto" ||
      column === "cost")
  ) {
    tooltip = "Рецепт не заполнен"
  } else if (
    preview.mixedMass &&
    (column === "brutto" || column === "netto") &&
    text === "—"
  ) {
    tooltip = "Разные единицы измерения в рецепте"
  }

  const bare = (
    <span className="text-muted-foreground text-sm tabular-nums">{text}</span>
  )

  if (!tooltip) return bare

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="text-muted-foreground cursor-help text-sm tabular-nums">
          {text}
        </span>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  )
}

function readMenuRefRecipeVariantFilter(
  row: RecipeEditorRow,
  cand: ComboMenuCatalogRow | undefined,
): string | null {
  if (!cand?.has_sizes) return null
  return row.menu_ref_variant_id ?? null
}

function MenuRefPickers({
  row,
  candidates,
  disabled,
  onChangeItem,
  onChangeVariant,
}: {
  row: RecipeEditorRow
  candidates: ComboMenuCatalogRow[]
  disabled?: boolean
  onChangeItem: (menuItemId: string) => void
  onChangeVariant: (variantId: string | null) => void
}) {
  const cand = candidates.find((c) => c.id === row.ref_id)
  const showVariantSelect = Boolean(cand?.has_sizes)

  return (
    <div className="flex min-w-[12rem] flex-col gap-2 sm:flex-row sm:items-center">
      <Select
        disabled={disabled || candidates.length === 0}
        value={row.ref_id || undefined}
        onValueChange={onChangeItem}
      >
        <SelectTrigger className="h-9 w-full font-normal">
          <SelectValue placeholder="Блюдо…" />
        </SelectTrigger>
        <SelectContent>
          {candidates.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.name_ru}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {showVariantSelect ? (
        <Select
          disabled={
            disabled ||
            !row.ref_id ||
            (cand?.variants.length ?? 0) === 0
          }
          value={row.menu_ref_variant_id ?? undefined}
          onValueChange={(v) => onChangeVariant(v)}
        >
          <SelectTrigger className="h-9 w-full font-normal">
            <SelectValue placeholder={
              (cand?.variants.length ?? 0) === 0
                ? "Нет вариантов"
                : "Размер…"
            } />
          </SelectTrigger>
          <SelectContent>
            {(cand?.variants ?? []).map((v) => (
              <SelectItem key={v.id} value={v.id}>
                {v.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}
    </div>
  )
}

export function RecipeEditorModal({
  brandId,
  item,
  variants,
  open,
  onClose,
  onSaved,
}: RecipeEditorModalProps) {
  const [rows, setRows] = useState<RecipeEditorRow[]>([])
  const [ingredients, setIngredients] = useState<IngredientWithCost[]>([])
  const [semis, setSemis] = useState<SemiCatalog[]>([])
  const [comboMenuCatalog, setComboMenuCatalog] = useState<
    ComboMenuCatalogRow[]
  >([])
  const [comboMenuLoadError, setComboMenuLoadError] = useState<string | null>(
    null,
  )
  const [deletedIds, setDeletedIds] = useState<string[]>([])
  const [activeTab, setActiveTab] = useState<string>(() =>
    variants.length > 0 ? variants[0].id : BASE_TAB,
  )
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const recipeEditorOpenedItemIdRef = useRef<string | null>(null)

  /** Превью рецепта вложенного блюда (комбо) по ключу menu_item_ref + variant_filter. */
  const [menuRefRecipePreviewByKey, setMenuRefRecipePreviewByKey] = useState<
    Record<string, MenuRefRecipePreview | "loading">
  >({})
  const [brandRecipeLines, setBrandRecipeLines] = useState<
    ProductRecipeCostLine[]
  >([])

  const variantIdsKey = useMemo(
    () => variants.map((v) => v.id).join("\0"),
    [variants],
  )

  const ingById = useMemo(
    () => new Map(ingredients.map((i) => [i.id, i])),
    [ingredients],
  )
  const semiById = useMemo(
    () => new Map(semis.map((s) => [s.id, s])),
    [semis],
  )

  const menuItemsForRecipeCost = useMemo(() => {
    const map = new Map<string, { id: string; has_sizes: boolean }>()
    map.set(item.id, { id: item.id, has_sizes: variants.length > 0 })
    for (const c of comboMenuCatalog) {
      if (c.id !== item.id) {
        map.set(c.id, { id: c.id, has_sizes: c.has_sizes })
      }
    }
    return [...map.values()]
  }, [item.id, variants.length, comboMenuCatalog])

  const recipeCostCtx = useMemo((): ProductRecipeCostContext => {
    const ingredientCostById = new Map<string, number>()
    for (const ing of ingredients) {
      if (ing.avg_cost > 0) {
        ingredientCostById.set(ing.id, ing.avg_cost)
      }
    }
    const semiCostPerUnitById = new Map<string, number>()
    for (const s of semis) {
      if (s.cost_per_storage_unit != null && s.cost_per_storage_unit > 0) {
        semiCostPerUnitById.set(s.id, s.cost_per_storage_unit)
      }
    }
    return enrichProductRecipeCostContext(
      { ingredientCostById, semiCostPerUnitById },
      brandRecipeLines,
      menuItemsForRecipeCost,
    )
  }, [ingredients, semis, brandRecipeLines, menuItemsForRecipeCost])

  const comboMenuCandidates = useMemo(
    () => comboMenuCatalog.filter((m) => m.id !== item.id),
    [comboMenuCatalog, item.id],
  )

  const tabDefs = useMemo(() => {
    if (variants.length === 0) {
      return [{ value: BASE_TAB, label: "Без варианта" }]
    }
    return variants.map((v) => ({ value: v.id, label: v.name }))
  }, [variants])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const supabase = createClient()
      const [{ data: ings, error: ingErr }, { data: sfs, error: sfErr }] =
        await Promise.all([
          supabase
            .from("ingredients")
            .select("id, name, unit, waste_percent, ingredient_stock(avg_cost)")
            .order("name"),
          supabase
            .from("semi_finished")
            .select(
              "id, name, yield_qty, yield_unit, semi_finished_items!semi_finished_items_semi_finished_id_fkey(quantity, ingredient_id, semi_finished_ref_id)",
            )
            .order("name"),
        ])
      if (cancelled) return
      let parsedIngredients: IngredientWithCost[] = []
      if (!ingErr && ings) {
        parsedIngredients = (ings as {
          id: string
          name: string
          unit: string
          waste_percent?: unknown
          ingredient_stock: unknown
        }[]).map((raw) => ({
          id: raw.id,
          name: raw.name,
          unit: (["g", "ml", "pcs"].includes(raw.unit)
            ? raw.unit
            : "g") as StorageUnit,
          waste_percent: (() => {
            const w = Number(raw.waste_percent)
            return Number.isFinite(w) ? w : 0
          })(),
          avg_cost: stockAvgCostFromRelation(raw.ingredient_stock),
        }))
        setIngredients(parsedIngredients)
      }
      if (!sfErr && sfs) {
        const ingredientCostMap = new Map<string, number>()
        for (const ing of parsedIngredients) {
          if (ing.avg_cost > 0) {
            ingredientCostMap.set(ing.id, ing.avg_cost)
          }
        }
        const semiCostPerUnitById = buildSemiCostPerUnitById(
          sfs as Record<string, unknown>[],
          ingredientCostMap,
        )

        const parsedSemis: SemiCatalog[] = (sfs as Record<string, unknown>[]).map(
          (raw) => {
            const id = String(raw.id)
            const yieldQty = Number(raw.yield_qty) || 0
            const yieldUnit = (["g", "ml", "pcs"].includes(String(raw.yield_unit))
              ? raw.yield_unit
              : "g") as StorageUnit
            const cpu = semiCostPerUnitById.get(id) ?? null
            return {
              id,
              name: String(raw.name ?? ""),
              yield_qty: yieldQty,
              yield_unit: yieldUnit,
              cost_per_storage_unit: cpu,
            }
          },
        )
        setSemis(parsedSemis)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!open || !brandId) return

    let cancelled = false
    ;(async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("menu_items")
        .select(
          "id, name_ru, has_sizes, variants:menu_item_variants(id, name_ru, sort_order)",
        )
        .eq("brand_id", brandId)
        .eq("is_active", true)
        .order("sort_order", { ascending: true })

      if (cancelled) return

      if (error) {
        setComboMenuCatalog([])
        setComboMenuLoadError(error.message)
        return
      }

      setComboMenuLoadError(null)
      const parsed: ComboMenuCatalogRow[] = (data ?? []).map(
        (raw: Record<string, unknown>) => {
          const varsRaw = raw.variants
          const varsArr: Record<string, unknown>[] = Array.isArray(varsRaw)
            ? (varsRaw as Record<string, unknown>[])
            : varsRaw != null && typeof varsRaw === "object"
              ? [varsRaw as Record<string, unknown>]
              : []
          const variants = [...varsArr]
            .sort(
              (a, b) =>
                (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0),
            )
            .map((v) => ({
              id: String(v.id ?? ""),
              name: String(v.name_ru ?? "").trim() || "—",
            }))
          return {
            id: String(raw.id ?? ""),
            name_ru: String(raw.name_ru ?? "").trim() || "—",
            has_sizes: Boolean(raw.has_sizes),
            variants,
          }
        },
      )

      setComboMenuCatalog(parsed)
    })()

    return () => {
      cancelled = true
    }
  }, [open, brandId])

  useEffect(() => {
    if (!open || !brandId) {
      setBrandRecipeLines([])
      return
    }

    const menuItemIds = [
      ...new Set([
        item.id,
        ...comboMenuCatalog
          .map((c) => c.id)
          .filter((id) => id !== item.id),
      ]),
    ]
    if (menuItemIds.length === 0) {
      setBrandRecipeLines([])
      return
    }

    let cancelled = false
    ;(async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("product_recipes")
        .select(
          "menu_item_id, variant_id, ingredient_id, semi_finished_id, menu_item_ref_id, menu_item_ref_variant_id, quantity, quantity_gross",
        )
        .in("menu_item_id", menuItemIds)

      if (cancelled) return
      if (error) {
        setBrandRecipeLines([])
        return
      }
      setBrandRecipeLines((data ?? []) as ProductRecipeCostLine[])
    })()

    return () => {
      cancelled = true
    }
  }, [open, brandId, item.id, comboMenuCatalog])

  useEffect(() => {
    if (!open) {
      setMenuRefRecipePreviewByKey({})
      return
    }

    const targets: {
      key: string
      menuItemId: string
      variantFilter: string | null
    }[] = []
    const seen = new Set<string>()

    for (const row of rows) {
      if (row.type !== "menu_ref") continue
      if (!rowIsSavable(row, comboMenuCandidates)) continue
      const cand = comboMenuCandidates.find((c) => c.id === row.ref_id)
      const variantFilter = readMenuRefRecipeVariantFilter(row, cand)
      const key = menuRefRecipePreviewStorageKey(row.ref_id, variantFilter)
      if (seen.has(key)) continue
      seen.add(key)
      targets.push({
        key,
        menuItemId: row.ref_id,
        variantFilter,
      })
    }

    let cancelled = false

    if (targets.length === 0) {
      setMenuRefRecipePreviewByKey({})
      return () => {
        cancelled = true
      }
    }

    setMenuRefRecipePreviewByKey(() => {
      const next: Record<string, MenuRefRecipePreview | "loading"> = {}
      for (const t of targets) {
        next[t.key] = "loading"
      }
      return next
    })

    ;(async () => {
      const supabase = createClient()
      const results = await Promise.all(
        targets.map(async (t) => {
          let q = supabase
            .from("product_recipes")
            .select(
              "ingredient_id, semi_finished_id, menu_item_ref_id, quantity, quantity_gross, ingredients ( unit, ingredient_stock ( avg_cost ) ), semi_finished ( yield_qty, yield_unit, semi_finished_items!semi_finished_items_semi_finished_id_fkey ( quantity, ingredient_id, ingredients ( ingredient_stock ( avg_cost ) ) ) )",
            )
            .eq("menu_item_id", t.menuItemId)
          if (t.variantFilter === null) {
            q = q.is("variant_id", null)
          } else {
            q = q.eq("variant_id", t.variantFilter)
          }
          const { data, error } = await q

          if (error) {
            return {
              key: t.key,
              preview: {
                bruttoText: "—",
                nettoText: "—",
                costText: "—",
                costMdlSum: 0,
                isRecipeEmpty: true,
                mixedMass: false,
              } satisfies MenuRefRecipePreview,
            }
          }
          const rowsRaw = normalizeEmbedArray<Record<string, unknown>>(
            data ?? [],
          )
          return {
            key: t.key,
            preview: computeReferencedMenuItemRecipePreview(
              t.menuItemId,
              rowsRaw,
              recipeCostCtx,
            ),
          }
        }),
      )

      if (cancelled) return

      setMenuRefRecipePreviewByKey(() => {
        const next: Record<string, MenuRefRecipePreview | "loading"> = {}
        for (const r of results) {
          next[r.key] = r.preview
        }
        return next
      })
    })()

    return () => {
      cancelled = true
    }
  }, [open, rows, comboMenuCandidates, recipeCostCtx])

  useEffect(() => {
    if (!open) {
      recipeEditorOpenedItemIdRef.current = null
      return
    }
    if (!item.id) return
    if (recipeEditorOpenedItemIdRef.current !== item.id) {
      setDeletedIds([])
      recipeEditorOpenedItemIdRef.current = item.id
    }
  }, [open, item.id])

  useEffect(() => {
    if (!open) return
    setActiveTab(variants.length > 0 ? variants[0].id : BASE_TAB)
  }, [open, item.id, variantIdsKey])

  useEffect(() => {
    if (!open) return
    const valid = tabDefs.some((t) => t.value === activeTab)
    if (!valid) {
      setActiveTab(variants.length > 0 ? variants[0].id : BASE_TAB)
    }
  }, [open, tabDefs, activeTab, variants.length])

  useEffect(() => {
    if (!open || !item.id) return

    let cancelled = false
    setLoading(true)

    ;(async () => {
      const supabase = createClient()

      const recRes = await supabase
        .from("product_recipes")
        .select(
          "id, menu_item_id, variant_id, ingredient_id, semi_finished_id, menu_item_ref_id, menu_item_ref_variant_id, quantity, quantity_gross",
        )
        .eq("menu_item_id", item.id)

      if (cancelled) return
      setLoading(false)

      if (recRes.error) {
        setSaveError(recRes.error.message)
        setRows([])
        return
      }

      setSaveError(null)
      const nextRows: RecipeEditorRow[] = (recRes.data ?? []).map((r) => {
        const id = r.id as string
        const menuRefId = r.menu_item_ref_id as string | null | undefined
        if (menuRefId) {
          const refVar =
            (r.menu_item_ref_variant_id as string | null | undefined) ?? null
          return {
            clientKey: id,
            id,
            variant_id: (r.variant_id as string | null) ?? null,
            type: "menu_ref" as const,
            ref_id: menuRefId,
            menu_ref_variant_id: refVar,
            quantityStr: "1",
            quantityGrossStr: "1",
            _dirty: false,
          }
        }
        const ingId = r.ingredient_id as string | null
        const semiId = r.semi_finished_id as string | null
        if (ingId) {
          const netSt = Number(r.quantity)
          const grossRaw = (r as { quantity_gross?: unknown }).quantity_gross
          const grossStRaw =
            grossRaw !== null && grossRaw !== undefined && grossRaw !== ""
              ? Number(grossRaw)
              : NaN
          const grossSt = Number.isFinite(grossStRaw) ? grossStRaw : netSt
          return {
            clientKey: id,
            id,
            variant_id: (r.variant_id as string | null) ?? null,
            type: "ingredient" as const,
            ref_id: ingId,
            menu_ref_variant_id: null,
            quantityStr: formatRecipeQtyNormalized(
              Number.isFinite(netSt) ? netSt : 0,
            ),
            quantityGrossStr: formatRecipeQtyNormalized(
              Number.isFinite(grossSt) ? grossSt : 0,
            ),
            _dirty: false,
          }
        }
        const qtySt = Number(r.quantity)
        const qStr =
          semiId && Number.isFinite(qtySt)
            ? formatRecipeQtyNormalized(qtySt)
            : ""
        return {
          clientKey: id,
          id,
          variant_id: (r.variant_id as string | null) ?? null,
          type: "semi" as const,
          ref_id: semiId ?? "",
          menu_ref_variant_id: null,
          quantityStr: qStr,
          quantityGrossStr: qStr,
          _dirty: false,
        }
      })

      setRows(nextRows)
    })()

    return () => {
      cancelled = true
    }
  }, [open, item.id, ingredients, semis])

  function variantIdForTab(tab: string): string | null {
    return tab === BASE_TAB ? null : tab
  }

  function addRow() {
    setRows((prev) => [
      ...prev,
      {
        clientKey: newClientKey(),
        id: null,
        variant_id: variantIdForTab(activeTab),
        type: "ingredient",
        ref_id: "",
        menu_ref_variant_id: null,
        quantityStr: "",
        quantityGrossStr: "",
        _dirty: true,
      },
    ])
  }

  function updateRow(
    clientKey: string,
    patch: Partial<Omit<RecipeEditorRow, "clientKey">>,
  ) {
    setRows((prev) =>
      prev.map((r) =>
        r.clientKey === clientKey
          ? { ...r, ...patch, _dirty: true }
          : r,
      ),
    )
  }

  function removeRow(clientKey: string) {
    setRows((prev) => {
      const removed = prev.find((r) => r.clientKey === clientKey)
      if (removed?.id) {
        setDeletedIds((d) =>
          d.includes(removed.id!) ? d : [...d, removed.id!],
        )
      }
      return prev.filter((r) => r.clientKey !== clientKey)
    })
  }

  function setRowNetInput(clientKey: string, rawValue: string) {
    setRows((prev) =>
      prev.map((r) => {
        if (r.clientKey !== clientKey) return r
        if (r.type === "menu_ref") return r
        const patch = compositionRowNetInputState(
          {
            type: r.type,
            ref_id: r.ref_id,
            quantityStr: r.quantityStr,
            quantityGrossStr: r.quantityGrossStr,
          },
          rawValue,
          ingById,
        )
        return { ...r, ...patch, _dirty: true }
      }),
    )
  }

  function setRowGrossInput(clientKey: string, rawValue: string) {
    setRows((prev) =>
      prev.map((r) => {
        if (r.clientKey !== clientKey) return r
        if (r.type !== "ingredient") return r
        const patch = compositionRowGrossInputState(
          {
            type: r.type,
            ref_id: r.ref_id,
            quantityStr: r.quantityStr,
            quantityGrossStr: r.quantityGrossStr,
          },
          rawValue,
          ingById,
        )
        return { ...r, ...patch, _dirty: true }
      }),
    )
  }

  function blurRowNet(clientKey: string) {
    setRows((prev) =>
      prev.map((r) => {
        if (r.clientKey !== clientKey) return r
        if (r.type === "menu_ref") return r
        const patch = compositionRowNetBlurState(
          {
            type: r.type,
            ref_id: r.ref_id,
            quantityStr: r.quantityStr,
            quantityGrossStr: r.quantityGrossStr,
          },
          ingById,
        )
        return { ...r, ...patch, _dirty: true }
      }),
    )
  }

  function blurRowGross(clientKey: string) {
    setRows((prev) =>
      prev.map((r) => {
        if (r.clientKey !== clientKey || r.type !== "ingredient") return r
        const patch = compositionRowGrossBlurState(
          {
            type: r.type,
            ref_id: r.ref_id,
            quantityStr: r.quantityStr,
            quantityGrossStr: r.quantityGrossStr,
          },
          ingById,
        )
        return { ...r, ...patch, _dirty: true }
      }),
    )
  }

  async function handleSave() {
    setSaving(true)
    setSaveError(null)
    const supabase = createClient()

    try {
      for (const delId of deletedIds) {
        const { error } = await supabase
          .from("product_recipes")
          .delete()
          .eq("id", delId)
        if (error) throw new Error(error.message)
      }
      setDeletedIds([])

      const inserts: {
        menu_item_id: string
        variant_id: string | null
        ingredient_id: string | null
        semi_finished_id: string | null
        menu_item_ref_id: string | null
        menu_item_ref_variant_id: string | null
        quantity: number
        quantity_gross: number | null
      }[] = []

      for (const row of rows) {
        if (!rowIsSavable(row, comboMenuCandidates)) continue

        if (row.type === "menu_ref") {
          const cand = comboMenuCandidates.find((c) => c.id === row.ref_id)
          const refVariant =
            cand?.has_sizes ? row.menu_ref_variant_id : null
          const payload = {
            menu_item_id: item.id,
            variant_id: row.variant_id,
            ingredient_id: null as string | null,
            semi_finished_id: null as string | null,
            menu_item_ref_id: row.ref_id,
            menu_item_ref_variant_id: refVariant,
            quantity: 1,
            quantity_gross: null as number | null,
          }
          if (row.id == null) {
            inserts.push(payload)
          } else if (row._dirty) {
            const { error } = await supabase
              .from("product_recipes")
              .update({
                quantity: 1,
                quantity_gross: null,
                ingredient_id: null,
                semi_finished_id: null,
                menu_item_ref_id: payload.menu_item_ref_id,
                menu_item_ref_variant_id: payload.menu_item_ref_variant_id,
                variant_id: row.variant_id,
              })
              .eq("id", row.id)
            if (error) throw new Error(error.message)
          }
          continue
        }

        const netStorage = parseRecipeQtyStrict(row.quantityStr)
        if (netStorage == null || netStorage <= 0) continue
        let grossStorage: number | null = null
        if (row.type === "ingredient") {
          const wp = ingById.get(row.ref_id)?.waste_percent ?? 0
          const gParsed = parseRecipeQtyStrict(row.quantityGrossStr)
          if (wp > 0) {
            grossStorage =
              gParsed != null && gParsed > 0
                ? gParsed
                : roundRecipeQtyNumber(
                    netStorage / wasteYieldFactor(wp),
                  )
          } else {
            grossStorage = netStorage
          }
        }
        const payload = {
          menu_item_id: item.id,
          variant_id: row.variant_id,
          ingredient_id: row.type === "ingredient" ? row.ref_id : null,
          semi_finished_id: row.type === "semi" ? row.ref_id : null,
          menu_item_ref_id: null as string | null,
          menu_item_ref_variant_id: null as string | null,
          quantity: netStorage,
          quantity_gross: grossStorage,
        }
        if (row.id == null) {
          inserts.push(payload)
        } else if (row._dirty) {
          const { error } = await supabase
            .from("product_recipes")
            .update({
              quantity: netStorage,
              quantity_gross: grossStorage,
              ingredient_id: payload.ingredient_id,
              semi_finished_id: payload.semi_finished_id,
              menu_item_ref_id: null,
              menu_item_ref_variant_id: null,
              variant_id: row.variant_id,
            })
            .eq("id", row.id)
          if (error) throw new Error(error.message)
        }
      }

      if (inserts.length > 0) {
        const { error } = await supabase.from("product_recipes").insert(inserts)
        if (error) throw new Error(error.message)
      }

      onSaved()
      onClose()
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Ошибка сохранения")
    } finally {
      setSaving(false)
    }
  }

  const totalRecipeCost = useMemo(() => {
    const vId = activeTab === BASE_TAB ? null : activeTab
    const tabRows = rows.filter((r) =>
      vId == null ? r.variant_id == null : r.variant_id === vId,
    )
    return tabRows.reduce(
      (acc, row) => acc + calcRowCost(row, recipeCostCtx),
      0,
    )
  }, [rows, activeTab, recipeCostCtx])

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        showCloseButton
        className={cn(
          "flex max-h-[min(92vh,920px)] w-full max-w-[calc(100vw-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-6xl",
          "rounded-xl border bg-background text-foreground shadow-lg ring-1 ring-border",
        )}
      >
        <div className="shrink-0 border-b px-6 pt-6 pr-14 pb-4">
          <DialogHeader className="space-y-1 text-left">
            <DialogTitle className="text-xl font-semibold text-foreground">
              Рецепт — {item.name_ru}
            </DialogTitle>
          </DialogHeader>

          {saveError ? (
            <p className="mt-3 text-sm text-destructive">{saveError}</p>
          ) : null}
          {comboMenuLoadError ? (
            <p className="mt-3 text-sm text-destructive">
              Не удалось загрузить список блюд: {comboMenuLoadError}
            </p>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-4">
          {loading ? (
            <p className="text-muted-foreground text-sm">Загрузка…</p>
          ) : (
            <TooltipProvider delayDuration={280}>
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              {variants.length > 0 ? (
                <TabsList className="mb-4 flex h-auto w-full flex-wrap justify-start gap-1 bg-muted p-1">
                  {tabDefs.map((t) => (
                    <TabsTrigger
                      key={t.value}
                      value={t.value}
                      className="data-[state=active]:bg-[#ccff00] data-[state=active]:text-[#242424] data-[state=inactive]:text-muted-foreground"
                    >
                      {t.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              ) : null}

              {tabDefs.map((t) => {
                const rowsForTab = rows.filter((r) =>
                  t.value === BASE_TAB
                    ? r.variant_id == null
                    : r.variant_id === t.value,
                )
                return (
                  <TabsContent key={t.value} value={t.value} className="mt-0">
                    <div className="rounded-lg border">
                      <Table>
                        <TableHeader>
                          <TableRow className="hover:bg-transparent">
                            <TableHead className="w-[132px] text-muted-foreground">
                              Тип
                            </TableHead>
                            <TableHead className="min-w-[200px] text-muted-foreground">
                              Название
                            </TableHead>
                            <TableHead className="w-[132px] text-muted-foreground">
                              Брутто
                            </TableHead>
                            <TableHead className="w-[132px] text-muted-foreground">
                              Нетто
                            </TableHead>
                            <TableHead className="w-20 text-muted-foreground">
                              Ед.
                            </TableHead>
                            <TableHead className="w-24 text-right text-muted-foreground">
                              Себест.
                            </TableHead>
                            <TableHead className="w-12 text-muted-foreground" />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {rowsForTab.length === 0 ? (
                            <TableRow>
                              <TableCell
                                colSpan={7}
                                className="text-muted-foreground h-24 text-center text-sm"
                              >
                                Нет строк. Добавьте компоненты рецепта.
                              </TableCell>
                            </TableRow>
                          ) : (
                            rowsForTab.map((row) => {
                              const unit = rowStorageUnit(
                                row,
                                ingById,
                                semiById,
                              )
                              const lineCost = calcRowCost(row, recipeCostCtx)
                              const wp = ingredientWastePercentFromMaps(row, ingById)
                              const bruttoEditable =
                                row.type === "ingredient" &&
                                wp > 0 &&
                                Boolean(row.ref_id.trim())
                              const menuRefCand =
                                row.type === "menu_ref"
                                  ? comboMenuCandidates.find(
                                      (c) => c.id === row.ref_id,
                                    )
                                  : undefined
                              const menuRefSelectionComplete =
                                row.type === "menu_ref" &&
                                rowIsSavable(row, comboMenuCandidates)
                              const menuRefPreviewKeyResolved =
                                row.type === "menu_ref" &&
                                menuRefSelectionComplete
                                  ? menuRefRecipePreviewStorageKey(
                                      row.ref_id,
                                      readMenuRefRecipeVariantFilter(
                                        row,
                                        menuRefCand,
                                      ),
                                    )
                                  : null
                              const menuRefPreviewResolved =
                                menuRefPreviewKeyResolved != null
                                  ? menuRefRecipePreviewByKey[
                                      menuRefPreviewKeyResolved
                                    ]
                                  : undefined
                              return (
                                <TableRow key={row.clientKey}>
                                  <TableCell className="align-middle">
                                    <Select
                                      disabled={loading || saving}
                                      value={row.type}
                                      onValueChange={(v) => {
                                        const t = v as RecipeEditorRow["type"]
                                        updateRow(row.clientKey, {
                                          type: t,
                                          ref_id: "",
                                          menu_ref_variant_id: null,
                                          quantityStr:
                                            t === "menu_ref" ? "1" : "",
                                          quantityGrossStr:
                                            t === "menu_ref" ? "1" : "",
                                        })
                                      }}
                                    >
                                      <SelectTrigger className="h-9 w-[132px] font-normal">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="ingredient">
                                          Ингредиент
                                        </SelectItem>
                                        <SelectItem value="semi">
                                          Полуфабрикат
                                        </SelectItem>
                                        <SelectItem value="menu_ref">
                                          Блюдо (комбо)
                                        </SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </TableCell>
                                  <TableCell className="align-middle">
                                    {row.type === "menu_ref" ? (
                                      <MenuRefPickers
                                        row={row}
                                        candidates={comboMenuCandidates}
                                        disabled={loading || saving}
                                        onChangeItem={(mid) => {
                                          const c = comboMenuCandidates.find(
                                            (x) => x.id === mid,
                                          )
                                          const autoVariant =
                                            c != null &&
                                            c.has_sizes &&
                                            c.variants.length === 1
                                              ? c.variants[0].id
                                              : null
                                          updateRow(row.clientKey, {
                                            ref_id: mid,
                                            menu_ref_variant_id:
                                              c != null && !c.has_sizes
                                                ? null
                                                : autoVariant,
                                          })
                                        }}
                                        onChangeVariant={(vid) =>
                                          updateRow(row.clientKey, {
                                            menu_ref_variant_id: vid,
                                          })
                                        }
                                      />
                                    ) : (
                                      <RecipeNameCombobox
                                        row={row}
                                        ingredients={ingredients}
                                        semis={semis}
                                        onPick={(type, refId) =>
                                          updateRow(row.clientKey, {
                                            type,
                                            ref_id: refId,
                                            menu_ref_variant_id: null,
                                            quantityStr: "",
                                            quantityGrossStr: "",
                                          })
                                        }
                                      />
                                    )}
                                  </TableCell>
                                  <TableCell className="align-middle">
                                    {row.type === "menu_ref" ? (
                                      <MenuRefTotalsReadonlyCell
                                        column="brutto"
                                        selectionComplete={
                                          menuRefSelectionComplete
                                        }
                                        preview={menuRefPreviewResolved}
                                      />
                                    ) : row.type !== "ingredient" ||
                                      !bruttoEditable ? (
                                      <span className="text-muted-foreground text-sm">
                                        —
                                      </span>
                                    ) : (
                                      <Input
                                        type="text"
                                        inputMode="decimal"
                                        className="h-9 max-w-[132px]"
                                        value={row.quantityGrossStr}
                                        onChange={(e) =>
                                          setRowGrossInput(
                                            row.clientKey,
                                            e.target.value,
                                          )
                                        }
                                        onBlur={() =>
                                          blurRowGross(row.clientKey)
                                        }
                                        placeholder="0"
                                      />
                                    )}
                                  </TableCell>
                                  <TableCell className="align-middle">
                                    {row.type === "menu_ref" ? (
                                      <MenuRefTotalsReadonlyCell
                                        column="netto"
                                        selectionComplete={
                                          menuRefSelectionComplete
                                        }
                                        preview={menuRefPreviewResolved}
                                      />
                                    ) : (
                                      <Input
                                        type="text"
                                        inputMode="decimal"
                                        className="h-9 max-w-[132px]"
                                        value={row.quantityStr}
                                        onChange={(e) =>
                                          setRowNetInput(
                                            row.clientKey,
                                            e.target.value,
                                          )
                                        }
                                        onBlur={() =>
                                          blurRowNet(row.clientKey)
                                        }
                                        placeholder="0"
                                      />
                                    )}
                                  </TableCell>
                                  <TableCell className="text-muted-foreground text-sm">
                                    {row.type === "menu_ref"
                                      ? "→ рецепт"
                                      : row.ref_id
                                        ? recipeEditorStorageUnitShort(unit)
                                        : "—"}
                                  </TableCell>
                                  <TableCell className="text-right text-sm tabular-nums text-muted-foreground">
                                    {row.type === "menu_ref" ? (
                                      <MenuRefTotalsReadonlyCell
                                        column="cost"
                                        selectionComplete={
                                          menuRefSelectionComplete
                                        }
                                        preview={menuRefPreviewResolved}
                                      />
                                    ) : lineCost > 0 ? (
                                      `${lineCost.toFixed(2)} MDL`
                                    ) : (
                                      "—"
                                    )}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon-sm"
                                      className="text-muted-foreground"
                                      aria-label="Удалить строку"
                                      onClick={() =>
                                        removeRow(row.clientKey)
                                      }
                                    >
                                      <Trash2 className="size-4" />
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              )
                            })
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </TabsContent>
                )
              })}
            </Tabs>
            </TooltipProvider>
          )}

          <div className="mt-4 flex justify-end text-sm font-semibold">
            Себестоимость: {totalRecipeCost.toFixed(2)} MDL
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-4 gap-1"
            onClick={addRow}
            disabled={loading || saving}
          >
            <Plus className="size-4" />
            Добавить строку
          </Button>
        </div>

        <DialogFooter className="shrink-0 gap-2 border-t bg-muted/40 px-6 py-4 sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={saving}
          >
            Отмена
          </Button>
          <Button
            type="button"
            disabled={loading || saving}
            className="font-semibold text-[#242424] hover:bg-[#b8e600] hover:text-[#242424]"
            style={{ backgroundColor: "#ccff00" }}
            onClick={handleSave}
          >
            {saving ? "Сохранение…" : "Сохранить"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
