"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PosBrandMark } from "@/components/pos/pos-brand-mark"
import { PosProductModal } from "@/components/pos/pos-product-modal"
import {
  PosHeaderIconButton,
  posHeaderCloseButtonClassName,
} from "@/components/pos/pos-header-icon-button"
import { SwipeToDelete } from "@/components/pos/swipe-to-delete"
import {
  removeOrderItemPos,
  updateOrderItemCompositionPos,
  updateOrderItemQuantityPos,
} from "@/lib/actions/pos/update-order-items"
import { orderItemSizeDisplayLabel } from "@/lib/order-item-size-display"
import {
  POS_MENU_ITEM_FOR_MODAL_SELECT,
  posMenuRowForModal,
} from "@/lib/pos/menu-item-modal-row"
import { createClient } from "@/lib/supabase/client"
import type { MenuItem, MenuItemVariant } from "@/types/database"
import type { PosCartItem, PosOrderSource, PosOrderStatus } from "@/types/pos"
import {
  CalendarDays,
  CreditCard,
  Minus,
  Phone,
  Plus,
  ReceiptText,
  Truck,
  User,
  Wallet,
  XIcon,
} from "lucide-react"
import Image from "next/image"
import { Fragment, useCallback, useEffect, useMemo, useState } from "react"

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

function statusBadge(status: PosOrderStatus) {
  switch (status) {
    case "draft":
      return (
        <Badge
          className="border-0 bg-zinc-200 text-zinc-800 hover:bg-zinc-200/90"
          variant="secondary"
        >
          Черновик
        </Badge>
      )
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
    case "rejected":
      return (
        <Badge variant="destructive" className="border-0">
          Отклонён
        </Badge>
      )
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
  variant_id: string | null
  size: string | null
  quantity: number
  price: number
  toppings: OrderItemTopping[] | null
  menu_items: MenuItemEmbed | MenuItemEmbed[]
}

type EditMenuItemModalRow = Pick<
  MenuItem,
  | "id"
  | "category_id"
  | "name_ru"
  | "description_ru"
  | "price"
  | "has_sizes"
  | "image_url"
> & {
  variants?: MenuItemVariant[] | null
  menu_item_variants?: MenuItemVariant[] | null
  menu_item_topping_groups?: { id: string }[] | null
}

type OrderDetailRow = {
  id: string
  order_number: number
  brand_id: string | null
  operator_id: string | null
  source: PosOrderSource | null
  status: PosOrderStatus
  user_name: string | null
  user_phone: string | null
  delivery_mode: "delivery" | "pickup"
  delivery_address: string | null
  address_entrance: string | null
  address_floor: string | null
  address_apartment: string | null
  address_intercom: string | null
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

function itemDisplayTitle(item: OrderItemRow): string {
  const displayName = itemDisplayName(item)
  const toppingNames = (item.toppings ?? [])
    .map((t) => t.name?.trim())
    .filter(Boolean)

  if (toppingNames.length === 0) return displayName

  const plusIndex = displayName.indexOf(" + ")
  if (plusIndex >= 0) return displayName.slice(0, plusIndex).trim()

  return displayName
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
    <section className={`rounded-xl bg-white p-3 @[640px]:p-4 ${className}`}>
      <div className="mb-4 flex items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-full bg-[#f2f2f2] text-[#242424]">
          {icon}
        </span>
        <h3 className="font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-[#808080]">
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
    <div className="flex min-w-0 flex-col gap-1 text-[14px] leading-snug @[640px]:grid @[640px]:grid-cols-[112px_minmax(0,1fr)] @[640px]:gap-3 @[640px]:leading-snug">
      <dt className="shrink-0 text-[#808080]">{label}</dt>
      <dd className="min-w-0 break-words font-medium text-[#242424]">
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
  /** Открывает шаг с меню (добавить позиции к существующему заказу). */
  onAddItemsToOrder: (orderId: string) => void
  /** Шаг 3 мастера — данные клиента, доставка, оплата. */
  onEditOrderDetails: (orderId: string) => void
  /** Только просмотр: без редактирования строк и действий статуса. */
  interactionMode?: "default" | "readonly"
}

export function OrderDetail({
  orderId,
  onClose,
  onAddItemsToOrder,
  onEditOrderDetails,
  interactionMode = "default",
}: OrderDetailProps) {
  const isReadOnly = interactionMode === "readonly"

  const [order, setOrder] = useState<OrderDetailRow | null>(null)
  const [operatorName, setOperatorName] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [statusBusy, setStatusBusy] = useState(false)
  const [itemBusyId, setItemBusyId] = useState<string | null>(null)
  const [productEditModal, setProductEditModal] = useState<{
    menuRow: EditMenuItemModalRow
    line: OrderItemRow
  } | null>(null)

  const brandSlug = order ? brandSlugFromRow(order) : ""

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
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "order_items",
          filter: `order_id=eq.${orderId}`,
        },
        () => {
          void loadOrder()
        },
      )
      .subscribe((status, error) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.error("[order-detail] realtime subscription", status, error)
        }
      })

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
    if (nextQuantity < 1) {
      await handleRemoveItem(item)
      return
    }

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

  const openEditMenuItemModal = async (line: OrderItemRow) => {
    const menuId = line.menu_item_id
    if (!menuId || itemBusyId) return

    setItemBusyId(line.id)
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("menu_items")
        .select(POS_MENU_ITEM_FOR_MODAL_SELECT)
        .eq("id", menuId)
        .maybeSingle()

      if (error || !data) {
        console.error(
          "[order-detail] edit load menu_item",
          error?.message ?? "empty",
        )
        return
      }
      setProductEditModal({
        menuRow: posMenuRowForModal(data as EditMenuItemModalRow),
        line,
      })
    } finally {
      setItemBusyId(null)
    }
  }

  const handleEditLineSave = async (
    itemIdLine: string,
    cartPayload: PosCartItem,
  ) => {
    if (!order || !cartPayload.menuItemId) return
    const toppingsDb = cartPayload.toppings.map((t) => ({
      name: t.name,
      price: Math.round(t.price),
    }))
    const displayName =
      toppingsDb.length > 0
        ? `${cartPayload.name} + ${toppingsDb.map((x) => x.name).join(", ")}`
        : cartPayload.name

    const result = await updateOrderItemCompositionPos({
      orderId: order.id,
      itemId: itemIdLine,
      menuItemId: cartPayload.menuItemId,
      itemName: displayName,
      size: cartPayload.size,
      variantId: cartPayload.variantId ?? null,
      quantity: cartPayload.qty,
      unitPriceBani: cartPayload.price,
      toppings: toppingsDb,
    })
    if (!result.success) throw new Error(result.error)
    setProductEditModal(null)
    await loadOrder()
  }

  if (loadError && !order) {
    return (
      <div className="flex h-full min-h-0 flex-col items-center justify-center gap-3 p-6">
        <p className="text-destructive text-center text-sm">{loadError}</p>
        <PosHeaderIconButton
          aria-label="Закрыть"
          className={posHeaderCloseButtonClassName}
          onClick={onClose}
        >
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
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center justify-between gap-4 px-5 py-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[22px] font-bold leading-none tracking-[-0.03em] text-[#242424]">
              Заказ #{order.order_number}
            </h2>
            {brandSlug ? (
              <PosBrandMark brandSlug={brandSlug} size="md" />
            ) : null}
            {statusBadge(order.status)}
          </div>
          <p className="mt-2 text-[13px] text-[#808080]">
            Создан {formatDateTime(order.created_at)}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <PosHeaderIconButton
            onClick={onClose}
            aria-label="Закрыть"
            className={posHeaderCloseButtonClassName}
          >
            <XIcon className="size-5" />
          </PosHeaderIconButton>
        </div>
      </div>

      <div className="@container min-h-0 min-w-0 flex-1 overflow-y-auto px-5 pb-5">
        <div className="flex flex-col gap-4 @[640px]:grid @[640px]:grid-cols-12 @[640px]:gap-4">
          <div className="flex min-w-0 flex-col gap-4 @[640px]:col-span-5">
            <DetailCard title="Данные клиента" icon={<User className="size-4" />}>
              <dl className="grid gap-3">
                <InfoRow label="Имя" value={order.user_name?.trim() || "—"} />
                <InfoRow label="Телефон">
                  {order.user_phone?.trim() ? (
                    <a
                      href={`tel:${order.user_phone.replace(/\s/g, "")}`}
                      className="inline-flex min-w-0 items-center gap-2 text-[#242424] hover:underline"
                    >
                      <Phone className="size-4 shrink-0 text-[#808080]" aria-hidden />
                      <span className="truncate">{order.user_phone}</span>
                    </a>
                  ) : (
                    <span className="text-[#808080]">—</span>
                  )}
                </InfoRow>
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
                {order.delivery_mode === "delivery" ? (
                  <>
                    <InfoRow label="Подъезд">
                      <span className="break-words">
                        {order.address_entrance?.trim() || "—"}
                      </span>
                    </InfoRow>
                    <InfoRow label="Этаж">
                      <span className="break-words">
                        {order.address_floor?.trim() || "—"}
                      </span>
                    </InfoRow>
                    <InfoRow label="Квартира">
                      <span className="break-words">
                        {order.address_apartment?.trim() || "—"}
                      </span>
                    </InfoRow>
                    <InfoRow label="Домофон">
                      <span className="break-words">
                        {order.address_intercom?.trim() || "—"}
                      </span>
                    </InfoRow>
                  </>
                ) : null}
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

          <div className="flex min-w-0 flex-col @[640px]:col-span-7 @[640px]:min-h-[min(420px,calc(100vh-340px))] @[640px]:lg:min-h-[480px]">
            <section className="flex min-h-0 min-w-0 flex-1 flex-col rounded-xl bg-white p-3 @[640px]:min-h-full @[640px]:p-4">
                <div className="mb-4 flex shrink-0 flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#f2f2f2] text-[#242424]">
                    <ReceiptText className="size-4" aria-hidden />
                  </span>
                  <h3 className="font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-[#808080]">
                    Данные о заказе
                  </h3>
                </div>
                {!isReadOnly ? (
                  <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-8 shrink-0 rounded-lg border border-[#f2f2f2] bg-white px-3 text-[11px] font-bold uppercase tracking-[0.06em] text-[#242424] shadow-none hover:bg-[#f2f2f2]"
                      onClick={() => onEditOrderDetails(order.id)}
                    >
                      Редактировать данные
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-8 shrink-0 rounded-lg border border-[#f2f2f2] bg-white px-3 text-[11px] font-bold uppercase tracking-[0.08em] text-[#242424] shadow-none hover:bg-[#f2f2f2]"
                      onClick={() => onAddItemsToOrder(order.id)}
                    >
                      Добавить к заказу
                    </Button>
                  </div>
                ) : null}
              </div>

              <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-0">
                <div className="min-h-0 flex-1 overflow-y-auto">
                  <div className="space-y-2 pr-1">
                    {(order.order_items ?? []).map((itemRow) => {
                      const embed = itemMenuEmbed(itemRow)
                      const imageUrl = embed?.image_url
                      const toppings = itemRow.toppings ?? []
                      const isBusy = itemBusyId === itemRow.id
                      const canRemove = (order.order_items?.length ?? 0) > 1
                      const hasMenuBinding = Boolean(itemRow.menu_item_id)

                      const articleInner = (
                        <article
                          className="flex flex-wrap items-start gap-2 rounded-lg bg-[#f2f2f2] p-2 @[480px]:flex-nowrap @[480px]:items-center @[480px]:gap-2.5"
                        >
                          <div className="relative size-12 shrink-0 overflow-hidden rounded-full bg-white">
                            {imageUrl ? (
                              <Image
                                src={imageUrl}
                                alt=""
                                fill
                                className="object-cover"
                                sizes="48px"
                              />
                            ) : null}
                          </div>

                          <div className="min-w-0 flex-1">
                            <p className="line-clamp-1 text-[13px] font-bold leading-tight text-[#242424]">
                              {itemDisplayTitle(itemRow)}
                              {orderItemSizeDisplayLabel(itemRow.size)
                                ? ` · ${orderItemSizeDisplayLabel(itemRow.size)}`
                                : ""}
                            </p>
                            {toppings.length > 0 ? (
                              <p className="mt-0.5 line-clamp-1 text-[11px] leading-tight text-[#808080]">
                                {toppings
                                  .map((t) => t.name)
                                  .filter(Boolean)
                                  .join(", ")}
                              </p>
                            ) : null}
                            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                              <span className="font-mono text-[11px] tabular-nums text-[#808080]">
                                {formatMdl(unitPriceBani(itemRow))} / шт.
                              </span>
                              {!isReadOnly ? (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 shrink-0 rounded-full px-2.5 text-[11px] font-bold text-[#242424] hover:bg-white active:bg-[#e8e8e8] disabled:opacity-40"
                                  disabled={isBusy || !hasMenuBinding}
                                  onClick={() => void openEditMenuItemModal(itemRow)}
                                >
                                  Изменить
                                </Button>
                              ) : null}
                            </div>
                          </div>

                          <div className="ml-auto flex w-full shrink-0 flex-wrap items-center justify-end gap-2 @[480px]:ml-0 @[480px]:w-auto @[480px]:justify-start @[480px]:gap-2.5">
                            {isReadOnly ? (
                              <span className="w-5 text-center font-mono text-[12px] font-bold tabular-nums text-[#242424]">
                                ×{itemRow.quantity}
                              </span>
                            ) : (
                              <div className="flex shrink-0 items-center gap-1 rounded-full bg-white p-0.5">
                                <button
                                  type="button"
                                  aria-label="Уменьшить количество"
                                  disabled={isBusy}
                                  onClick={() => void handleQuantityChange(itemRow, -1)}
                                  className="flex size-6 items-center justify-center rounded-full text-[#242424] transition-colors hover:bg-[#f2f2f2] disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                  <Minus className="size-3.5" />
                                </button>
                                <span className="w-5 text-center font-mono text-[12px] font-bold tabular-nums text-[#242424]">
                                  {itemRow.quantity}
                                </span>
                                <button
                                  type="button"
                                  aria-label="Увеличить количество"
                                  disabled={isBusy}
                                  onClick={() => void handleQuantityChange(itemRow, 1)}
                                  className="flex size-6 items-center justify-center rounded-full text-[#242424] transition-colors hover:bg-[#f2f2f2] disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                  <Plus className="size-3.5" />
                                </button>
                              </div>
                            )}

                            <div className="flex min-w-[6.5rem] items-center gap-2">
                              <div className="min-w-[5.5rem] shrink-0 text-right font-mono text-[12px] font-bold tabular-nums text-[#242424]">
                                {formatMdl(itemRow.price)}
                              </div>
                            </div>
                          </div>
                        </article>
                      )

                      return (
                        <Fragment key={itemRow.id}>
                          {isReadOnly ? (
                            articleInner
                          ) : (
                            <SwipeToDelete
                              disabled={isBusy || !canRemove}
                              onDelete={() => void handleRemoveItem(itemRow)}
                            >
                              {articleInner}
                            </SwipeToDelete>
                          )}
                        </Fragment>
                      )
                    })}
                  </div>
                </div>

                <dl className="mt-4 shrink-0 rounded-xl bg-[#f2f2f2] p-4 pt-6">
                  <SummaryRow label="Подытог" value={formatMdl(subtotalBani)} />
                  <SummaryRow label="Доставка" value={formatMdl(order.delivery_fee)} />
                  {order.discount > 0 ? (
                    <SummaryRow
                      label={
                        order.promo_code ? `Скидка · ${order.promo_code}` : "Скидка"
                      }
                      value={`−${formatMdl(order.discount)}`}
                      tone="discount"
                    />
                  ) : null}
                  <SummaryRow label="Итого" value={formatMdl(order.total)} tone="total" />
                </dl>
              </div>
            </section>
          </div>
        </div>
      </div>

      <PosProductModal
        item={productEditModal?.menuRow ?? null}
        editDraft={
          productEditModal
            ? {
                orderItemId: productEditModal.line.id,
                qty: productEditModal.line.quantity,
                size: productEditModal.line.size,
                variantId: productEditModal.line.variant_id,
                toppings: (productEditModal.line.toppings ?? []).flatMap((t) => {
                  const name = typeof t?.name === "string" ? t.name : ""
                  const priceRaw = typeof t?.price === "number" ? t.price : NaN
                  if (!name || !Number.isFinite(priceRaw)) return []
                  return [{ name, price: Math.round(priceRaw) }]
                }),
              }
            : null
        }
        onEditSave={(lineId, cartLine) =>
          handleEditLineSave(lineId, cartLine)
        }
        onAdd={() => {}}
        onClose={() => setProductEditModal(null)}
      />

      {!isReadOnly ? (
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
      ) : order.status === "done" ? (
        <div className="mt-auto shrink-0 border-t border-[#e8e8e8] bg-white p-3">
          <p className="text-center text-sm text-[#808080]">Заказ выдан</p>
        </div>
      ) : null}
    </div>
  )
}
