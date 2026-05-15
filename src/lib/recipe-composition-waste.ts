/** Коэффициент: нетто / брутто при заданных % потерь (0–100). */
export function wasteYieldFactor(wastePercent: number): number {
  const w = Math.min(100, Math.max(0, wastePercent))
  return Math.max(1e-9, 1 - w / 100)
}
