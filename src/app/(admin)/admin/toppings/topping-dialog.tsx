"use client"

import { useEffect, useMemo, useRef, useState, useTransition } from "react"
import { createClient } from "@/lib/supabase/client"
import type { StorageUnit } from "@/lib/inventory-units"
import type { Topping } from "@/types/database"
import type {
  RecipeCompositionIngredient,
  RecipeCompositionSemi,
} from "@/lib/recipe-composition-types"
import { wasteYieldFactor } from "@/lib/recipe-composition-waste"
import {
  formatRecipeQtyNormalized,
  parseRecipeQtyStrict,
  roundRecipeQtyNumber,
} from "@/lib/recipe-editor-qty"
import {
  createTopping,
  updateTopping,
  type ToppingRecipeLinePayload,
} from "./actions"
import { RecipeIngredientSemiCompositionTable } from "@/components/admin/menu/RecipeIngredientSemiCompositionTable"
import type { IngredientSemiCompositionRow } from "@/components/admin/menu/RecipeIngredientSemiCompositionTable"
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
import { Switch } from "@/components/ui/switch"
import { Upload } from "lucide-react"

function leiToBani(lei: number) {
  return Math.round(lei * 100)
}

function baniToLei(bani: number | null | undefined) {
  if (bani === null || bani === undefined) return ""
  return String(bani / 100)
}

function parseLei(s: string): number | null {
  const t = s.trim().replace(",", ".")
  if (!t) return null
  const n = Number(t)
  if (Number.isNaN(n)) return null
  return n
}

async function uploadFile(file: File): Promise<string> {
  const fd = new FormData()
  fd.append("file", file)
  const res = await fetch("/api/upload", { method: "POST", body: fd })
  const json = (await res.json().catch(() => ({}))) as {
    url?: string
    error?: string
  }
  if (!res.ok) throw new Error(json.error ?? res.statusText)
  if (!json.url) throw new Error("Нет URL в ответе")
  return json.url
}

function parseIngredientUnit(u: unknown): StorageUnit {
  const s = String(u ?? "")
  return (["g", "ml", "pcs"].includes(s) ? s : "g") as StorageUnit
}

function stockAvgCostFromRelation(stock: unknown): number {
  if (stock == null) return 0
  if (Array.isArray(stock)) {
    const row = stock[0] as { avg_cost?: unknown } | undefined
    return Number(row?.avg_cost ?? 0) || 0
  }
  return Number((stock as { avg_cost?: unknown }).avg_cost ?? 0) || 0
}

function buildToppingRecipePayload(
  rows: IngredientSemiCompositionRow[],
  ingById: Map<string, RecipeCompositionIngredient>,
): ToppingRecipeLinePayload[] {
  const out: ToppingRecipeLinePayload[] = []
  for (const row of rows) {
    if (!row.ref_id.trim()) continue
    const netStorage = parseRecipeQtyStrict(row.quantityStr)
    if (netStorage == null || netStorage <= 0) continue
    if (row.type === "ingredient") {
      const wp = ingById.get(row.ref_id)?.waste_percent ?? 0
      let grossStorage: number | null = null
      if (wp > 0) {
        const gParsed = parseRecipeQtyStrict(row.quantityGrossStr)
        grossStorage =
          gParsed != null && gParsed > 0
            ? gParsed
            : roundRecipeQtyNumber(netStorage / wasteYieldFactor(wp))
      } else {
        grossStorage = netStorage
      }
      out.push({
        ingredient_id: row.ref_id,
        semi_finished_id: null,
        quantity: netStorage,
        quantity_gross: grossStorage,
      })
    } else {
      out.push({
        ingredient_id: null,
        semi_finished_id: row.ref_id,
        quantity: netStorage,
        quantity_gross: null,
      })
    }
  }
  return out
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: "create" | "edit"
  groupId: string | null
  topping: Topping | null
}

export function ToppingDialog({
  open,
  onOpenChange,
  mode,
  groupId,
  topping,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [imageUrl, setImageUrl] = useState("")
  const [nameRu, setNameRu] = useState("")
  const [nameRo, setNameRo] = useState("")
  const [priceLei, setPriceLei] = useState("")
  const [sortOrder, setSortOrder] = useState(0)
  const [isActive, setIsActive] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [pending, startTransition] = useTransition()

  const [ingredientsCatalog, setIngredientsCatalog] = useState<
    RecipeCompositionIngredient[]
  >([])
  const [semisCatalog, setSemisCatalog] = useState<RecipeCompositionSemi[]>([])
  const [catalogError, setCatalogError] = useState<string | null>(null)
  const [recipeLoadError, setRecipeLoadError] = useState<string | null>(null)
  const [recipeRows, setRecipeRows] = useState<IngredientSemiCompositionRow[]>(
    [],
  )

  useEffect(() => {
    if (!open) {
      setIngredientsCatalog([])
      setSemisCatalog([])
      setCatalogError(null)
      setRecipeLoadError(null)
      setRecipeRows([])
      return
    }
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
            .select("id, name, yield_qty, yield_unit")
            .order("name"),
        ])
      if (cancelled) return
      if (ingErr || sfErr) {
        setCatalogError(ingErr?.message ?? sfErr?.message ?? "Ошибка загрузки")
        return
      }
      setCatalogError(null)
      const ingList: RecipeCompositionIngredient[] = (ings ?? []).map(
        (raw: Record<string, unknown>) => ({
          id: String(raw.id),
          name: String(raw.name),
          unit: parseIngredientUnit(raw.unit),
          waste_percent: (() => {
            const w = Number(raw.waste_percent)
            return Number.isFinite(w) ? w : 0
          })(),
          avg_cost: stockAvgCostFromRelation(raw.ingredient_stock),
        }),
      )
      const semiList: RecipeCompositionSemi[] = (sfs ?? []).map(
        (raw: Record<string, unknown>) => ({
          id: String(raw.id),
          name: String(raw.name),
          yield_qty: Number(raw.yield_qty) || 0,
          yield_unit: parseIngredientUnit(raw.yield_unit),
        }),
      )
      setIngredientsCatalog(ingList)
      setSemisCatalog(semiList)
    })()
    return () => {
      cancelled = true
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    if (mode === "edit" && topping) {
      setImageUrl(topping.image_url ?? "")
      setNameRu(topping.name_ru ?? "")
      setNameRo(topping.name_ro ?? "")
      setPriceLei(baniToLei(topping.price))
      setSortOrder(topping.sort_order)
      setIsActive(topping.is_active)
    } else {
      setImageUrl("")
      setNameRu("")
      setNameRo("")
      setPriceLei("")
      setSortOrder(0)
      setIsActive(true)
      setRecipeRows([])
    }
  }, [open, mode, topping])

  useEffect(() => {
    if (!open || mode !== "edit" || !topping) {
      return
    }
    let cancelled = false
    setRecipeLoadError(null)
    ;(async () => {
      const supabase = createClient()
      const { data, error } = await (supabase.from("topping_recipes") as any)
        .select("id, ingredient_id, semi_finished_id, quantity, quantity_gross")
        .eq("topping_id", topping.id)
      if (cancelled) return
      if (error) {
        setRecipeLoadError(error.message)
        setRecipeRows([])
        return
      }
      const list = (data ?? []) as Record<string, unknown>[]
      const mapped: IngredientSemiCompositionRow[] = list.map((r) => {
        const id = String(r.id)
        const ingId = r.ingredient_id as string | null
        const semiId = r.semi_finished_id as string | null
        const net = Number(r.quantity)
        const grossRaw = r.quantity_gross
        const grossStRaw =
          grossRaw !== null && grossRaw !== undefined && grossRaw !== ""
            ? Number(grossRaw)
            : NaN
        const grossSt = Number.isFinite(grossStRaw) ? grossStRaw : net
        if (ingId) {
          return {
            clientKey: `e-${id}`,
            type: "ingredient" as const,
            ref_id: ingId,
            quantityStr: formatRecipeQtyNormalized(
              Number.isFinite(net) ? net : 0,
            ),
            quantityGrossStr: formatRecipeQtyNormalized(
              Number.isFinite(grossSt) ? grossSt : 0,
            ),
          }
        }
        const qtySt = Number(r.quantity)
        const qStr =
          semiId && Number.isFinite(qtySt)
            ? formatRecipeQtyNormalized(qtySt)
            : ""
        return {
          clientKey: `e-${id}`,
          type: "semi" as const,
          ref_id: semiId ?? "",
          quantityStr: qStr,
          quantityGrossStr: qStr,
        }
      })
      setRecipeRows(mapped)
    })()
    return () => {
      cancelled = true
    }
  }, [open, mode, topping?.id])

  const ingById = useMemo(
    () => new Map(ingredientsCatalog.map((i) => [i.id, i])),
    [ingredientsCatalog],
  )

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const url = await uploadFile(file)
      setImageUrl(url)
    } catch (err) {
      alert(err instanceof Error ? err.message : "Ошибка загрузки")
    } finally {
      setUploading(false)
      e.target.value = ""
    }
  }

  function handleSave() {
    const gid = groupId
    if (!gid) return
    const ru = (nameRu ?? "").trim()
    const ro = (nameRo ?? "").trim()
    if (!ru || !ro) return
    const lei = parseLei(priceLei)
    if (lei === null) {
      alert("Укажите цену в леях")
      return
    }
    const price = leiToBani(lei)
    const recipe_lines = buildToppingRecipePayload(recipeRows, ingById)
    const payload = {
      group_id: gid,
      name_ru: ru,
      name_ro: ro,
      price,
      sort_order: sortOrder,
      is_active: isActive,
      image_url: imageUrl.trim() || null,
      recipe_lines,
    }
    startTransition(async () => {
      try {
        if (mode === "create") {
          await createTopping(payload)
        } else if (topping) {
          await updateTopping(topping.id, payload)
        }
        onOpenChange(false)
      } catch (e) {
        alert(e instanceof Error ? e.message : "Ошибка сохранения")
      }
    })
  }

  const canSave =
    !!groupId &&
    !!(nameRu ?? "").trim() &&
    !!(nameRo ?? "").trim() &&
    parseLei(priceLei) !== null &&
    !catalogError &&
    !pending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(92vh,880px)] w-full max-w-[calc(100vw-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <div className="shrink-0 border-b px-6 pt-6 pb-4">
          <DialogHeader>
            <DialogTitle>
              {mode === "create" ? "Новый топпинг" : "Редактировать топпинг"}
            </DialogTitle>
          </DialogHeader>
          {catalogError ? (
            <p className="mt-2 text-sm text-destructive">{catalogError}</p>
          ) : null}
          {recipeLoadError ? (
            <p className="mt-2 text-sm text-destructive">
              Состав: {recipeLoadError}
            </p>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>Фото</Label>
              <div
                className="mx-auto w-full max-w-[200px] overflow-hidden rounded-md bg-transparent"
                style={{ aspectRatio: "1 / 1" }}
              >
                {imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={imageUrl}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-muted-foreground flex h-full min-h-[120px] items-center justify-center rounded-md border border-dashed border-border text-xs">
                    нет фото
                  </span>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageUpload}
              />
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2"
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-4 w-4" />
                  {uploading ? "Загрузка..." : "Загрузить фото"}
                </Button>
                {imageUrl ? (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setImageUrl("")}
                  >
                    Удалить
                  </Button>
                ) : null}
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="tp-name-ru">Название (RU)</Label>
              <Input
                id="tp-name-ru"
                value={nameRu}
                onChange={(e) => setNameRu(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="tp-name-ro">Название (RO)</Label>
              <Input
                id="tp-name-ro"
                value={nameRo}
                onChange={(e) => setNameRo(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="tp-price">Цена (лей)</Label>
              <Input
                id="tp-price"
                type="text"
                inputMode="decimal"
                value={priceLei}
                onChange={(e) => setPriceLei(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="tp-sort">Порядок</Label>
              <Input
                id="tp-sort"
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(Number(e.target.value) || 0)}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="tp-active"
                checked={isActive}
                onCheckedChange={setIsActive}
              />
              <Label htmlFor="tp-active">Активен</Label>
            </div>

            <RecipeIngredientSemiCompositionTable
              rows={recipeRows}
              onRowsChange={setRecipeRows}
              ingredients={ingredientsCatalog}
              semis={semisCatalog}
              disabled={!!catalogError || pending}
            />
          </div>
        </div>

        <DialogFooter className="shrink-0 gap-2 border-t bg-muted/40 px-6 py-4 sm:justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button onClick={handleSave} disabled={!canSave}>
            {pending ? "Сохранение..." : "Сохранить"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
