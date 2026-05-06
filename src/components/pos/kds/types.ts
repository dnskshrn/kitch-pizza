import type { OrderItem } from "@/types/database"

/** Строка заказа для KDS после загрузки с Supabase */
export type KdsOrderRow = {
  id: string
  order_number: number
  brand_id: string
  status: string
  scheduled_time: string | null
  updated_at: string
  cooking_started_at: string | null
  brands: { slug: string } | null
  order_items: KdsOrderItemRow[]
}

export type KdsOrderItemRow = Pick<
  OrderItem,
  "id" | "item_name" | "quantity" | "size" | "toppings" | "price"
>

export const POS_KDS_BRAND_STORAGE_KEY = "pos-kds-brand-slug"

export function isKdsScheduledOrder(scheduledTime: string | null): boolean {
  if (scheduledTime == null) return false
  const t = scheduledTime.trim()
  if (!t) return false
  return t.toLowerCase() !== "asap"
}

/** Зелёный до 7 мин, жёлтый 7–10 мин, красный с 11 мин */
export function kdsTimerPalette(elapsedSeconds: number): {
  bg: string
  fg: string
} {
  if (elapsedSeconds < 7 * 60) return { bg: "#55ff00", fg: "#111111" }
  if (elapsedSeconds < 11 * 60) return { bg: "#ffd400", fg: "#111111" }
  return { bg: "#ff0000", fg: "#ffffff" }
}

export function formatElapsedMmSs(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const mm = Math.floor(s / 60)
  const ss = s % 60
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`
}

export function parseOrderItemToppings(
  raw: unknown,
): { name: string; price: number }[] {
  if (!Array.isArray(raw)) return []
  const out: { name: string; price: number }[] = []
  for (const x of raw) {
    if (
      x &&
      typeof x === "object" &&
      "name" in x &&
      typeof (x as { name: unknown }).name === "string" &&
      "price" in x &&
      typeof (x as { price: unknown }).price === "number"
    ) {
      out.push({
        name: (x as { name: string }).name,
        price: (x as { price: number }).price,
      })
    }
  }
  return out
}

export function aggregateToppingsForDisplay(
  toppings: { name: string; price: number }[],
): Array<{ name: string; price: number; qty: number }> {
  const map = new Map<string, { name: string; price: number; qty: number }>()
  for (const t of toppings) {
    const key = `${t.name}\0${t.price}`
    const prev = map.get(key)
    if (prev) prev.qty += 1
    else map.set(key, { name: t.name, price: t.price, qty: 1 })
  }
  return [...map.values()]
}

/** Отображение времени предзаказа в шапке карточки */
export function formatScheduledTimeLabel(scheduledTime: string): string {
  const t = scheduledTime.trim()
  if (!t) return "—"
  const ms = Date.parse(t)
  if (!Number.isNaN(ms)) {
    const d = new Date(ms)
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
  }
  return t
}

export function scheduledSortKey(scheduledTime: string): number {
  const ms = Date.parse(scheduledTime.trim())
  if (!Number.isNaN(ms)) return ms
  return scheduledTime.trim().charCodeAt(0) ?? 0
}
