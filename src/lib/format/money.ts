export function fmtMdl(bani: number, opts?: { sign?: boolean }): string {
  const mdl = bani / 100
  const formatted = new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(mdl))
  if (opts?.sign && bani !== 0) {
    return (bani > 0 ? "+" : "−") + formatted
  }
  return formatted
}

export function fmtMdlWithUnit(
  bani: number,
  opts?: { sign?: boolean },
): string {
  return `${fmtMdl(bani, opts)} MDL`
}

export function discrepancyTextClass(absMdl: number): string {
  if (absMdl <= 5) return "text-muted-foreground"
  if (absMdl <= 50) return "text-amber-600"
  return "text-red-600"
}
