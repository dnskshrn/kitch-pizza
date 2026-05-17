"use client"

import { format, parseISO } from "date-fns"
import Link from "next/link"
import {
  Bike,
  Check,
  ChefHat,
  Clock,
  Headphones,
  MapPin,
  Send,
  User,
  X,
  XIcon,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { useEffect, useState, type ReactNode } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import type { OrderStatus } from "@/types/database"
import type { AdminOrderDetailItem, AdminOrderDetailRow } from "./actions"
import { fetchAdminOrderDetail } from "./actions"
import {
  formatDurationRu,
  sizeLabelRu,
  statusBadgeClass,
  statusLabel,
} from "./_components/order-helpers"

type OrderDetailSheetProps = {
  orderId: string | null
  onClose: () => void
}

function formatPointTime(iso: string): string {
  return format(parseISO(iso), "dd.MM HH:mm")
}

function unwrapOne<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null
  return Array.isArray(v) ? (v[0] ?? null) : v
}

function minutesBetween(startIso: string, endIso: string): number {
  const a = parseISO(startIso).getTime()
  const b = parseISO(endIso).getTime()
  return Math.max(0, Math.round((b - a) / 60000))
}

/** Суммы из бань: «1 234,56 MDL» (пробел тысяч, запятая в дроби). */
function formatMdlFromBani(bani: number): string {
  const n = bani / 100
  const neg = n < 0
  const abs = Math.abs(n)
  const [intRaw, fracRaw = "00"] = abs.toFixed(2).split(".")
  const intSpaced = intRaw.replace(/\B(?=(\d{3})+(?!\d))/g, " ")
  const frac = fracRaw.length === 1 ? `${fracRaw}0` : fracRaw
  return `${neg ? "−" : ""}${intSpaced},${frac} MDL`
}

function lineUnitPriceBani(line: AdminOrderDetailItem): number {
  if (line.quantity <= 0) return Math.round(line.price)
  return Math.round(line.price / line.quantity)
}

function sizeSuffixForLine(size: string | null): string {
  const ru = sizeLabelRu(size)
  if (ru) return ` (${ru})`
  const t = size?.trim()
  return t ? ` (${t})` : ""
}

function toppingsNamesRuLine(raw: unknown): string | null {
  if (!Array.isArray(raw) || raw.length === 0) return null
  const parts: string[] = []
  for (const el of raw) {
    if (!el || typeof el !== "object") continue
    const o = el as Record<string, unknown>
    const ru =
      typeof o.name_ru === "string" ? o.name_ru.trim() : ""
    if (ru) parts.push(ru)
  }
  return parts.length > 0 ? parts.join(", ") : null
}

function paymentMethodHeading(pm: string | null | undefined): string {
  switch (pm) {
    case "cash":
      return "Наличные 💵"
    case "card":
      return "Карта 💳"
    case "aggregator_card":
      return "Карта Glovo 💳"
    case "mixed":
      return "Наличные + Карта 💵💳"
    default:
      return pm?.trim() ? pm : "—"
  }
}

function sortDetailItems(items: AdminOrderDetailItem[]): AdminOrderDetailItem[] {
  return [...items].sort((a, b) => a.id.localeCompare(b.id))
}

function subtotalNonGiftBani(items: AdminOrderDetailItem[]): number {
  let s = 0
  for (const it of items) {
    if (it.is_gift === true) continue
    s += it.price
  }
  return s
}

function SummaryLine({
  label,
  value,
  labelClassName,
  valueClassName,
}: {
  label: string
  value: string
  labelClassName?: string
  valueClassName?: string
}) {
  return (
    <div className="flex justify-between gap-4 text-sm tabular-nums">
      <span
        className={cn("text-muted-foreground shrink-0", labelClassName)}
      >
        {label}
      </span>
      <span className={cn("min-w-0 text-right", valueClassName)}>{value}</span>
    </div>
  )
}

function deliveryBlock(order: AdminOrderDetailRow): ReactNode {
  if (order.delivery_mode === "pickup") {
    return (
      <SummaryLine
        label="Доставка:"
        value="Самовывоз"
        valueClassName="text-muted-foreground"
      />
    )
  }
  if (order.delivery_fee > 0) {
    return (
      <SummaryLine
        label="Доставка:"
        value={`+${formatMdlFromBani(order.delivery_fee)}`}
      />
    )
  }
  if (order.delivery_fee <= 0 && order.delivery_mode === "delivery") {
    return (
      <SummaryLine
        label="Доставка:"
        value="Бесплатно"
        valueClassName="text-green-600 dark:text-green-400"
      />
    )
  }
  if (order.delivery_fee <= 0) {
    return (
      <SummaryLine
        label="Доставка:"
        value="—"
        valueClassName="text-muted-foreground"
      />
    )
  }
}

function OrderCompositionAndPayment({ order }: { order: AdminOrderDetailRow }) {
  const items = sortDetailItems(order.order_items ?? [])
  const promoTrim = order.promo_code?.trim() ?? ""
  const hasPromo = promoTrim.length > 0
  const subtotal = subtotalNonGiftBani(items)
  const bonusPts = Math.max(0, Math.floor(order.bonuses_redeemed ?? 0))
  const bonusBani = bonusPts * 100
  const pm = order.payment_method ?? null
  const cashAmt = order.cash_amount
  const cardAmt = order.card_amount
  const changeFrom = order.change_from

  return (
    <>
      <Separator />
      <section className="space-y-4">
        <h3 className="font-heading font-semibold">Состав заказа</h3>
        {items.length === 0 ? (
          <p className="text-muted-foreground text-sm">Нет позиций</p>
        ) : (
          <ul className="space-y-3 text-sm">
            {items.map((line) => {
              const tops = toppingsNamesRuLine(line.toppings)
              const gift = line.is_gift === true
              const unit = lineUnitPriceBani(line)
              const sizeSuf = sizeSuffixForLine(line.size)
              return (
                <li
                  key={line.id}
                  className="border-border border-b pb-3 last:border-0 last:pb-0"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <p className="min-w-0 flex-1 leading-snug">
                      <span className="tabular-nums">{line.quantity}×</span>{" "}
                      <span className="font-medium">
                        {line.item_name}
                        {sizeSuf ? (
                          <span className="font-normal">{sizeSuf}</span>
                        ) : null}
                      </span>
                      {gift ? null : (
                        <>
                          <span className="text-muted-foreground"> — </span>
                          <span className="text-muted-foreground tabular-nums">
                            {formatMdlFromBani(unit)} × {line.quantity} ={" "}
                            <span className="font-medium text-foreground">
                              {formatMdlFromBani(line.price)}
                            </span>
                          </span>
                        </>
                      )}
                    </p>
                    {gift ? (
                      <span className="shrink-0 text-green-700 dark:text-green-400">
                        🎁 Подарок
                      </span>
                    ) : null}
                  </div>
                  {tops ? (
                    <p className="text-muted-foreground mt-1 text-xs">{tops}</p>
                  ) : null}
                </li>
              )
            })}
          </ul>
        )}

        <div className="space-y-2 pt-1">
          <SummaryLine label="Подытог:" value={formatMdlFromBani(subtotal)} />
          {hasPromo ? (
            <SummaryLine
              label={`Промокод ${promoTrim}:`}
              value={`−${formatMdlFromBani(order.discount)}`}
              valueClassName="text-red-600 dark:text-red-400"
            />
          ) : null}
          {!hasPromo && order.discount > 0 ? (
            <SummaryLine
              label="Скидка:"
              value={`−${formatMdlFromBani(order.discount)}`}
              valueClassName="text-red-600 dark:text-red-400"
            />
          ) : null}
          {bonusPts > 0 ? (
            <SummaryLine
              label="Бонусы:"
              value={`−${formatMdlFromBani(bonusBani)}`}
              valueClassName="text-purple-600 dark:text-purple-400"
            />
          ) : null}
          {deliveryBlock(order)}
          <Separator className="my-4" />
          <SummaryLine
            label="Итого:"
            value={formatMdlFromBani(order.total)}
            labelClassName="font-semibold text-foreground"
            valueClassName="font-semibold text-foreground"
          />
        </div>
      </section>

      <Separator />

      <section className="space-y-3 text-sm">
        <h3 className="font-heading font-semibold">Оплата</h3>
        <p>
          <span className="text-muted-foreground">Способ оплаты: </span>
          <span>{paymentMethodHeading(pm)}</span>
        </p>
        {pm === "mixed" &&
        (cashAmt != null || cardAmt != null) ? (
          <div className="text-muted-foreground space-y-1.5 border-l-2 border-border pl-3">
            {cashAmt != null ? (
              <p className="flex justify-between gap-4 tabular-nums">
                <span>Наличными:</span>
                <span className="text-foreground">
                  {formatMdlFromBani(cashAmt)}
                </span>
              </p>
            ) : null}
            {cardAmt != null ? (
              <p className="flex justify-between gap-4 tabular-nums">
                <span>Картой:</span>
                <span className="text-foreground">
                  {formatMdlFromBani(cardAmt)}
                </span>
              </p>
            ) : null}
          </div>
        ) : null}
        {pm === "cash" &&
        changeFrom != null &&
        changeFrom > 0 ? (
          <p className="flex justify-between gap-4 tabular-nums">
            <span className="text-muted-foreground">Сдача с:</span>
            <span>{formatMdlFromBani(changeFrom)}</span>
          </p>
        ) : null}
      </section>

      <Separator />

      <OrderParticipantsSection order={order} />

      <Separator />

      <OrderDeliverySection order={order} />
    </>
  )
}

function staffRoleLabelRu(role: string | null | undefined): string | null {
  const raw = role?.trim()
  if (!raw) return null
  const r = raw.toLowerCase()
  if (r === "operator") return "Оператор"
  if (r === "manager") return "Менеджер"
  return raw
}

function OrderParticipantsSection({ order }: { order: AdminOrderDetailRow }) {
  const profile = unwrapOne(order.profiles)
  const profileName = profile?.name?.trim() ?? ""
  const userName = order.user_name?.trim() ?? ""
  const displayName = profileName.length > 0 ? profileName : userName || null
  const phoneRaw = order.user_phone?.trim() ?? ""
  const phone = phoneRaw.length > 0 ? phoneRaw : null
  const noNameNoPhone = displayName == null && phone == null

  const operatorStaff = unwrapOne(order.operator)
  const courierStaff = unwrapOne(order.courier)
  const assignedAtHm =
    typeof order.courier_assigned_at === "string"
      ? format(parseISO(order.courier_assigned_at), "HH:mm")
      : null

  return (
    <section className="space-y-4 text-sm">
      <h3 className="font-heading font-semibold">Участники</h3>

      <div className="flex gap-3">
        <User
          className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0"
          aria-hidden
        />
        <div className="text-muted-foreground min-w-0 flex-1 space-y-1">
          <div className="text-foreground font-medium">Клиент</div>
          {noNameNoPhone ? (
            <div className="space-y-1">
              <p className="text-muted-foreground">—</p>
              {order.profile_id != null ? (
                <Button variant="link" className="h-auto p-0 text-sm" asChild>
                  <Link href={`/admin/customers/${order.profile_id}`}>
                    → Профиль
                  </Link>
                </Button>
              ) : null}
            </div>
          ) : (
            <div className="space-y-1">
              {displayName != null ? (
                <p className="text-foreground">{displayName}</p>
              ) : null}
              <p>
                <span className="text-muted-foreground">Телефон: </span>
                <span className="text-foreground tabular-nums">
                  {phone ?? "—"}
                </span>
              </p>
              {order.profile_id != null ? (
                <Button variant="link" className="h-auto p-0 text-sm" asChild>
                  <Link href={`/admin/customers/${order.profile_id}`}>
                    → Профиль
                  </Link>
                </Button>
              ) : null}
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-3">
        <Headphones
          className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0"
          aria-hidden
        />
        <div className="text-muted-foreground min-w-0 flex-1 space-y-0.5">
          <div className="text-foreground font-medium">Оператор</div>
          {order.operator_id == null ? (
            <p className="text-muted-foreground">—</p>
          ) : operatorStaff?.name?.trim() ? (
            <>
              <p className="text-foreground">{operatorStaff.name.trim()}</p>
              {staffRoleLabelRu(operatorStaff.role) ? (
                <p className="text-muted-foreground text-xs">
                  {staffRoleLabelRu(operatorStaff.role)}
                </p>
              ) : null}
            </>
          ) : (
            <p className="text-muted-foreground">—</p>
          )}
        </div>
      </div>

      <div className="flex gap-3">
        <Bike
          className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0"
          aria-hidden
        />
        <div className="text-muted-foreground min-w-0 flex-1 space-y-0.5">
          <div className="text-foreground font-medium">Курьер</div>
          {order.courier_id == null ? (
            <p className="text-muted-foreground">—</p>
          ) : (
            <>
              {courierStaff?.name?.trim() ? (
                <p className="text-foreground">{courierStaff.name.trim()}</p>
              ) : (
                <p className="text-muted-foreground">—</p>
              )}
              {assignedAtHm ? (
                <p className="text-muted-foreground text-xs">
                  Назначен в {assignedAtHm}
                </p>
              ) : null}
            </>
          )}
        </div>
      </div>
    </section>
  )
}

function OrderDeliverySection({ order }: { order: AdminOrderDetailRow }) {
  const mode = order.delivery_mode

  if (mode === "pickup") {
    return (
      <section className="text-sm">
        <p className="text-muted-foreground">
          <MapPin className="mr-2 inline h-4 w-4 align-text-bottom" aria-hidden />
          Самовывоз
        </p>
      </section>
    )
  }

  if (mode === "aggregator") {
    return (
      <section className="text-sm">
        <p className="text-muted-foreground">
          <MapPin className="mr-2 inline h-4 w-4 align-text-bottom" aria-hidden />
          Заказ через Glovo
        </p>
      </section>
    )
  }

  if (mode !== "delivery") {
    return null
  }

  const addr = order.delivery_address?.trim()
  const comment = order.comment?.trim()
  const lines: { label: string; value: string }[] = []
  const ent = order.address_entrance?.trim()
  const fl = order.address_floor?.trim()
  const apt = order.address_apartment?.trim()
  const inter = order.address_intercom?.trim()
  if (ent) lines.push({ label: "Подъезд", value: ent })
  if (fl) lines.push({ label: "Этаж", value: fl })
  if (apt) lines.push({ label: "Квартира", value: apt })
  if (inter) lines.push({ label: "Домофон", value: inter })

  return (
    <section className="space-y-3 text-sm">
      <h3 className="font-heading flex items-center gap-2 font-semibold">
        <MapPin className="text-muted-foreground h-4 w-4 shrink-0" aria-hidden />
        Доставка
      </h3>
      <div className="text-muted-foreground space-y-2 pl-0">
        <p>
          <span className="text-muted-foreground">Адрес: </span>
          <span className="text-foreground break-words">
            {addr && addr.length > 0 ? addr : "—"}
          </span>
        </p>
        {lines.map((row) => (
          <p key={row.label}>
            <span className="text-muted-foreground">{row.label}: </span>
            <span className="text-foreground break-words">{row.value}</span>
          </p>
        ))}
        {comment ? (
          <p className="pt-1">
            <span className="text-muted-foreground">Комментарий: </span>
            <span className="text-foreground whitespace-pre-wrap break-words">
              {comment}
            </span>
          </p>
        ) : null}
      </div>
    </section>
  )
}

type TimelineNodeDef = {
  Icon: LucideIcon
  label: string
  field: keyof AdminOrderDetailRow
}

const BASE_TIMELINE: TimelineNodeDef[] = [
  { Icon: Clock, label: "Создан", field: "created_at" },
  { Icon: Send, label: "Бегунок", field: "cooking_started_at" },
  { Icon: ChefHat, label: "Готов", field: "ready_at" },
  { Icon: Bike, label: "Курьер назначен", field: "courier_assigned_at" },
  { Icon: Check, label: "Выполнен", field: "paid_at" },
]

function buildTimeline(order: AdminOrderDetailRow): {
  Icon: LucideIcon
  label: string
  at: string
  deltaMin: number | null
}[] {
  const cancel = order.status === "cancelled" || order.status === "rejected"
  let prevTs: string | null = null
  const out: {
    Icon: LucideIcon
    label: string
    at: string
    deltaMin: number | null
  }[] = []

  for (const step of BASE_TIMELINE) {
    if (cancel && step.field === "paid_at") continue
    const raw = order[step.field]
    const at = typeof raw === "string" ? raw : null
    if (!at) continue
    const deltaMin =
      prevTs == null ? null : minutesBetween(prevTs, at)
    prevTs = at
    out.push({
      Icon: step.Icon,
      label: step.label,
      at,
      deltaMin,
    })
  }

  if (cancel) {
    const at = order.updated_at
    const deltaMin =
      prevTs == null ? null : minutesBetween(prevTs, at)
    out.push({
      Icon: X,
      label: "Отменён",
      at,
      deltaMin,
    })
  }

  return out
}

type FooterSummary =
  | {
      variant: "done"
      totalMin: number
      prepMin: number | null
      deliveryMin: number | null
    }
  | { variant: "active"; createdIso: string }

function footerSummary(order: AdminOrderDetailRow): FooterSummary | null {
  const cancel = order.status === "cancelled" || order.status === "rejected"
  if (cancel) return null
  if (
    order.status === "done" &&
    order.created_at != null &&
    order.paid_at != null
  ) {
    const totalMin = minutesBetween(order.created_at, order.paid_at)
    if (order.cooking_started_at != null && order.ready_at != null) {
      return {
        variant: "done",
        totalMin,
        prepMin: minutesBetween(order.cooking_started_at, order.ready_at),
        deliveryMin: minutesBetween(order.ready_at, order.paid_at),
      }
    }
    return {
      variant: "done",
      totalMin,
      prepMin: null,
      deliveryMin: null,
    }
  }
  if (order.created_at != null && order.status !== "done") {
    return { variant: "active", createdIso: order.created_at }
  }
  return null
}

function brandName(order: AdminOrderDetailRow): string {
  const b = unwrapOne(order.brands)
  const n = b?.name?.trim()
  return n ?? "—"
}

function SkeletonContent() {
  return (
    <div className="space-y-6 px-1">
      <div className="space-y-4">
        <Skeleton className="h-6 w-32" />
        <div className="space-y-3 pl-8">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={`sk-${String(i)}`} className="flex gap-3">
              <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
              <div className="flex-1 space-y-2 pt-1">
                <Skeleton className="h-4 w-[70%]" />
                <Skeleton className="h-3 w-[40%]" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function OrderDetailSheet({ orderId, onClose }: OrderDetailSheetProps) {
  const [order, setOrder] = useState<AdminOrderDetailRow | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    if (orderId == null) {
      setOrder(null)
      setLoading(false)
      setLoadError(null)
      return
    }

    let cancelled = false
    setLoading(true)
    setLoadError(null)

    fetchAdminOrderDetail(orderId).then((res) => {
      if (cancelled) return
      setLoading(false)
      if (res.error) {
        setOrder(null)
        setLoadError(res.error)
      } else {
        setLoadError(null)
        setOrder(res.order)
      }
    })

    return () => {
      cancelled = true
    }
  }, [orderId])

  const nodes = order ? buildTimeline(order) : []
  const foot = order ? footerSummary(order) : null

  const aggregator =
    order != null &&
    typeof order.delivery_mode === "string" &&
    order.delivery_mode === "aggregator"

  const status = order?.status ?? null

  return (
    <Sheet
      open={orderId !== null}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <SheetContent
        side="right"
        showCloseButton={false}
        className="flex max-w-[560px] min-w-[480px] flex-col gap-0 p-0 sm:max-w-[560px]"
      >
        <SheetHeader className="border-border shrink-0 space-y-3 border-b p-4 pb-4">
          <div className="flex items-start gap-3 pr-12">
            <div className="min-w-0 flex-1 space-y-3">
              {loading ? (
                <>
                  <Skeleton className="h-7 w-28" />
                  <div className="flex flex-wrap gap-2">
                    <Skeleton className="h-6 w-20" />
                    <Skeleton className="h-6 w-24" />
                  </div>
                </>
              ) : order ? (
                <>
                  <SheetTitle className="text-lg">
                    #{order.order_number}
                  </SheetTitle>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary" className="font-normal">
                      {brandName(order)}
                    </Badge>
                    <Badge
                      className={cn(
                        "shrink-0 border-0 font-normal",
                        statusBadgeClass(status as OrderStatus),
                      )}
                    >
                      {statusLabel(status as OrderStatus)}
                    </Badge>
                    {aggregator ? (
                      <Badge className="border-0 bg-orange-100 font-normal text-orange-950 dark:bg-orange-950 dark:text-orange-100">
                        GLOVO
                      </Badge>
                    ) : null}
                  </div>
                </>
              ) : loadError ? (
                <SheetTitle className="text-destructive text-base">
                  Не удалось загрузить заказ
                </SheetTitle>
              ) : null}
            </div>
            <SheetClose asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="absolute top-3 right-3 shrink-0"
                aria-label="Закрыть"
              >
                <XIcon className="h-4 w-4" />
              </Button>
            </SheetClose>
          </div>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6">
          {loading ? <SkeletonContent /> : null}
          {!loading && loadError ? (
            <p className="text-muted-foreground text-sm">{loadError}</p>
          ) : null}
          {!loading && order && !loadError ? (
            <div className="space-y-6">
              <section>
                <h3 className="mb-4 font-heading font-semibold">Хронология</h3>

                <div className="space-y-0">
                  {nodes.length === 0 ? (
                    <p className="text-muted-foreground text-sm">Нет отметок</p>
                  ) : (
                    nodes.map((node, idx) => {
                      const isLast = idx === nodes.length - 1
                      return (
                        <div key={`${node.label}-${node.at}`} className="flex gap-3">
                          <div className="flex flex-col items-center">
                            <div
                              className={cn(
                                "bg-background z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border",
                              )}
                            >
                              <node.Icon className="text-muted-foreground h-5 w-5" />
                            </div>
                            {!isLast ? (
                              <div className="bg-border min-h-[20px] w-px flex-1 shrink-0" />
                            ) : null}
                          </div>
                          <div
                            className={cn(
                              "min-w-0 flex-1 pb-6",
                              isLast ? "pb-2" : null,
                            )}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="font-medium">{node.label}</div>
                                <div className="text-muted-foreground text-sm tabular-nums">
                                  {formatPointTime(node.at)}
                                </div>
                              </div>
                              <div className="text-muted-foreground shrink-0 text-sm tabular-nums whitespace-nowrap">
                                {node.deltaMin == null
                                  ? ""
                                  : `+${String(node.deltaMin)} мин`}
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>

                {foot ? (
                  <div className="mt-6 text-sm font-medium">
                    {foot.variant === "active" ? (
                      <div className="flex flex-wrap items-center gap-2 tabular-nums">
                        <span className="relative flex h-2 w-2">
                          <span
                            className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-55 motion-reduce:animate-none motion-reduce:opacity-0"
                            aria-hidden
                          />
                          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-600" />
                        </span>
                        <span>В работе:</span>
                        <span>
                          {formatDurationRu(foot.createdIso, Date.now())}
                        </span>
                      </div>
                    ) : foot.prepMin != null &&
                      foot.deliveryMin != null ? (
                      <p>
                        Итого:{" "}
                        <span className="tabular-nums font-semibold">
                          {foot.totalMin}
                        </span>{" "}
                        мин{" "}
                        <span className="text-muted-foreground font-normal">
                          (готовка:{" "}
                          <span className="tabular-nums">{foot.prepMin}</span>{" "}
                          мин, доставка:{" "}
                          <span className="tabular-nums">
                            {foot.deliveryMin}
                          </span>{" "}
                          мин)
                        </span>
                      </p>
                    ) : (
                      <p>
                        Итого:{" "}
                        <span className="tabular-nums font-semibold">
                          {foot.totalMin}
                        </span>{" "}
                        мин
                      </p>
                    )}
                  </div>
                ) : null}
              </section>

              <OrderCompositionAndPayment order={order} />
            </div>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  )
}
