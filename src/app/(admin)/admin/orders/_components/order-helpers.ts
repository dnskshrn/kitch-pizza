import { format, parseISO } from "date-fns"
import type { OrderItem, OrderStatus } from "@/types/database"

export function formatLei(bani: number): string {
  return (bani / 100).toLocaleString("ro-MD", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
}

export function formatCreatedAt(iso: string): string {
  return format(parseISO(iso), "dd.MM HH:mm")
}

export function pluralPositions(n: number): string {
  const abs10 = n % 100
  const last = n % 10
  if (abs10 >= 11 && abs10 <= 14) return "позиций"
  if (last === 1) return "позиция"
  if (last >= 2 && last <= 4) return "позиции"
  return "позиций"
}

export function statusLabel(s: OrderStatus): string {
  switch (s) {
    case "draft":
      return "Черновик"
    case "new":
      return "Новый"
    case "confirmed":
      return "Подтверждён"
    case "cooking":
      return "Готовится"
    case "ready":
      return "Готов"
    case "delivery":
      return "Доставляется"
    case "done":
      return "Выполнен"
    case "cancelled":
      return "Отменён"
    case "rejected":
      return "Отклонён"
  }
}

export function statusBadgeClass(s: OrderStatus): string {
  switch (s) {
    case "draft":
      return "border-transparent bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
    case "new":
      return "border-transparent bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-100"
    case "confirmed":
      return "border-transparent bg-sky-100 text-sky-950 dark:bg-sky-950 dark:text-sky-100"
    case "cooking":
    case "ready":
      return "border-transparent bg-amber-100 text-amber-950 dark:bg-amber-950 dark:text-amber-100"
    case "delivery":
      return "border-transparent bg-orange-100 text-orange-950 dark:bg-orange-950 dark:text-orange-100"
    case "done":
      return "border-transparent bg-green-100 text-green-900 dark:bg-green-950 dark:text-green-100"
    case "cancelled":
    case "rejected":
      return "border-transparent bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-100"
  }
}

export function paymentLabel(m: "cash" | "card"): string {
  return m === "cash" ? "Наличные" : "Карта"
}

export function sizeRu(size: string | null): string {
  if (size === "s") return "S"
  if (size === "l") return "L"
  return ""
}

/** Подпись размера для строки состава (RU). */
export function sizeLabelRu(size: string | null): string | null {
  if (size === "s") return "Маленькая"
  if (size === "l") return "Большая"
  return null
}

export function truncateAddress(text: string | null | undefined, maxLen: number): string {
  const t = (text ?? "").trim()
  if (t.length <= maxLen) return t
  return `${t.slice(0, Math.max(0, maxLen - 1)).trimEnd()}…`
}

export function sortedItems(items: OrderItem[]): OrderItem[] {
  return [...items].sort((a, b) => a.id.localeCompare(b.id))
}
