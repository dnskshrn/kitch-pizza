/**
 * Generates time slots for POS order scheduling.
 * Kitchen hours that cross midnight (e.g. 11:00–03:00) are handled:
 * close hour < open hour means close is next day.
 *
 * @param openHour  e.g. 11
 * @param closeHour e.g. 3  (next day)
 * @param bufferMin minimum minutes from now before first slot (default 30)
 * @param stepMin   slot interval in minutes (default 15)
 * @returns array of "HH:MM" strings
 */
export function generateScheduledSlots(
  openHour: number,
  closeHour: number,
  bufferMin = 30,
  stepMin = 15,
): string[] {
  const now = new Date()
  const slots: string[] = []

  // Earliest possible slot = now + bufferMin, rounded up to next stepMin boundary
  const earliest = new Date(now.getTime() + bufferMin * 60_000)
  const roundedMin = Math.ceil(earliest.getMinutes() / stepMin) * stepMin
  earliest.setMinutes(roundedMin, 0, 0)
  if (roundedMin >= 60) {
    earliest.setHours(earliest.getHours() + 1)
    earliest.setMinutes(0)
  }

  // Build close datetime — if closeHour <= openHour it's next day
  const closeDate = new Date(now)
  closeDate.setHours(closeHour, 0, 0, 0)
  if (closeHour <= openHour) {
    closeDate.setDate(closeDate.getDate() + 1)
  }

  let cursor = new Date(earliest)
  while (cursor < closeDate) {
    const hh = String(cursor.getHours()).padStart(2, "0")
    const mm = String(cursor.getMinutes()).padStart(2, "0")
    slots.push(`${hh}:${mm}`)
    cursor = new Date(cursor.getTime() + stepMin * 60_000)
  }

  return slots
}
