/** Нормализация номера diversion / called / to к ключу маппинга (как в legacy pbx-webhook). */
export function normalizeDiversionDigits(input: string): string {
  const noSpace = input.replace(/\s+/g, "")
  let d = noSpace.replace(/\D/g, "")
  if (d.startsWith("373")) d = d.slice(3)
  if (d.startsWith("0")) d = d.slice(1)
  return d
}

const DIVERSION_DIGITS_TO_BRAND_SLUG: Record<string, string> = {
  "79700290": "kitch-pizza",
  "79200190": "losos",
  "79200120": "the-spot",
}

export function brandSlugFromDiversionDigits(digits: string): string | null {
  return DIVERSION_DIGITS_TO_BRAND_SLUG[digits] ?? null
}

/** Поле «на какой номер звонят» в теле webhook ОАТС. */
export function diversionFieldFromPbxBody(
  body: Record<string, unknown>,
): string | null {
  for (const key of ["diversion", "called", "to"] as const) {
    const v = body[key]
    if (typeof v === "string" && v.trim()) return v.trim()
  }
  return null
}

export function brandSlugFromPbxBody(
  body: Record<string, unknown>,
): string | null {
  const raw = diversionFieldFromPbxBody(body)
  if (!raw) return null
  const digits = normalizeDiversionDigits(raw)
  if (!digits) return null
  return brandSlugFromDiversionDigits(digits) ?? null
}
