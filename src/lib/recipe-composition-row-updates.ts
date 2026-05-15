import type { StorageUnit } from "@/lib/inventory-units"
import {
  formatRecipeQtyNormalized,
  normalizeRecipeQtyInputBlur,
  roundRecipeQtyNumber,
} from "@/lib/recipe-editor-qty"
import { wasteYieldFactor } from "@/lib/recipe-composition-waste"

export type CompositionQtyRowShape = {
  type: "ingredient" | "semi"
  ref_id: string
  quantityStr: string
  quantityGrossStr: string
}

export function ingredientWastePercentFromMaps(
  row: { type: string; ref_id: string },
  ingById: Map<string, { waste_percent: number }>,
): number {
  if (row.type !== "ingredient" || !row.ref_id.trim()) return 0
  const w = ingById.get(row.ref_id)?.waste_percent
  return typeof w === "number" && Number.isFinite(w) ? w : 0
}

export function compositionRowStorageUnit(
  row: CompositionQtyRowShape,
  ingById: Map<string, { unit: StorageUnit }>,
  semiById: Map<string, { yield_unit: StorageUnit }>,
): StorageUnit {
  if (row.type === "ingredient") {
    return ingById.get(row.ref_id)?.unit ?? "g"
  }
  return semiById.get(row.ref_id)?.yield_unit ?? "g"
}

export function compositionRowNetInputState(
  prev: CompositionQtyRowShape,
  rawValue: string,
  ingById: Map<string, { waste_percent: number }>,
): Pick<CompositionQtyRowShape, "quantityStr" | "quantityGrossStr"> {
  const nextQty = rawValue
  const trimmed = rawValue.trim()
  if (trimmed === "") {
    return { quantityStr: nextQty, quantityGrossStr: "" }
  }
  const net = Number.parseFloat(rawValue.replace(",", "."))
  if (!Number.isFinite(net)) {
    return { quantityStr: nextQty, quantityGrossStr: prev.quantityGrossStr }
  }
  if (prev.type === "semi") {
    return { quantityStr: nextQty, quantityGrossStr: rawValue }
  }
  const wp = ingById.get(prev.ref_id)?.waste_percent ?? 0
  if (!(wp > 0)) {
    return { quantityStr: nextQty, quantityGrossStr: rawValue }
  }
  const grossNum = roundRecipeQtyNumber(net / wasteYieldFactor(wp))
  return { quantityStr: nextQty, quantityGrossStr: String(grossNum) }
}

export function compositionRowGrossInputState(
  prev: CompositionQtyRowShape,
  rawValue: string,
  ingById: Map<string, { waste_percent: number }>,
): Pick<CompositionQtyRowShape, "quantityStr" | "quantityGrossStr"> {
  if (prev.type !== "ingredient") {
    return {
      quantityStr: prev.quantityStr,
      quantityGrossStr: prev.quantityGrossStr,
    }
  }
  const nextGross = rawValue
  const next: Pick<CompositionQtyRowShape, "quantityStr" | "quantityGrossStr"> =
    {
      quantityStr: prev.quantityStr,
      quantityGrossStr: nextGross,
    }
  if (rawValue.trim() === "") {
    return { quantityStr: "", quantityGrossStr: nextGross }
  }
  const gross = Number.parseFloat(rawValue.replace(",", "."))
  if (!Number.isFinite(gross)) {
    return next
  }
  const wp = ingById.get(prev.ref_id)?.waste_percent ?? 0
  if (!(wp > 0)) return next
  const netNum = roundRecipeQtyNumber(gross * wasteYieldFactor(wp))
  return { quantityStr: String(netNum), quantityGrossStr: nextGross }
}

export function compositionRowNetBlurState(
  prev: CompositionQtyRowShape,
  ingById: Map<string, { waste_percent: number }>,
): Pick<CompositionQtyRowShape, "quantityStr" | "quantityGrossStr"> {
  const norm = normalizeRecipeQtyInputBlur(prev.quantityStr)
  if (prev.type === "semi") {
    return { quantityStr: norm, quantityGrossStr: norm }
  }
  const wp = ingById.get(prev.ref_id)?.waste_percent ?? 0
  if (!(wp > 0)) {
    return { quantityStr: norm, quantityGrossStr: norm }
  }
  if (norm === "") {
    return { quantityStr: "", quantityGrossStr: "" }
  }
  const net = Number.parseFloat(norm.replace(",", "."))
  if (!Number.isFinite(net)) {
    return { quantityStr: norm, quantityGrossStr: prev.quantityGrossStr }
  }
  const grossNum = roundRecipeQtyNumber(net / wasteYieldFactor(wp))
  return {
    quantityStr: norm,
    quantityGrossStr: formatRecipeQtyNormalized(grossNum),
  }
}

export function compositionRowGrossBlurState(
  prev: CompositionQtyRowShape,
  ingById: Map<string, { waste_percent: number }>,
): Pick<CompositionQtyRowShape, "quantityStr" | "quantityGrossStr"> {
  if (prev.type !== "ingredient") {
    return {
      quantityStr: prev.quantityStr,
      quantityGrossStr: prev.quantityGrossStr,
    }
  }
  const wp = ingById.get(prev.ref_id)?.waste_percent ?? 0
  if (!(wp > 0)) {
    return { quantityStr: prev.quantityStr, quantityGrossStr: prev.quantityGrossStr }
  }
  const norm = normalizeRecipeQtyInputBlur(prev.quantityGrossStr)
  if (norm === "") {
    return { quantityStr: "", quantityGrossStr: "" }
  }
  const gross = Number.parseFloat(norm.replace(",", "."))
  if (!Number.isFinite(gross)) {
    return { quantityStr: prev.quantityStr, quantityGrossStr: norm }
  }
  const netNum = roundRecipeQtyNumber(gross * wasteYieldFactor(wp))
  return {
    quantityStr: formatRecipeQtyNormalized(netNum),
    quantityGrossStr: norm,
  }
}
