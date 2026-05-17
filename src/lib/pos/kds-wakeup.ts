/**
 * Returns true if the KDS card should be ACTIVE (visible, not dimmed).
 *
 * Rules:
 * - 'asap' or null → always active
 * - delivery_mode === 'delivery' → wake up 60 min before scheduled time
 * - pickup / aggregator → wake up 30 min before scheduled time
 *
 * Handles past-midnight times: if parsed time is more than 12h in the past,
 * assume it refers to the next occurrence (e.g. 01:30 when now is 14:00).
 */
export function isKdsCardActive(
  scheduledTime: string | null,
  deliveryMode: string | null,
): boolean {
  if (!scheduledTime || scheduledTime === "asap") return true

  const match = scheduledTime.match(/^(\d{2}):(\d{2})$/)
  if (!match) return true

  const now = new Date()
  const target = new Date(now)
  target.setHours(Number(match[1]), Number(match[2]), 0, 0)

  // If target is more than 12h ago, it refers to tomorrow
  if (now.getTime() - target.getTime() > 12 * 60 * 60_000) {
    target.setDate(target.getDate() + 1)
  }

  const thresholdMin = deliveryMode === "delivery" ? 60 : 30
  const wakeupTime = new Date(target.getTime() - thresholdMin * 60_000)

  return now >= wakeupTime
}
