import type { DeliveryZone, DeliveryZoneSchedule } from '@/types/database'

export type ZoneWithSchedules = DeliveryZone & {
  delivery_zone_schedules?: DeliveryZoneSchedule[]
}

// ─── Timezone helper ───────────────────────────────────────────────────────

function getChisinauMinutes(): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Chisinau',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(new Date())
  const h = parseInt(parts.find(p => p.type === 'hour')!.value, 10)
  const m = parseInt(parts.find(p => p.type === 'minute')!.value, 10)
  return h * 60 + m
}

function parseHHMM(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function minutesInWindow(from: number, to: number, current: number): boolean {
  if (from < to) return current >= from && current < to      // same-day
  return current >= from || current < to                     // crosses midnight
}

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Returns the active schedule for a zone at the current Chisinau time,
 * or null if no schedule matches (zone should be hidden / use base params).
 *
 * If a zone has NO schedules at all, pass an empty array →
 * caller should fall back to the zone's own base columns.
 */
export function getActiveSchedule(
  schedules: DeliveryZoneSchedule[],
): DeliveryZoneSchedule | null {
  if (schedules.length === 0) return null
  const now = getChisinauMinutes()
  const sorted = [...schedules].sort((a, b) => a.sort_order - b.sort_order)
  return sorted.find(s =>
    minutesInWindow(parseHHMM(s.from_time), parseHHMM(s.to_time), now)
  ) ?? null
}

/**
 * Returns true when the zone is available right now.
 * - Zone with no schedules → always available.
 * - Zone with schedules    → only if getActiveSchedule returns non-null.
 */
export function isZoneAvailableNow(schedules: DeliveryZoneSchedule[]): boolean {
  if (schedules.length === 0) return true
  return getActiveSchedule(schedules) !== null
}

/**
 * Resolved delivery parameters for a zone at the current moment.
 * Uses the active schedule when present, otherwise falls back to zone base values.
 */
export interface ResolvedZoneParams {
  delivery_time_min: number
  delivery_price_bani: number
  min_order_bani: number
  free_delivery_from_bani: number | null
}

export function resolveZoneParams(
  zone: {
    delivery_time_min: number
    delivery_price_bani: number
    min_order_bani: number
    free_delivery_from_bani: number | null
  },
  schedules: DeliveryZoneSchedule[],
): ResolvedZoneParams {
  const active = getActiveSchedule(schedules)
  if (active) {
    return {
      delivery_time_min: active.delivery_time_min,
      delivery_price_bani: active.delivery_price_bani,
      min_order_bani: active.min_order_bani,
      free_delivery_from_bani: active.free_delivery_from_bani,
    }
  }
  // No matching schedule → use zone base params
  return {
    delivery_time_min: zone.delivery_time_min,
    delivery_price_bani: zone.delivery_price_bani,
    min_order_bani: zone.min_order_bani,
    free_delivery_from_bani: zone.free_delivery_from_bani,
  }
}

export type DeliveryZoneWithResolvedParams = ZoneWithSchedules & {
  resolvedParams: ResolvedZoneParams
}

export function attachResolvedZoneParams(
  zone: ZoneWithSchedules,
): DeliveryZoneWithResolvedParams {
  return {
    ...zone,
    resolvedParams: resolveZoneParams(zone, zone.delivery_zone_schedules ?? []),
  }
}
