/** Пересчёт выбранных топпингов с учётом лимита группы (витрина: плоский список id). */
export function nextSelectedToppingIdsWithGroupCap(
  prevSelectedIds: string[],
  toppingId: string,
  groupToppingIds: readonly string[],
  maxSelections: number | null,
): string[] {
  const inGroup = new Set(groupToppingIds)
  if (prevSelectedIds.includes(toppingId)) {
    return prevSelectedIds.filter((x) => x !== toppingId)
  }
  const selectedInGroup = prevSelectedIds.filter((x) => inGroup.has(x))
  if (maxSelections == null) return [...prevSelectedIds, toppingId]
  if (selectedInGroup.length < maxSelections) {
    return [...prevSelectedIds, toppingId]
  }
  const removeCount = selectedInGroup.length - maxSelections + 1
  const toRemove = new Set(selectedInGroup.slice(0, removeCount))
  return [...prevSelectedIds.filter((x) => !toRemove.has(x)), toppingId]
}

/** Пересчёт выбора по группам (POS). */
export function nextSelectedByGroupWithCap(
  prev: Record<string, string[]>,
  groupId: string,
  toppingId: string,
  maxSelections: number | null,
): Record<string, string[]> {
  const cur = prev[groupId] ?? []
  if (cur.includes(toppingId)) {
    return { ...prev, [groupId]: cur.filter((x) => x !== toppingId) }
  }
  if (maxSelections == null) {
    return { ...prev, [groupId]: [...cur, toppingId] }
  }
  if (cur.length < maxSelections) {
    return { ...prev, [groupId]: [...cur, toppingId] }
  }
  const removeCount = cur.length - maxSelections + 1
  return { ...prev, [groupId]: [...cur.slice(removeCount), toppingId] }
}
