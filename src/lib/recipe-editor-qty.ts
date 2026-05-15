import type { StorageUnit } from "@/lib/inventory-units"

/** Подпись единицы в техкартах / полуфабрикатах: хранение г / мл / шт без конвертации в кг / л. */
export function recipeEditorStorageUnitShort(unit: StorageUnit): string {
  return unit === "g" ? "г" : unit === "ml" ? "мл" : "шт"
}

export function roundRecipeQtyNumber(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 1e6) / 1e6
}

/** Короткая строка для числа из БД в инпут рецепта. */
export function formatRecipeQtyNormalized(n: number): string {
  if (!Number.isFinite(n)) return ""
  const r = roundRecipeQtyNumber(n)
  if (Number.isInteger(r)) return String(r)
  const s = r.toFixed(6).replace(/\.?0+$/, "")
  return s === "-0" ? "0" : s
}

/** onBlur: пусто или не число → "". */
export function normalizeRecipeQtyInputBlur(raw: string): string {
  const t = raw.trim().replace(",", ".")
  if (t === "") return ""
  const n = Number.parseFloat(t)
  if (!Number.isFinite(n)) return ""
  return formatRecipeQtyNormalized(n)
}

/** Для сохранения: пустая или мусор → null. */
export function parseRecipeQtyStrict(raw: string): number | null {
  const t = raw.trim().replace(",", ".")
  if (t === "") return null
  const n = Number.parseFloat(t)
  return Number.isFinite(n) ? n : null
}
