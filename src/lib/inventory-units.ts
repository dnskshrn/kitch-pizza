export type StorageUnit = "g" | "ml" | "pcs"

export function displayUnit(unit: StorageUnit): string {
  return unit === "g" ? "кг" : unit === "ml" ? "л" : "шт"
}

/** DB grams/ml → display kg/L */
export function toDisplayQty(value: number, unit: StorageUnit): number {
  return unit === "pcs" ? value : value / 1000
}

/** User input kg/L → DB grams/ml */
export function toStorageQty(value: number, unit: StorageUnit): number {
  return unit === "pcs" ? value : value * 1000
}

/** DB price per g/ml → display price per kg/L */
export function toDisplayPrice(pricePerUnit: number, unit: StorageUnit): number {
  return unit === "pcs" ? pricePerUnit : pricePerUnit * 1000
}

/** User input price per kg/L → DB price per g/ml */
export function toStoragePrice(pricePerUnit: number, unit: StorageUnit): number {
  return unit === "pcs" ? pricePerUnit : pricePerUnit / 1000
}
