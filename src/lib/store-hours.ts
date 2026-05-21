/** Минуты с полуночи в Europe/Chisinau. */
export function getChisinauMinutes(now = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Chisinau",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(now)
  const h = parseInt(parts.find((p) => p.type === "hour")!.value, 10)
  const m = parseInt(parts.find((p) => p.type === "minute")!.value, 10)
  return h * 60 + m
}

export function formatStoreOpenTime(openHour: number): string {
  return `${String(openHour).padStart(2, "0")}:00`
}

/**
 * Ночная смена: closeHour <= openHour (напр. 11:00–03:00 или 15:00–03:00).
 * Открыто: now >= open ИЛИ now < close.
 */
export function isStoreOpenAt(
  openHour: number,
  closeHour: number,
  nowMinutes = getChisinauMinutes()
): boolean {
  const open = openHour * 60
  const close = closeHour * 60

  if (closeHour <= openHour) {
    return nowMinutes >= open || nowMinutes < close
  }

  return nowMinutes >= open && nowMinutes < close
}

/** Минут до открытия; 0 если уже открыто. */
export function getMinutesUntilStoreOpen(
  openHour: number,
  closeHour: number,
  nowMinutes = getChisinauMinutes()
): number {
  if (isStoreOpenAt(openHour, closeHour, nowMinutes)) return 0

  const open = openHour * 60

  if (closeHour <= openHour) {
    return open - nowMinutes
  }

  if (nowMinutes < open) return open - nowMinutes

  const minutesInDay = 24 * 60
  return minutesInDay - nowMinutes + open
}
