import type { DeliveryZone } from "@/types/database"

/**
 * Ray-casting: точка [lat, lng] внутри полигона.
 * `polygon` — последовательность [lat, lng]; первая и последняя точки могут совпадать.
 */
export function isPointInPolygon(
  lat: number,
  lng: number,
  polygon: [number, number][],
): boolean {
  if (polygon.length < 3) return false

  let inside = false

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const latI = polygon[i][0]
    const lngI = polygon[i][1]
    const latJ = polygon[j][0]
    const lngJ = polygon[j][1]
    const denom = latJ - latI
    if (denom === 0) continue

    const crosses =
      (latI > lat) !== (latJ > lat) &&
      lng < ((lngJ - lngI) * (lat - latI)) / denom + lngI

    if (crosses) inside = !inside
  }

  return inside
}

/** Активные зоны должны быть отсортированы по `sort_order` по возрастанию. */
export function findZoneForPoint(
  lat: number,
  lng: number,
  zones: DeliveryZone[],
): DeliveryZone | null {
  for (const z of zones) {
    if (!z.is_active) continue
    if (!Array.isArray(z.polygon) || z.polygon.length < 3) continue
    if (isPointInPolygon(lat, lng, z.polygon)) {
      return z
    }
  }
  return null
}
