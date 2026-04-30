"use client"

import { PosBrandMark } from "@/components/pos/pos-brand-mark"
import { cn } from "@/lib/utils"
import type { PosOrder, PosOrderStatus } from "@/types/pos"
import { MapPin, Phone, Store, Truck, User } from "lucide-react"

function formatOrderTime(iso: string): string {
  const date = new Date(iso)
  const h = date.getHours().toString().padStart(2, "0")
  const m = date.getMinutes().toString().padStart(2, "0")
  return `${h}:${m}`
}

function formatPositionCount(n: number): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod100 >= 11 && mod100 <= 14) return `${n} позиций`
  if (mod10 === 1) return `${n} позиция`
  if (mod10 >= 2 && mod10 <= 4) return `${n} позиции`
  return `${n} позиций`
}

function formatMdl(bani: number): string {
  return `${(bani / 100).toLocaleString("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} MDL`
}

function StatusBadge({ status }: { status: PosOrderStatus }) {
  const map: Record<PosOrderStatus, { bg: string; text: string; label: string }> = {
    new:         { bg: "#FFF9E6", text: "#B38600", label: "Новый" },
    in_progress: { bg: "#EFF6FF", text: "#1D4ED8", label: "Готовится" },
    delivering:  { bg: "#FFF5EB", text: "#C2410C", label: "Доставляется" },
    done:        { bg: "#E5FF66", text: "#3D5A00", label: "Выдан" },
    cancelled:   { bg: "#FEF2F2", text: "#B91C1C", label: "Отменён" },
  }
  const s = map[status]
  if (!s) return null
  return (
    <span
      className="inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[11px] font-bold leading-none"
      style={{ backgroundColor: s.bg, color: s.text }}
    >
      {s.label}
    </span>
  )
}

function ActionButtons({
  order,
  onStatusChange,
}: {
  order: PosOrder
  onStatusChange: (orderId: string, newStatus: string) => void
}) {
  if (order.status === "new" && order.source === "website") {
    return (
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={() => onStatusChange(order.id, "cancelled")}
          className="rounded-full border border-[#f2f2f2] px-3.5 py-1.5 text-[12px] font-normal text-[#808080] transition-colors hover:border-[#242424] hover:text-[#242424]"
        >
          Отклонить
        </button>
        <button
          type="button"
          onClick={() => onStatusChange(order.id, "in_progress")}
          className="rounded-full bg-[#242424] px-3.5 py-1.5 text-[12px] font-bold text-white transition-colors hover:bg-[#3a3a3a]"
        >
          Принять
        </button>
      </div>
    )
  }
  if (order.status === "new" && order.source === "pos") {
    return (
      <div className="pt-1">
        <button
          type="button"
          onClick={() => onStatusChange(order.id, "in_progress")}
          className="rounded-full bg-[#242424] px-3.5 py-1.5 text-[12px] font-bold text-white transition-colors hover:bg-[#3a3a3a]"
        >
          В работу
        </button>
      </div>
    )
  }
  if (order.status === "in_progress") {
    return (
      <div className="pt-1">
        <button
          type="button"
          onClick={() => onStatusChange(order.id, "delivering")}
          className="rounded-full bg-[#242424] px-3.5 py-1.5 text-[12px] font-bold text-white transition-colors hover:bg-[#3a3a3a]"
        >
          Готово к выдаче
        </button>
      </div>
    )
  }
  if (order.status === "delivering") {
    return (
      <div className="pt-1">
        <button
          type="button"
          onClick={() => onStatusChange(order.id, "done")}
          className="rounded-full bg-[#242424] px-3.5 py-1.5 text-[12px] font-bold text-white transition-colors hover:bg-[#3a3a3a]"
        >
          Выдан
        </button>
      </div>
    )
  }
  return null
}

export type OrderWithBrand = PosOrder

type OrderCardProps = {
  order: OrderWithBrand
  isSelected: boolean
  onSelect: () => void
  onStatusChange: (orderId: string, newStatus: string) => void
}

export function OrderCard({
  order,
  isSelected,
  onSelect,
  onStatusChange,
}: OrderCardProps) {
  const orderTime = formatOrderTime(order.created_at)
  const displayName = order.user_name?.trim() || "—"
  const addressLine =
    order.delivery_mode === "pickup"
      ? "Самовывоз"
      : order.delivery_address?.trim() || "—"

  return (
    <div
      className={cn(
        "flex flex-col gap-0 rounded-lg border-0 bg-white px-4 py-4 shadow-none transition-colors",
        isSelected
          ? "ring-2 ring-[#242424] ring-offset-2 ring-offset-[#f2f2f2]"
          : "cursor-pointer hover:bg-[#fafafa]",
      )}
    >
      <div
        role="button"
        tabIndex={0}
        className="flex flex-col gap-3 outline-none"
        onClick={onSelect}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            onSelect()
          }
        }}
      >
        {/* ── Строка 1: иконка источника · бренд · время · номер · статус ── */}
        <div className="flex items-center gap-2">
          {order.delivery_mode === "pickup" ? (
            <Store className="size-3.5 shrink-0 text-[#808080]" aria-hidden />
          ) : (
            <Truck className="size-3.5 shrink-0 text-[#808080]" aria-hidden />
          )}

          <PosBrandMark brandSlug={order.brand_slug} />

          <span className="font-mono text-[15px] font-bold tabular-nums text-[#242424]">
            {orderTime}
          </span>

          <span className="font-mono text-[11px] tabular-nums text-[#808080]">
            #{order.order_number}
          </span>

          <span className="flex-1" />

          <StatusBadge status={order.status} />
        </div>

        {/* ── Строка 2: адрес на сером фоне ── */}
        <div className="flex items-center gap-2 rounded-lg bg-[#f2f2f2] px-3 py-2.5">
          <MapPin className="size-3.5 shrink-0 text-[#808080]" aria-hidden />
          <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-[#242424]">
            {addressLine}
          </span>
        </div>

        {/* ── Строка 3: имя · телефон ── */}
        <div className="flex items-center gap-2">
          <User className="size-3.5 shrink-0 text-[#808080]" aria-hidden />
          <span className="text-[13px] text-[#242424]">{displayName}</span>
          <Phone className="ml-1 size-3.5 shrink-0 text-[#808080]" aria-hidden />
          <span className="text-[13px] text-[#808080]">{order.user_phone}</span>
        </div>

        {/* ── Строка 4: позиции · сумма ── */}
        <div className="flex items-center justify-between">
          <span className="text-[12px] text-[#808080]">
            {formatPositionCount(order.item_count)}
          </span>
          <span className="font-mono text-[14px] font-bold tabular-nums text-[#242424]">
            {formatMdl(order.total)}
          </span>
        </div>
      </div>

      {/* ── Кнопки действий — не propagate клик ── */}
      <div
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <ActionButtons order={order} onStatusChange={onStatusChange} />
      </div>
    </div>
  )
}
