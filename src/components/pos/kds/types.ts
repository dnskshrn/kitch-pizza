import type { OrderItem } from "@/types/database"

/**
 * Одна строка для `.select()` заказов KDS (server action и клиент).
 * Цех: order_items.menu_item_id → menu_items (продукт в спецификации) → menu_categories.workshop.
 */
export const KDS_ORDER_QUERY_SELECT = `
  id,
  order_number,
  brand_id,
  status,
  scheduled_time,
  delivery_mode,
  aggregator,
  updated_at,
  cooking_started_at,
  brands ( slug ),
  order_items (
    id,
    item_name,
    quantity,
    size,
    toppings,
    price,
    menu_items (
      name_ru,
      name_ro,
      category_id,
      menu_categories ( workshop )
    )
  )
`

export type KdsMenuCategoriesEmbed =
  | { workshop?: string | null }
  | { workshop?: string | null }[]
  | null
  | undefined

/** Embed из PostgREST (таблица menu_items). */
export type KdsOrderItemMenuItemEmbed = {
  name_ru?: string | null
  name_ro?: string | null
  category_id?: string | null
  menu_categories?: KdsMenuCategoriesEmbed
}

/**
 * Срез «продукт» для фильтра KDS (спецификация: products.name, category_id, menu_categories.workshop).
 */
export type KdsProductEmbed = {
  name?: string | null
  category_id?: string | null
  menu_categories?: KdsMenuCategoriesEmbed
}

/** Строка заказа для KDS после загрузки с Supabase */
export type KdsOrderRow = {
  id: string
  order_number: number
  brand_id: string
  status: string
  scheduled_time: string | null
  delivery_mode: string | null
  aggregator: string | null
  updated_at: string
  cooking_started_at: string | null
  brands: { slug: string } | null
  order_items: KdsOrderItemRow[]
}

export type KdsOrderItemRow = Pick<
  OrderItem,
  "id" | "item_name" | "quantity" | "size" | "toppings" | "price"
> & {
  menu_items?: KdsOrderItemMenuItemEmbed | null
  /** Заполняется из menu_items при нормализации ответа API. */
  products?: KdsProductEmbed | null
}

export function normalizeMenuItemsEmbedRaw(
  raw: unknown,
): KdsOrderItemMenuItemEmbed | null {
  if (raw == null) return null
  const obj = Array.isArray(raw) ? raw[0] : raw
  if (!obj || typeof obj !== "object") return null
  return obj as KdsOrderItemMenuItemEmbed
}

export function productsEmbedFromMenuItems(
  mi: KdsOrderItemMenuItemEmbed | null,
): KdsProductEmbed | null {
  if (!mi) return null
  const ru = mi.name_ru?.trim() ?? ""
  const ro = mi.name_ro?.trim() ?? ""
  const name = [ru, ro].filter(Boolean).join(" / ") || null
  return {
    name,
    category_id: mi.category_id ?? null,
    menu_categories: mi.menu_categories ?? null,
  }
}

function workshopFromCategoriesEmbed(
  mc: KdsMenuCategoriesEmbed | undefined,
): string | null {
  if (mc == null) return null
  const cat = Array.isArray(mc) ? mc[0] : mc
  if (!cat || typeof cat !== "object") return null
  const w = (cat as { workshop?: unknown }).workshop
  if (w == null) return null
  if (typeof w !== "string") return null
  const t = w.trim()
  return t === "" ? null : t
}

/** Выбор цехов этого экрана KDS; пустой массив — без фильтра (все позиции). */
export const KDS_WORKSHOPS_STORAGE_KEY = "kds_workshops"

export const KDS_WORKSHOP_IDS = ["operator", "pizza", "kebab", "sushi"] as const
export type KdsWorkshopId = (typeof KDS_WORKSHOP_IDS)[number]

export const KDS_WORKSHOP_OPTIONS: ReadonlyArray<{
  id: KdsWorkshopId
  label: string
}> = [
  { id: "operator", label: "Оператор" },
  { id: "pizza", label: "Пицца" },
  { id: "kebab", label: "Кебаб" },
  { id: "sushi", label: "Суши" },
]

const allowedWorkshopSet = new Set<string>(KDS_WORKSHOP_IDS)

export function parseKdsWorkshopsFromStorage(raw: string | null): string[] {
  if (raw == null || raw.trim() === "") return []
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (x): x is string =>
        typeof x === "string" && allowedWorkshopSet.has(x.trim()),
    )
  } catch {
    return []
  }
}

/** workshop из products.menu_categories (или эквивалент из menu_items); пустая строка → некатегоризованное */
export function orderItemWorkshop(line: KdsOrderItemRow): string | null {
  const mc =
    line.products?.menu_categories ?? line.menu_items?.menu_categories
  return workshopFromCategoriesEmbed(mc)
}

/** Если selected пустой — все позиции. Иначе: workshop ∈ selected или workshop неклассифицирован (null). */
export function filterOrderItemsByWorkshops(
  items: KdsOrderItemRow[],
  selected: string[],
): KdsOrderItemRow[] {
  if (selected.length === 0) return items
  return items.filter((line) => {
    const w = orderItemWorkshop(line)
    if (w == null) return true
    return selected.includes(w)
  })
}

export function filterKdsOrderForWorkshops(
  order: KdsOrderRow,
  selected: string[],
): KdsOrderRow | null {
  const nextItems = filterOrderItemsByWorkshops(order.order_items, selected)
  if (nextItems.length === 0) return null
  return { ...order, order_items: nextItems }
}

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

export function normalizeKdsOrderItemFromRaw(raw: unknown): KdsOrderItemRow | null {
  if (!raw || typeof raw !== "object") return null
  const o = raw as Record<string, unknown>
  const menu_items = normalizeMenuItemsEmbedRaw(o.menu_items)
  const products = productsEmbedFromMenuItems(menu_items)
  const toppings = parseOrderItemToppings(o.toppings)
  return {
    id: String(o.id),
    item_name: String(o.item_name ?? ""),
    quantity: Number(o.quantity ?? 0),
    size:
      o.size == null || o.size === ""
        ? null
        : String(o.size),
    toppings,
    price: Number(o.price ?? 0),
    menu_items,
    products,
  }
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
