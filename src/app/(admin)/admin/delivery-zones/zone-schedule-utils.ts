import type { DeliveryZoneSchedule } from "@/types/database"

export function formatLei(bani: number): string {
  return (bani / 100).toLocaleString("ro-MD", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
}

export function formatScheduleTime(t: string): string {
  return t.length >= 5 ? t.slice(0, 5) : t
}

export function formatScheduleWindow(
  from: string,
  to: string,
): string {
  return `${formatScheduleTime(from)}–${formatScheduleTime(to)}`
}

export function formatSchedulePriceLabel(deliveryPriceBani: number): string {
  if (deliveryPriceBani === 0) return "0 MDL (free)"
  return `${formatLei(deliveryPriceBani)} MDL`
}

export function formatScheduleSlotSummary(s: DeliveryZoneSchedule): string {
  return `${formatScheduleWindow(s.from_time, s.to_time)} · ${formatSchedulePriceLabel(s.delivery_price_bani)}`
}

export function sortSchedules(
  schedules: DeliveryZoneSchedule[],
): DeliveryZoneSchedule[] {
  return [...schedules].sort((a, b) => a.sort_order - b.sort_order)
}
