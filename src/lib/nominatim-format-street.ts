/**
 * Краткая строка для инпута: улица + дом (как в UI), на основе полей Nominatim.
 */

const ROAD_KEYS = [
  "road",
  "pedestrian",
  "path",
  "footway",
  "residential",
  "living_street",
] as const

function abbreviateRoad(road: string): string {
  const trimmed = road.trim()
  const rules: [RegExp, string][] = [
    [/^Bulevardul\s+/i, "bd. "],
    [/^Bulevard\s+/i, "bd. "],
    [/^Strada\s+/i, "str. "],
    [/^Str\.\s*/i, "str. "],
    [/^Piața\s+/i, "p-ța "],
    [/^Piata\s+/i, "p-ța "],
    [/^Calea\s+/i, "calea "],
    [/^Aleea\s+/i, "aleea "],
    [/^Splaiul\s+/i, "splaiul "],
  ]
  for (const [re, rep] of rules) {
    if (re.test(trimmed)) return trimmed.replace(re, rep)
  }
  return trimmed
}

function looksLikeHouseNumber(s: string): boolean {
  const t = s.trim()
  return /^\d+([\/\-]\d+)?[a-zA-Z]?$/.test(t) || /^\d+\s/.test(t)
}

/** Разбор display_name: часто «номер, улица, район…» или «улица, номер…». */
function fallbackFromDisplayName(displayName: string): string | null {
  const parts = displayName
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean)
  if (parts.length < 2) return parts[0] ?? null

  const [a, b] = parts
  const aNum = looksLikeHouseNumber(a) && !looksLikeHouseNumber(b)
  const bNum = looksLikeHouseNumber(b) && !looksLikeHouseNumber(a)

  if (aNum) return `${abbreviateRoad(b)} ${a}`.replace(/\s+/g, " ").trim()
  if (bNum) return `${abbreviateRoad(a)} ${b}`.replace(/\s+/g, " ").trim()
  return `${abbreviateRoad(a)} ${b}`.replace(/\s+/g, " ").trim()
}

export function formatStreetLineFromNominatim(
  address: Record<string, string | undefined> | undefined,
  displayNameFallback: string,
): string {
  if (!address) {
    return fallbackFromDisplayName(displayNameFallback) ?? displayNameFallback
  }

  let road: string | undefined
  for (const key of ROAD_KEYS) {
    const v = address[key]
    if (v?.trim()) {
      road = v.trim()
      break
    }
  }

  const hn = address.house_number?.trim()

  if (road && hn) return `${abbreviateRoad(road)} ${hn}`.replace(/\s+/g, " ").trim()
  if (road) return abbreviateRoad(road)
  if (hn) return hn

  return fallbackFromDisplayName(displayNameFallback) ?? displayNameFallback
}
