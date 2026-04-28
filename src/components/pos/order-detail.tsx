"use client"

import { brands } from "@/brands/index"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PosHeaderIconButton } from "@/components/pos/pos-header-icon-button"
import { Separator } from "@/components/ui/separator"
import { createClient } from "@/lib/supabase/client"
import type { PosOrder, PosOrderSource, PosOrderStatus } from "@/types/pos"
import { Phone, XIcon } from "lucide-react"
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

type MenuItemEmbed = { name_ru: string } | null

type OrderItemRow = {
  id: string
  item_name: string
  size: string | null
  quantity: number
  price: number
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

type OrderDetailProps = {
  orderId: string
  onClose: () => void
  onEdit: (order: PosOrder) => void
}

export function OrderDetail({ orderId, onClose, onEdit }: OrderDetailProps) {
  const [order, setOrder] = useState<OrderDetailRow | null>(null)
  const [operatorName, setOperatorName] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [statusBusy, setStatusBusy] = useState(false)

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
      .select("*, brands(slug), order_items(*, menu_items(name_ru))")
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

  void onEdit

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
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex items-start justify-between gap-2 px-4 pt-4 pb-2">
          <h2 className="text-lg font-semibold">
            Заказ #{order.order_number}
          </h2>
          <PosHeaderIconButton onClick={onClose} aria-label="Закрыть">
            <XIcon className="size-5" />
          </PosHeaderIconButton>
        </div>

        <div className="flex flex-wrap items-center gap-2 px-4 pb-3">
          <Badge
            className="max-w-[200px] truncate border-0 text-white"
            style={{ backgroundColor: accent }}
            variant="default"
          >
            {brandName}
          </Badge>
          {statusBadge(order.status)}
        </div>

        <Separator />

        <section className="space-y-2 px-4 py-3">
          <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
            Клиент
          </h3>
          <dl className="grid gap-1 text-sm">
            <div className="flex gap-2">
              <dt className="text-muted-foreground w-28 shrink-0">Имя</dt>
              <dd>{order.user_name?.trim() || "—"}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-muted-foreground w-28 shrink-0">Телефон</dt>
              <dd>
                <a
                  href={`tel:${order.user_phone.replace(/\s/g, "")}`}
                  className="text-primary inline-flex items-center gap-1 font-medium hover:underline"
                >
                  <Phone className="size-3.5 shrink-0" aria-hidden />
                  {order.user_phone}
                </a>
              </dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-muted-foreground w-28 shrink-0">
                День рождения
              </dt>
              <dd>{formatBirthday(order.user_birthday)}</dd>
            </div>
          </dl>
        </section>

        <Separator />

        <section className="space-y-2 px-4 py-3">
          <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
            Доставка
          </h3>
          <dl className="grid gap-1 text-sm">
            <div className="flex gap-2">
              <dt className="text-muted-foreground w-28 shrink-0">Режим</dt>
              <dd>
                {order.delivery_mode === "delivery"
                  ? "Доставка"
                  : "Самовывоз"}
              </dd>
            </div>
            {order.delivery_mode === "delivery" ? (
              <div className="flex gap-2">
                <dt className="text-muted-foreground w-28 shrink-0">Адрес</dt>
                <dd className="min-w-0 break-words">
                  {order.delivery_address?.trim() || "—"}
                </dd>
              </div>
            ) : null}
            <div className="flex gap-2">
              <dt className="text-muted-foreground w-28 shrink-0">Оплата</dt>
              <dd>{paymentLabel(order.payment_method)}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-muted-foreground w-28 shrink-0">Сдача с</dt>
              <dd>{changeFromDisplay(order.change_from)}</dd>
            </div>
          </dl>
        </section>

        <Separator />

        <section className="space-y-2 px-4 py-3">
          <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
            Состав заказа
          </h3>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="px-2 py-1.5 text-left font-medium">Позиция</th>
                  <th className="px-2 py-1.5 text-left font-medium">Размер</th>
                  <th className="px-2 py-1.5 text-right font-medium">Кол-во</th>
                  <th className="px-2 py-1.5 text-right font-medium">Сумма</th>
                </tr>
              </thead>
              <tbody>
                {(order.order_items ?? []).map((it) => {
                  const mi = Array.isArray(it.menu_items)
                    ? it.menu_items[0]
                    : it.menu_items
                  const nm = it.item_name || mi?.name_ru || "—"
                  return (
                    <tr key={it.id} className="border-t">
                      <td className="max-w-[140px] truncate px-2 py-1.5">
                        {nm}
                      </td>
                      <td className="text-muted-foreground px-2 py-1.5">
                        {it.size?.toUpperCase() ?? "—"}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums">
                        {it.quantity}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums">
                        {formatMdl(it.price)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <Separator />

          <dl className="space-y-1 text-right text-sm">
            <div className="flex justify-end gap-4">
              <dt className="text-muted-foreground">Подытог</dt>
              <dd className="min-w-[5rem] tabular-nums">
                {formatMdl(subtotalBani)}
              </dd>
            </div>
            <div className="flex justify-end gap-4">
              <dt className="text-muted-foreground">Доставка</dt>
              <dd className="min-w-[5rem] tabular-nums">
                {formatMdl(order.delivery_fee)}
              </dd>
            </div>
            {order.discount > 0 ? (
              <div className="flex justify-end gap-4">
                <dt className="text-muted-foreground">Скидка</dt>
                <dd className="min-w-[5rem] tabular-nums text-emerald-700">
                  −{formatMdl(order.discount)}
                </dd>
              </div>
            ) : null}
            <div className="flex justify-end gap-4 font-semibold">
              <dt>Итого</dt>
              <dd className="min-w-[5rem] tabular-nums">
                {formatMdl(order.total)}
              </dd>
            </div>
          </dl>
        </section>

        <Separator />

        <section className="space-y-2 px-4 py-3 pb-24">
          <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
            Служебное
          </h3>
          <dl className="grid gap-1 text-sm">
            <div className="flex gap-2">
              <dt className="text-muted-foreground w-28 shrink-0">Источник</dt>
              <dd>
                {parseSource(order.source) === "website" ? "Сайт" : "POS"}
              </dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-muted-foreground w-28 shrink-0">Оператор</dt>
              <dd>{operatorName ?? "—"}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-muted-foreground w-28 shrink-0">Создан</dt>
              <dd>{formatDateTime(order.created_at)}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-muted-foreground w-28 shrink-0">Обновлён</dt>
              <dd>{formatDateTime(order.updated_at)}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-muted-foreground w-28 shrink-0">Комментарий</dt>
              <dd className="min-w-0 break-words">
                {order.comment?.trim() || "—"}
              </dd>
            </div>
          </dl>
        </section>
      </div>

      <div className="bg-background border-border sticky bottom-0 mt-auto shrink-0 space-y-2 border-t p-3">
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
