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
import { MapPin, Phone, Store, Truck, Tag, User, CircleUser, Bike } from "lucide-react"
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

  const comma = raw.indexOf(",")
  if (comma < 0) return raw

  return raw.slice(0, comma).trim() || raw
}

function StatusBadge({ status }: { status: PosOrderStatus }) {
  const map: Record<
    PosOrderStatus,
    { bg: string; text: string; border: string; label: string }
  > = {
    draft:     { bg: "#F4F4F5", text: "#52525B", border: "#52525B", label: "Черновик" },
    new:       { bg: "#FFF9E6", text: "#B38600", border: "#B38600", label: "Новый" },
    confirmed: { bg: "#E0F2FE", text: "#0369A1", border: "#0369A1", label: "Подтверждён" },
    cooking:   { bg: "#EFF6FF", text: "#1D4ED8", border: "#1D4ED8", label: "Готовится" },
    ready:     { bg: "#F0FDF4", text: "#15803D", border: "#15803D", label: "Готов" },
    delivery:  { bg: "#FFF5EB", text: "#C2410C", border: "#C2410C", label: "Доставляется" },
    done:      { bg: "#E5FF66", text: "#3D5A00", border: "#3D5A00", label: "Выдан" },
    cancelled: { bg: "#FEF2F2", text: "#B91C1C", border: "#B91C1C", label: "Отменён" },
    rejected:  { bg: "#FEF2F2", text: "#991B1B", border: "#991B1B", label: "Отклонён" },
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

export function getStatusBorderColor(status: PosOrderStatus): string {
  const map: Record<PosOrderStatus, string> = {
    draft:     "#52525B",
    new:       "#B38600",
    confirmed: "#0369A1",
    cooking:   "#1D4ED8",
    ready:     "#15803D",
    delivery:  "#C2410C",
    done:      "#3D5A00",
    cancelled: "#B91C1C",
    rejected:  "#991B1B",
  }
  return map[status] ?? "#E4E4E7"
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

export type OrderWithBrand = PosOrder

type OrderCardProps = {
  order: OrderWithBrand
  isSelected: boolean
  onSelect: () => void
}

export function OrderCard({
  order,
  isSelected,
  onSelect,
}: OrderCardProps) {
  const orderTime = formatOrderTime(order.created_at)
  const displayName = order.user_name?.trim() || "—"
  const addressLine = compactCardDeliveryAddress(order)
  const promoTrim = order.promo_code?.trim() ?? ""

  return (
    <div
      className={cn(
        "flex flex-col gap-0 rounded-lg border-2 bg-white px-4 py-4 shadow-none transition-colors",
        isSelected
          ? "ring-2 ring-inset ring-[#242424]"
          : "cursor-pointer hover:bg-[#fafafa]",
      )}
      style={{ borderColor: getStatusBorderColor(order.status) }}
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
          ) : order.delivery_mode === "aggregator" ? (
            <Bike className="size-3.5 shrink-0 text-[#808080]" aria-hidden />
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

        {promoTrim !== "" || order.discount > 0 ? (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 pl-[22px] text-[11px] leading-snug text-emerald-700">
            {promoTrim !== "" ? (
              <span className="inline-flex items-center gap-1 font-semibold">
                <Tag className="size-3 shrink-0 opacity-90" aria-hidden />
                Промо: {promoTrim}
              </span>
            ) : null}
            {order.discount > 0 ? (
              <span className="font-mono font-semibold tabular-nums">
                −{formatMdl(order.discount)}
              </span>
            ) : null}
          </div>
        ) : null}

        {/* ── Строка 2: адрес на сером фоне / Glovo ── */}
        <div
          className={cn(
            "flex items-center gap-2 rounded-lg px-3 py-2.5",
            order.delivery_mode === "aggregator"
              ? "justify-center bg-orange-500"
              : "bg-[#f2f2f2]",
          )}
        >
          {order.delivery_mode === "aggregator" ? (
            <span className="text-sm font-bold uppercase tracking-wide text-white">
              GLOVO
            </span>
          ) : (
            <>
              <MapPin className="size-3.5 shrink-0 text-[#808080]" aria-hidden />
              <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-[#242424]">
                {addressLine}
              </span>
            </>
          )}
        </div>

        {order.delivery_mode === "delivery" &&
        order.status === "delivery" &&
        order.courier_id ? (
          <div
            className="flex items-center gap-2 rounded-lg border border-[#e8e8e8] bg-white px-3 py-2"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            role="presentation"
          >
            <CircleUser
              className="size-3.5 shrink-0 text-[#808080]"
              aria-hidden
            />
            <span className="min-w-0 truncate text-[13px] font-bold text-[#242424]">
              {order.courier_name?.trim() || "Курьер"}
            </span>
          </div>
        ) : null}

        {order.delivery_mode !== "aggregator" ? (
          <div className="flex items-center gap-2">
            <User className="size-3.5 shrink-0 text-[#808080]" aria-hidden />
            <span className="text-[13px] text-[#242424]">{displayName}</span>
            <Phone className="ml-1 size-3.5 shrink-0 text-[#808080]" aria-hidden />
            <span className="text-[13px] text-[#808080]">
              {order.user_phone?.trim() || "—"}
            </span>
          </div>
        ) : null}

        {/* ── Строка 4: позиции · сумма ── */}
        <div className="flex items-center justify-between">
          <span className="text-[12px] text-[#808080]">
            {formatPositionCount(order.item_count)}
          </span>
          <span className="font-mono text-[14px] font-bold tabular-nums text-[#242424]">
            {formatMdl(order.total ?? 0)}
          </span>
        </div>
      </div>
    </div>
  )
}
