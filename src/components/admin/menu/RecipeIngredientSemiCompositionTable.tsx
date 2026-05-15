"use client"

import { useMemo } from "react"
import type {
  RecipeCompositionIngredient,
  RecipeCompositionSemi,
} from "@/lib/recipe-composition-types"
import {
  compositionRowGrossBlurState,
  compositionRowGrossInputState,
  compositionRowNetBlurState,
  compositionRowNetInputState,
  compositionRowStorageUnit,
  ingredientWastePercentFromMaps,
} from "@/lib/recipe-composition-row-updates"
import { parseRecipeQtyStrict, recipeEditorStorageUnitShort } from "@/lib/recipe-editor-qty"
import { RecipeNameCombobox } from "@/components/admin/menu/RecipeNameCombobox"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Plus, Trash2 } from "lucide-react"

export type IngredientSemiCompositionRow = {
  clientKey: string
  type: "ingredient" | "semi"
  ref_id: string
  quantityStr: string
  quantityGrossStr: string
}

function calcIngredientLineCostLei(
  row: IngredientSemiCompositionRow,
  ingredients: RecipeCompositionIngredient[],
): number {
  if (row.type !== "ingredient" || !row.ref_id) return 0
  const ing = ingredients.find((i) => i.id === row.ref_id)
  if (!ing || !ing.avg_cost) return 0
  const gross = parseRecipeQtyStrict(row.quantityGrossStr)
  if (gross == null || gross <= 0) return 0
  return gross * ing.avg_cost
}

export function RecipeIngredientSemiCompositionTable({
  rows,
  onRowsChange,
  ingredients,
  semis,
  disabled,
  addRowLabel = "+ Добавить строку",
}: {
  rows: IngredientSemiCompositionRow[]
  onRowsChange: (next: IngredientSemiCompositionRow[]) => void
  ingredients: RecipeCompositionIngredient[]
  semis: RecipeCompositionSemi[]
  disabled?: boolean
  addRowLabel?: string
}) {
  const ingById = useMemo(
    () => new Map(ingredients.map((i) => [i.id, i])),
    [ingredients],
  )
  const ingByIdWaste = useMemo(
    () =>
      new Map(
        ingredients.map((i) => [i.id, { waste_percent: i.waste_percent }]),
      ),
    [ingredients],
  )
  const semiById = useMemo(() => new Map(semis.map((s) => [s.id, s])), [semis])

  function updateRow(
    clientKey: string,
    patch: Partial<IngredientSemiCompositionRow>,
  ) {
    onRowsChange(
      rows.map((r) =>
        r.clientKey === clientKey ? { ...r, ...patch } : r,
      ),
    )
  }

  function removeRow(clientKey: string) {
    onRowsChange(rows.filter((r) => r.clientKey !== clientKey))
  }

  function setRowNetInput(clientKey: string, rawValue: string) {
    onRowsChange(
      rows.map((r) => {
        if (r.clientKey !== clientKey) return r
        const patch = compositionRowNetInputState(
          r,
          rawValue,
          ingByIdWaste,
        )
        return { ...r, ...patch }
      }),
    )
  }

  function setRowGrossInput(clientKey: string, rawValue: string) {
    onRowsChange(
      rows.map((r) => {
        if (r.clientKey !== clientKey) return r
        const patch = compositionRowGrossInputState(
          r,
          rawValue,
          ingByIdWaste,
        )
        return { ...r, ...patch }
      }),
    )
  }

  function blurRowNet(clientKey: string) {
    onRowsChange(
      rows.map((r) => {
        if (r.clientKey !== clientKey) return r
        const patch = compositionRowNetBlurState(r, ingByIdWaste)
        return { ...r, ...patch }
      }),
    )
  }

  function blurRowGross(clientKey: string) {
    onRowsChange(
      rows.map((r) => {
        if (r.clientKey !== clientKey) return r
        const patch = compositionRowGrossBlurState(r, ingByIdWaste)
        return { ...r, ...patch }
      }),
    )
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium">Состав</h3>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[132px] text-muted-foreground">Тип</TableHead>
              <TableHead className="min-w-[200px] text-muted-foreground">
                Название
              </TableHead>
              <TableHead className="w-[132px] text-muted-foreground">
                Брутто
              </TableHead>
              <TableHead className="w-[132px] text-muted-foreground">
                Нетто
              </TableHead>
              <TableHead className="w-20 text-muted-foreground">Ед.</TableHead>
              <TableHead className="w-24 text-right text-muted-foreground">
                Себест.
              </TableHead>
              <TableHead className="w-12 text-muted-foreground" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-muted-foreground h-16 text-center text-sm"
                >
                  Списание не настроено
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => {
                const unit = compositionRowStorageUnit(row, ingById, semiById)
                const lineCost = calcIngredientLineCostLei(row, ingredients)
                const wp = ingredientWastePercentFromMaps(row, ingByIdWaste)
                const bruttoEditable =
                  row.type === "ingredient" && wp > 0 && Boolean(row.ref_id.trim())
                return (
                  <TableRow key={row.clientKey}>
                    <TableCell className="align-middle">
                      <Select
                        disabled={disabled}
                        value={row.type}
                        onValueChange={(v) => {
                          const t = v as "ingredient" | "semi"
                          updateRow(row.clientKey, {
                            type: t,
                            ref_id: "",
                            quantityStr: "",
                            quantityGrossStr: "",
                          })
                        }}
                      >
                        <SelectTrigger className="h-9 w-[132px] font-normal">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ingredient">Ингредиент</SelectItem>
                          <SelectItem value="semi">Полуфабрикат</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="align-middle">
                      <RecipeNameCombobox
                        row={row}
                        ingredients={ingredients}
                        semis={semis}
                        disabled={disabled}
                        onPick={(type, refId) => {
                          updateRow(row.clientKey, {
                            type,
                            ref_id: refId,
                            quantityStr: "",
                            quantityGrossStr: "",
                          })
                        }}
                      />
                    </TableCell>
                    <TableCell className="align-middle">
                      {row.type !== "ingredient" || !bruttoEditable ? (
                        <span className="text-muted-foreground text-sm">—</span>
                      ) : (
                        <Input
                          type="text"
                          inputMode="decimal"
                          className="h-9 max-w-[132px]"
                          value={row.quantityGrossStr}
                          onChange={(e) =>
                            setRowGrossInput(row.clientKey, e.target.value)
                          }
                          onBlur={() => blurRowGross(row.clientKey)}
                          placeholder="0"
                          disabled={disabled}
                        />
                      )}
                    </TableCell>
                    <TableCell className="align-middle">
                      <Input
                        type="text"
                        inputMode="decimal"
                        className="h-9 max-w-[132px]"
                        value={row.quantityStr}
                        onChange={(e) =>
                          setRowNetInput(row.clientKey, e.target.value)
                        }
                        onBlur={() => blurRowNet(row.clientKey)}
                        placeholder="0"
                        disabled={disabled}
                      />
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {row.ref_id
                        ? recipeEditorStorageUnitShort(unit)
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums text-muted-foreground">
                      {lineCost > 0 ? `${lineCost.toFixed(2)} MDL` : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="text-muted-foreground"
                        aria-label="Удалить строку"
                        disabled={disabled}
                        onClick={() => removeRow(row.clientKey)}
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
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-1"
        disabled={disabled}
        onClick={() =>
          onRowsChange([
            ...rows,
            {
              clientKey: `n-${
                typeof crypto !== "undefined" && "randomUUID" in crypto
                  ? crypto.randomUUID()
                  : String(Date.now())
              }`,
              type: "ingredient",
              ref_id: "",
              quantityStr: "",
              quantityGrossStr: "",
            },
          ])
        }
      >
        <Plus className="size-4" />
        {addRowLabel}
      </Button>
    </div>
  )
}
