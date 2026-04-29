"use client"

import { brands } from "@/brands/index"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PosHeaderIconButton } from "@/components/pos/pos-header-icon-button"
import {
  removeOrderItemPos,
  updateOrderItemQuantityPos,
} from "@/lib/actions/pos/update-order-items"
import { createClient } from "@/lib/supabase/client"
import type { PosOrderSource, PosOrderStatus } from "@/types/pos"
import {
  CalendarDays,
  CreditCard,
  Minus,
  Phone,
  Plus,
  ReceiptText,
  Trash2,
  Truck,
  User,
  Wallet,
  XIcon,
} from "lucide-react"
import Image from "next/image"
import { useCallback, useEffect, useMemo, useState } from "react"

function accentForBrandSlug(slug: string): string {
  return brands.find((x) => x.slug === slug)?.colors.accent ?? "#888"
}

function brandNameForSlug(slug: string): string {
  return brands.find((x) => x.slug === slug)?.name ?? slug
}

function formatMdl(bani: number): string {
  return `${(bani / 100).toLocaleString("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} MDL`
}

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  } catch {
    return iso
  }
}

function formatBirthday(s: string | null): string {
  if (!s) return "—"
  const d = s.slice(0, 10)
  return d.length === 10 ? d.split("-").reverse().join(".") : s
}

function statusBadge(status: PosOrderStatus) {
  switch (status) {
    case "new":
      return (
        <Badge
          className="border-0 bg-amber-400 text-amber-950 hover:bg-amber-400/90"
          variant="secondary"
        >
          Новый
        </Badge>
      )
    case "in_progress":
      return (
        <Badge
          className="border-0 bg-blue-600 text-white hover:bg-blue-600/90"
          variant="default"
        >
          Готовится
        </Badge>
      )
    case "delivering":
      return (
        <Badge
          className="border-0 bg-orange-500 text-white hover:bg-orange-500/90"
          variant="default"
        >
          Доставляется
        </Badge>
      )
    case "done":
      return (
        <Badge
          className="border-0 bg-emerald-600 text-white hover:bg-emerald-600/90"
          variant="default"
        >
          Выдан
        </Badge>
      )
    case "cancelled":
      return <Badge variant="destructive">Отменён</Badge>
    default:
      return null
  }
}

function parseSource(v: unknown): PosOrderSource {
  return v === "pos" ? "pos" : "website"
}

type BrandsEmbed = { slug: string } | { slug: string }[] | null

type MenuItemEmbed = { name_ru: string; image_url: string | null } | null

type OrderItemTopping = {
  name?: string
  price?: number
}

type OrderItemRow = {
  id: string
  item_name: string
  menu_item_id: string | null
  size: string | null
  quantity: number
  price: number
  toppings: OrderItemTopping[] | null
  menu_items: MenuItemEmbed | MenuItemEmbed[]
}

type OrderDetailRow = {
  id: string
  order_number: number
  brand_id: string
  operator_id: string | null
  source: PosOrderSource | null
  status: PosOrderStatus
  user_name: string | null
  user_phone: string
  user_birthday: string | null
  delivery_mode: "delivery" | "pickup"
  delivery_address: string | null
  payment_method: "cash" | "card"
  change_from: number | null
  total: number
  delivery_fee: number
  discount: number
  promo_code: string | null
  comment: string | null
  created_at: string
  updated_at: string
  brands: BrandsEmbed
  order_items: OrderItemRow[] | null
}

function brandSlugFromRow(row: OrderDetailRow): string {
  const b = row.brands
  if (!b) return ""
  if (Array.isArray(b)) return b[0]?.slug ?? ""
  return b.slug ?? ""
}

function paymentLabel(m: "cash" | "card"): string {
  return m === "cash" ? "Наличные" : "Карта"
}

function changeFromDisplay(bani: number | null): string {
  if (bani == null || bani <= 0) return "—"
  return formatMdl(bani)
}

function unitPriceBani(item: OrderItemRow): number {
  if (item.quantity <= 0) return Math.round(item.price)
  return Math.round(item.price / item.quantity)
}

function itemMenuEmbed(item: OrderItemRow): MenuItemEmbed {
  return Array.isArray(item.menu_items) ? item.menu_items[0] ?? null : item.menu_items
}

function itemDisplayName(item: OrderItemRow): string {
  return item.item_name || itemMenuEmbed(item)?.name_ru || "—"
}

function DetailCard({
  title,
  icon,
  children,
  className = "",
}: {
  title: string
  icon: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={`rounded-xl bg-white p-4 ${className}`}>
      <div className="mb-4 flex items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-full bg-[#f2f2f2] text-[#242424]">
          {icon}
        </span>
        <h3 className="text-[13px] font-bold uppercase tracking-[0.16em] text-[#808080]">
          {title}
        </h3>
      </div>
      {children}
    </section>
  )
}

function InfoRow({
  label,
  value,
  children,
}: {
  label: string
  value?: React.ReactNode
  children?: React.ReactNode
}) {
  return (
    <div className="grid grid-cols-[112px_minmax(0,1fr)] gap-3 text-[14px] leading-snug">
      <dt className="text-[#808080]">{label}</dt>
      <dd className="min-w-0 font-medium text-[#242424]">
        {children ?? value ?? "—"}
      </dd>
    </div>
  )
}

function SummaryRow({
  label,
  value,
  tone = "default",
}: {
  label: string
  value: string
  tone?: "default" | "discount" | "total"
}) {
  return (
    <div
      className={
        tone === "total"
          ? "flex items-baseline justify-between gap-4 pt-2 text-[16px] font-bold text-[#242424]"
          : "flex items-baseline justify-between gap-4 text-[13px] text-[#808080]"
      }
    >
      <dt>{label}</dt>
      <dd
        className={
          tone === "discount"
            ? "font-mono tabular-nums text-emerald-700"
            : "font-mono tabular-nums text-[#242424]"
        }
      >
        {value}
      </dd>
    </div>
  )
}

type OrderDetailProps = {
  orderId: string
  onClose: () => void
}

export function OrderDetail({ orderId, onClose }: OrderDetailProps) {
  const [order, setOrder] = useState<OrderDetailRow | null>(null)
  const [operatorName, setOperatorName] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [statusBusy, setStatusBusy] = useState(false)
  const [itemBusyId, setItemBusyId] = useState<string | null>(null)

  const accent = useMemo(
    () => accentForBrandSlug(order ? brandSlugFromRow(order) : ""),
    [order],
  )
  const brandSlug = order ? brandSlugFromRow(order) : ""
  const brandName = brandNameForSlug(brandSlug)

  const loadOrder = useCallback(async () => {
    setLoadError(null)
    const supabase = createClient()
    const { data, error } = await supabase
      .from("orders")
      .select("*, brands(slug), order_items(*, menu_items(name_ru, image_url))")
      .eq("id", orderId)
      .maybeSingle()

    if (error) {
      setLoadError(error.message)
      setOrder(null)
      return
    }
    if (!data) {
      setLoadError("Заказ не найден")
      setOrder(null)
      return
    }
    setOrder(data as OrderDetailRow)

    const opId = (data as OrderDetailRow).operator_id
    if (opId) {
      const { data: staff } = await supabase
        .from("staff")
        .select("name")
        .eq("id", opId)
        .maybeSingle()
      setOperatorName((staff as { name: string } | null)?.name ?? null)
    } else {
      setOperatorName(null)
    }
  }, [orderId])

  useEffect(() => {
    void loadOrder()
  }, [loadOrder])

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`pos-order-${orderId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
          filter: `id=eq.${orderId}`,
        },
        () => {
          void loadOrder()
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [orderId, loadOrder])

  const subtotalBani = useMemo(() => {
    if (!order?.order_items?.length) return 0
    return order.order_items.reduce((s, it) => s + it.price, 0)
  }, [order])

  const handleStatus = async (next: PosOrderStatus) => {
    if (!order) return
    setStatusBusy(true)
    const supabase = createClient()
    const updatedAt = new Date().toISOString()
    const { error } = await supabase
      .from("orders")
      .update({ status: next, updated_at: updatedAt })
      .eq("id", order.id)

    if (error) {
      console.error("[order-detail] status", error.message)
    }
    await loadOrder()
    setStatusBusy(false)
  }

  const handleQuantityChange = async (item: OrderItemRow, delta: number) => {
    if (!order || itemBusyId) return
    const nextQuantity = item.quantity + delta
    if (nextQuantity < 1) return

    setItemBusyId(item.id)
    try {
      const result = await updateOrderItemQuantityPos({
        orderId: order.id,
        itemId: item.id,
        quantity: nextQuantity,
      })
      if (!result.success) throw new Error(result.error)
      await loadOrder()
    } catch (error) {
      console.error(
        "[order-detail] quantity",
        error instanceof Error ? error.message : error,
      )
    } finally {
      setItemBusyId(null)
    }
  }

  const handleRemoveItem = async (item: OrderItemRow) => {
    if (!order || itemBusyId) return
    const items = order.order_items ?? []
    if (items.length <= 1) return

    setItemBusyId(item.id)
    try {
      const result = await removeOrderItemPos({
        orderId: order.id,
        itemId: item.id,
      })
      if (!result.success) throw new Error(result.error)
      await loadOrder()
    } catch (error) {
      console.error(
        "[order-detail] remove item",
        error instanceof Error ? error.message : error,
      )
    } finally {
      setItemBusyId(null)
    }
  }

  if (loadError && !order) {
    return (
      <div className="flex h-full min-h-0 flex-col items-center justify-center gap-3 p-6">
        <p className="text-destructive text-center text-sm">{loadError}</p>
        <PosHeaderIconButton aria-label="Закрыть" onClick={onClose}>
          <XIcon className="size-5" />
        </PosHeaderIconButton>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center p-6 text-sm">
        Загрузка…
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center justify-between gap-4 px-5 py-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[22px] font-bold leading-none tracking-[-0.03em] text-[#242424]">
              Заказ #{order.order_number}
            </h2>
            <Badge
              className="max-w-[200px] truncate border-0 text-white"
              style={{ backgroundColor: accent }}
              variant="default"
            >
              {brandName}
            </Badge>
            {statusBadge(order.status)}
          </div>
          <p className="mt-2 text-[13px] text-[#808080]">
            Создан {formatDateTime(order.created_at)}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <PosHeaderIconButton onClick={onClose} aria-label="Закрыть">
            <XIcon className="size-5" />
          </PosHeaderIconButton>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-5 flex min-w-0 flex-col gap-4">
            <DetailCard title="Данные клиента" icon={<User className="size-4" />}>
              <dl className="grid gap-3">
                <InfoRow label="Имя" value={order.user_name?.trim() || "—"} />
                <InfoRow label="Телефон">
                  <a
                    href={`tel:${order.user_phone.replace(/\s/g, "")}`}
                    className="inline-flex min-w-0 items-center gap-2 text-[#242424] hover:underline"
                  >
                    <Phone className="size-4 shrink-0 text-[#808080]" aria-hidden />
                    <span className="truncate">{order.user_phone}</span>
                  </a>
                </InfoRow>
                <InfoRow
                  label="День рождения"
                  value={formatBirthday(order.user_birthday)}
                />
              </dl>
            </DetailCard>

            <DetailCard title="Доставка и оплата" icon={<Truck className="size-4" />}>
              <dl className="grid gap-3">
                <InfoRow
                  label="Режим"
                  value={
                    order.delivery_mode === "delivery" ? "Доставка" : "Самовывоз"
                  }
                />
                <InfoRow label="Адрес">
                  <span className="break-words">
                    {order.delivery_address?.trim() || "—"}
                  </span>
                </InfoRow>
                <InfoRow label="Оплата">
                  <span className="inline-flex items-center gap-2">
                    {order.payment_method === "cash" ? (
                      <Wallet className="size-4 text-[#808080]" aria-hidden />
                    ) : (
                      <CreditCard className="size-4 text-[#808080]" aria-hidden />
                    )}
                    {paymentLabel(order.payment_method)}
                  </span>
                </InfoRow>
                <InfoRow
                  label="Сдача с"
                  value={changeFromDisplay(order.change_from)}
                />
              </dl>
            </DetailCard>

            <DetailCard title="Служебное" icon={<CalendarDays className="size-4" />}>
              <dl className="grid gap-3">
                <InfoRow
                  label="Источник"
                  value={parseSource(order.source) === "website" ? "Сайт" : "POS"}
                />
                <InfoRow label="Оператор" value={operatorName ?? "—"} />
                <InfoRow label="Обновлён" value={formatDateTime(order.updated_at)} />
                <InfoRow label="Комментарий">
                  <span className="break-words">
                    {order.comment?.trim() || "—"}
                  </span>
                </InfoRow>
              </dl>
            </DetailCard>
          </div>

          <DetailCard
            title="Данные о заказе"
            icon={<ReceiptText className="size-4" />}
            className="col-span-7 min-w-0"
          >
            <div className="space-y-3">
              {(order.order_items ?? []).map((item) => {
                const embed = itemMenuEmbed(item)
                const imageUrl = embed?.image_url
                const toppings = item.toppings ?? []
                const isBusy = itemBusyId === item.id
                const canRemove = (order.order_items?.length ?? 0) > 1

                return (
                  <article
                    key={item.id}
                    className="flex items-center gap-3 rounded-xl bg-[#f2f2f2] p-3"
                  >
                    <div className="relative size-14 shrink-0 overflow-hidden rounded-full bg-white">
                      {imageUrl ? (
                        <Image
                          src={imageUrl}
                          alt=""
                          fill
                          className="object-cover"
                          sizes="56px"
                        />
                      ) : null}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-1 text-[14px] font-bold text-[#242424]">
                        {itemDisplayName(item)}
                        {item.size ? ` · ${item.size.toUpperCase()}` : ""}
                      </p>
                      {toppings.length > 0 ? (
                        <p className="mt-1 line-clamp-1 text-[12px] text-[#808080]">
                          {toppings.map((t) => t.name).filter(Boolean).join(", ")}
                        </p>
                      ) : null}
                      <p className="mt-1 font-mono text-[12px] tabular-nums text-[#808080]">
                        {formatMdl(unitPriceBani(item))} / шт.
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-2 rounded-full bg-white p-1">
                      <button
                        type="button"
                        aria-label="Уменьшить количество"
                        disabled={isBusy || item.quantity <= 1}
                        onClick={() => void handleQuantityChange(item, -1)}
                        className="flex size-7 items-center justify-center rounded-full text-[#242424] transition-colors hover:bg-[#f2f2f2] disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Minus className="size-3.5" />
                      </button>
                      <span className="w-5 text-center font-mono text-[13px] font-bold tabular-nums text-[#242424]">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        aria-label="Увеличить количество"
                        disabled={isBusy}
                        onClick={() => void handleQuantityChange(item, 1)}
                        className="flex size-7 items-center justify-center rounded-full text-[#242424] transition-colors hover:bg-[#f2f2f2] disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Plus className="size-3.5" />
                      </button>
                    </div>

                    <div className="w-[92px] shrink-0 text-right font-mono text-[13px] font-bold tabular-nums text-[#242424]">
                      {formatMdl(item.price)}
                    </div>

                    <button
                      type="button"
                      aria-label="Удалить позицию"
                      disabled={isBusy || !canRemove}
                      onClick={() => void handleRemoveItem(item)}
                      className="flex size-8 shrink-0 items-center justify-center rounded-full text-[#808080] transition-colors hover:bg-white hover:text-[#242424] disabled:cursor-not-allowed disabled:opacity-35"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </article>
                )
              })}
            </div>

            <dl className="mt-4 rounded-xl bg-[#f2f2f2] p-4">
              <SummaryRow label="Подытог" value={formatMdl(subtotalBani)} />
              <SummaryRow label="Доставка" value={formatMdl(order.delivery_fee)} />
              {order.discount > 0 ? (
                <SummaryRow
                  label={order.promo_code ? `Скидка · ${order.promo_code}` : "Скидка"}
                  value={`−${formatMdl(order.discount)}`}
                  tone="discount"
                />
              ) : null}
              <SummaryRow label="Итого" value={formatMdl(order.total)} tone="total" />
            </dl>
          </DetailCard>
        </div>
      </div>

      <div className="mt-auto shrink-0 space-y-2 border-t border-[#e8e8e8] bg-white p-3">
        {order.status === "done" || order.status === "cancelled" ? (
          <p className="text-muted-foreground text-center text-sm">
            {order.status === "done"
              ? "Заказ выдан"
              : "Заказ отменён"}
          </p>
        ) : null}
        {order.status === "new" && parseSource(order.source) === "website" ? (
          <div className="flex flex-col gap-2">
            <Button
              type="button"
              variant="outline"
              className="w-full border-destructive/40 text-destructive hover:bg-destructive/10"
              disabled={statusBusy}
              onClick={() => void handleStatus("cancelled")}
            >
              Отклонить
            </Button>
            <Button
              type="button"
              variant="default"
              className="w-full"
              disabled={statusBusy}
              onClick={() => void handleStatus("in_progress")}
            >
              Принять
            </Button>
          </div>
        ) : null}
        {order.status === "new" && parseSource(order.source) === "pos" ? (
          <Button
            type="button"
            variant="default"
            className="w-full"
            disabled={statusBusy}
            onClick={() => void handleStatus("in_progress")}
          >
            В работу
          </Button>
        ) : null}
        {order.status === "in_progress" ? (
          <Button
            type="button"
            variant="default"
            className="w-full"
            disabled={statusBusy}
            onClick={() => void handleStatus("delivering")}
          >
            Готово к выдаче
          </Button>
        ) : null}
        {order.status === "delivering" ? (
          <Button
            type="button"
            variant="default"
            className="w-full"
            disabled={statusBusy}
            onClick={() => void handleStatus("done")}
          >
            Выдан
          </Button>
        ) : null}
      </div>
    </div>
  )
}
