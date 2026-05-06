"use client"

import { PosBrandMark } from "@/components/pos/pos-brand-mark"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import type { PosOrder, PosOrderStatus } from "@/types/pos"
import { MapPin, Phone, Store, Truck, User } from "lucide-react"
import { useEffect, useState } from "react"

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

/** В карточке — только улица/дом; без подъезда/этажа из отдельных полей. */
export function compactCardDeliveryAddress(order: PosOrder): string {
  if (order.delivery_mode === "pickup") return "Самовывоз"
  const raw = order.delivery_address?.trim() ?? ""
  if (!raw) return "—"

  const hasStructured =
    order.address_entrance != null ||
    order.address_floor != null ||
    order.address_apartment != null ||
    order.address_intercom != null

  if (hasStructured) return raw

  const dot = raw.indexOf(".")
  const comma = raw.indexOf(",")
  const stops = [dot, comma].filter((i) => i >= 0)
  if (stops.length === 0) return raw

  const cut = Math.min(...stops)
  return raw.slice(0, cut).trim() || raw
}

function StatusBadge({ status }: { status: PosOrderStatus }) {
  const map: Record<PosOrderStatus, { bg: string; text: string; label: string }> = {
    draft:     { bg: "#F4F4F5", text: "#52525B", label: "Черновик" },
    new:       { bg: "#FFF9E6", text: "#B38600", label: "Новый" },
    confirmed: { bg: "#E0F2FE", text: "#0369A1", label: "Подтверждён" },
    cooking:   { bg: "#EFF6FF", text: "#1D4ED8", label: "Готовится" },
    ready:     { bg: "#FEF3C7", text: "#B45309", label: "Готов" },
    delivery:  { bg: "#FFF5EB", text: "#C2410C", label: "Доставляется" },
    done:      { bg: "#E5FF66", text: "#3D5A00", label: "Выдан" },
    cancelled: { bg: "#FEF2F2", text: "#B91C1C", label: "Отменён" },
    rejected:  { bg: "#FEF2F2", text: "#991B1B", label: "Отклонён" },
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

const WEBSITE_REJECT_PRESETS = [
  "Клиент не отвечает",
  "Нет курьера",
  "Стоп-лист",
] as const

export function WebsiteNewActions({
  order,
  onAccept,
  onReject,
  busy,
}: {
  order: PosOrder
  onAccept: (orderId: string) => void | Promise<void>
  onReject: (orderId: string, reason: string) => void | Promise<void>
  busy: boolean
}) {
  const [rejectOpen, setRejectOpen] = useState(false)
  const [otherReason, setOtherReason] = useState("")
  const [rejectError, setRejectError] = useState<string | null>(null)

  useEffect(() => {
    setRejectOpen(false)
    setOtherReason("")
    setRejectError(null)
  }, [order.id])

  const closeReject = () => {
    setRejectOpen(false)
    setOtherReason("")
    setRejectError(null)
  }

  const submitPreset = async (reason: string) => {
    setRejectError(null)
    await onReject(order.id, reason)
    closeReject()
  }

  const submitOther = async () => {
    const text = otherReason.trim()
    if (!text) {
      setRejectError("Опишите причину")
      return
    }
    await submitPreset(text)
  }

  return (
    <div className="flex gap-2 pt-1">
      <Popover open={rejectOpen} onOpenChange={(open) => {
        setRejectOpen(open)
        if (!open) {
          setOtherReason("")
          setRejectError(null)
        }
      }}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={busy}
            className={cn(
              "rounded-full border border-red-500/50 bg-white px-3.5 py-1.5 text-[12px] font-semibold text-red-600 transition-colors hover:bg-red-50",
              busy && "pointer-events-none opacity-50",
            )}
          >
            Отклонить
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-72 border border-[#e8e8e8] bg-white p-3 shadow-md"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[#808080]">
            Причина отклонения
          </p>
          <div className="flex flex-col gap-1.5">
            {WEBSITE_REJECT_PRESETS.map((label) => (
              <Button
                key={label}
                type="button"
                variant="outline"
                disabled={busy}
                className="h-9 justify-start border-[#f2f2f2] text-[13px] font-normal text-[#242424] hover:bg-[#f2f2f2]"
                onClick={() => void submitPreset(label)}
              >
                {label}
              </Button>
            ))}
            <div className="mt-1 border-t border-[#f2f2f2] pt-2">
              <p className="mb-1.5 text-[12px] font-semibold text-[#242424]">Другое</p>
              <Input
                value={otherReason}
                onChange={(e) => {
                  setOtherReason(e.target.value)
                  setRejectError(null)
                }}
                placeholder="Текст причины…"
                className="h-9 border-[#f2f2f2] text-[13px]"
                disabled={busy}
              />
              {rejectError ? (
                <p className="mt-1 text-[11px] text-red-600">{rejectError}</p>
              ) : null}
              <Button
                type="button"
                variant="destructive"
                className="mt-2 h-9 w-full text-[13px]"
                disabled={busy}
                onClick={() => void submitOther()}
              >
                Отклонить с причиной
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      <button
        type="button"
        disabled={busy}
        onClick={() => void onAccept(order.id)}
        className={cn(
          "rounded-full bg-emerald-600 px-3.5 py-1.5 text-[12px] font-bold text-white transition-colors hover:bg-emerald-700",
          busy && "pointer-events-none opacity-50",
        )}
      >
        Принять
      </button>
    </div>
  )
}

function ActionButtons({
  order,
  onStatusChange,
  onWebsiteAccept,
  onWebsiteReject,
  websiteActionBusy,
}: {
  order: PosOrder
  onStatusChange: (orderId: string, newStatus: string) => void
  onWebsiteAccept?: (orderId: string) => void | Promise<void>
  onWebsiteReject?: (orderId: string, reason: string) => void | Promise<void>
  websiteActionBusy?: boolean
}) {
  if (order.status === "new" && order.source === "website") {
    if (onWebsiteAccept && onWebsiteReject) {
      return (
        <WebsiteNewActions
          order={order}
          busy={Boolean(websiteActionBusy)}
          onAccept={onWebsiteAccept}
          onReject={onWebsiteReject}
        />
      )
    }
  }
  if (
    order.status === "ready" &&
    order.delivery_mode === "delivery"
  ) {
    return (
      <div className="pt-1">
        <button
          type="button"
          onClick={() => onStatusChange(order.id, "delivery")}
          className="rounded-full bg-[#242424] px-3.5 py-1.5 text-[12px] font-bold text-white transition-colors hover:bg-[#3a3a3a]"
        >
          Передать курьеру
        </button>
      </div>
    )
  }
  if (order.status === "delivery") {
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
  onWebsiteAccept?: (orderId: string) => void | Promise<void>
  onWebsiteReject?: (orderId: string, reason: string) => void | Promise<void>
  websiteActionBusy?: boolean
}

export function OrderCard({
  order,
  isSelected,
  onSelect,
  onStatusChange,
  onWebsiteAccept,
  onWebsiteReject,
  websiteActionBusy,
}: OrderCardProps) {
  const orderTime = formatOrderTime(order.created_at)
  const displayName = order.user_name?.trim() || "—"
  const addressLine = compactCardDeliveryAddress(order)

  return (
    <div
      className={cn(
        "flex flex-col gap-0 rounded-lg border-0 bg-white px-4 py-4 shadow-none transition-colors",
        isSelected
          ? "ring-2 ring-inset ring-[#242424]"
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
          <span className="text-[13px] text-[#808080]">
            {order.user_phone?.trim() || "—"}
          </span>
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
        <ActionButtons
          order={order}
          onStatusChange={onStatusChange}
          onWebsiteAccept={onWebsiteAccept}
          onWebsiteReject={onWebsiteReject}
          websiteActionBusy={websiteActionBusy}
        />
      </div>
    </div>
  )
}
