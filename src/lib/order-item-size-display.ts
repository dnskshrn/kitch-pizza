/**
 * Подпись размера в UI списков: исторические строки `'s'` / `'l'` — в верхнем регистре,
 * текстовые снимки варианта — как сохранены.
 */
export function orderItemSizeDisplayLabel(size: string | null | undefined): string {
  const t = (size ?? "").trim()
  if (!t) return ""
  const lower = t.toLowerCase()
  if (lower === "s" || lower === "l") {
    return lower === "s" ? "S" : "L"
  }
  return t
}
