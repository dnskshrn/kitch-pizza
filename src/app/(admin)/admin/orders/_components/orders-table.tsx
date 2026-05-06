"use client"

import { Fragment, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { ChevronDown, ChevronRight, Eye } from "lucide-react"
import { toast } from "sonner"
import type { OrderItem, OrderStatus, OrderWithItems } from "@/types/database"
import { updateOrderStatus } from "@/lib/actions/update-order-status"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import {
  formatCreatedAt,
  formatLei,
  paymentLabel,
  pluralPositions,
  sizeLabelRu,
  sortedItems,
  statusBadgeClass,
  statusLabel,
  truncateAddress,
} from "./order-helpers"

type OrdersTableProps = {
  orders: OrderWithItems[]
}

function orderSubtotalBani(order: OrderWithItems): number {
  return order.total - order.delivery_fee + order.discount
}

function formatPhoneDisplay(phone: string | null): string {
  if (!phone) return "—"
  const d = phone.replace(/\D/g, "")
  if (d.length >= 11 && d.startsWith("373")) {
    return `+${d.slice(0, 3)} ${d.slice(3, 5)} ${d.slice(5, 8)} ${d.slice(8)}`
  }
  return phone
}

function scheduledTimeLabel(v: string | null): string {
  if (!v) return "—"
  if (v === "asap") return "Как можно скорее"
  return v
}

export function OrdersTable({ orders }: OrdersTableProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [detailOrder, setDetailOrder] = useState<OrderWithItems | null>(null)

  function toggleExpand(orderId: string) {
    setExpandedId((id) => (id === orderId ? null : orderId))
  }

  function handleStatusChange(orderId: string, next: OrderStatus) {
    startTransition(async () => {
      const { success } = await updateOrderStatus(orderId, next)
      if (success) {
        toast.success("Статус обновлён")
        router.refresh()
      } else {
        toast.error("Не удалось обновить статус")
      }
    })
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-14">#</TableHead>
            <TableHead>Время</TableHead>
            <TableHead>Клиент</TableHead>
            <TableHead className="max-w-[220px]">Доставка</TableHead>
            <TableHead className="min-w-[140px]">Состав</TableHead>
            <TableHead>Сумма</TableHead>
            <TableHead>Статус</TableHead>
            <TableHead className="w-12 text-right">
              <span className="sr-only">Детали</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={8}
                className="text-muted-foreground h-24 text-center"
              >
                Нет заказов по выбранным фильтрам
              </TableCell>
            </TableRow>
          ) : (
            orders.map((order) => {
              const items = sortedItems(order.order_items ?? [])
              const nLines = items.length
              const isOpen = expandedId === order.id

              return (
                <Fragment key={order.id}>
                  <TableRow>
                    <TableCell className="font-mono tabular-nums">
                      {order.order_number}
                    </TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums">
                      {formatCreatedAt(order.created_at)}
                    </TableCell>
                    <TableCell>
                      <div className="leading-snug">
                        <div>{order.user_name?.trim() || "—"}</div>
                        <div className="text-muted-foreground text-sm">
                          {formatPhoneDisplay(order.user_phone)}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[220px] align-top">
                      {order.delivery_mode === "pickup" ? (
                        <Badge variant="outline">Самовывоз</Badge>
                      ) : (
                        <span className="text-sm" title={order.delivery_address ?? ""}>
                          {truncateAddress(order.delivery_address, 40)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="flex items-start gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="text-muted-foreground mt-0.5 shrink-0 hover:text-foreground"
                          aria-expanded={isOpen}
                          aria-label={
                            isOpen ? "Свернуть состав" : "Развернуть состав"
                          }
                          onClick={() => toggleExpand(order.id)}
                        >
                          {isOpen ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </Button>
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-foreground text-left text-sm underline-offset-2 hover:underline"
                          onClick={() => toggleExpand(order.id)}
                        >
                          {nLines} {pluralPositions(nLines)}
                        </button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-0.5">
                        <div className="font-bold tabular-nums">
                          {formatLei(order.total)} лей
                        </div>
                        {order.delivery_fee > 0 ? (
                          <div className="text-muted-foreground text-xs">
                            + {formatLei(order.delivery_fee)} лей доставка
                          </div>
                        ) : null}
                        {order.discount > 0 ? (
                          <div className="text-xs text-green-700 dark:text-green-400">
                            − {formatLei(order.discount)} лей промо
                          </div>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          className={cn(
                            "shrink-0 border-0 font-normal",
                            statusBadgeClass(order.status),
                          )}
                        >
                          {statusLabel(order.status)}
                        </Badge>
                        <Select
                          value={order.status}
                          disabled={pending}
                          onValueChange={(v) =>
                            handleStatusChange(order.id, v as OrderStatus)
                          }
                        >
                          <SelectTrigger size="sm" className="w-[150px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
            <SelectItem value="draft">Черновик</SelectItem>
            <SelectItem value="new">Новый</SelectItem>
            <SelectItem value="confirmed">Подтверждён</SelectItem>
            <SelectItem value="cooking">Готовится</SelectItem>
            <SelectItem value="ready">Готов</SelectItem>
            <SelectItem value="delivery">Доставляется</SelectItem>
            <SelectItem value="done">Выполнен</SelectItem>
            <SelectItem value="cancelled">Отменён</SelectItem>
            <SelectItem value="rejected">Отклонён</SelectItem>
          </SelectContent>
                        </Select>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        aria-label="Детали заказа"
                        onClick={() => setDetailOrder(order)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                  {isOpen ? (
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      <TableCell colSpan={8} className="py-3">
                        <ul className="space-y-2 pl-7">
                          {items.map((line) => (
                            <OrderCompositionLine key={line.id} line={line} />
                          ))}
                        </ul>
                      </TableCell>
                    </TableRow>
                  ) : null}
                </Fragment>
              )
            })
          )}
        </TableBody>
      </Table>

      <Dialog
        open={!!detailOrder}
        onOpenChange={(o) => !o && setDetailOrder(null)}
      >
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Заказ #{detailOrder?.order_number ?? ""}</DialogTitle>
          </DialogHeader>
          {detailOrder ? (
            <OrderDetailsDialog order={detailOrder} />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  )
}

function OrderCompositionLine({ line }: { line: OrderItem }) {
  const size = sizeLabelRu(line.size)
  const tops =
    Array.isArray(line.toppings) && line.toppings.length > 0
      ? line.toppings.map((t) => t.name).join(", ")
      : null

  return (
    <li className="list-none">
      <div className="flex items-baseline justify-between gap-4 text-sm">
        <span className="min-w-0">
          <span className="text-muted-foreground tabular-nums">
            × {line.quantity}
          </span>
          <span className="font-medium">
            {"  "}
            {line.item_name}
            {size ? (
              <span className="text-muted-foreground font-normal">
                {" "}
                ({size})
              </span>
            ) : null}
          </span>
        </span>
        <span className="shrink-0 tabular-nums">
          {formatLei(line.price)} лей
        </span>
      </div>
      {tops ? (
        <p className="text-muted-foreground mt-0.5 pl-8 text-xs">{tops}</p>
      ) : null}
    </li>
  )
}

function OrderDetailsDialog({ order }: { order: OrderWithItems }) {
  const items = sortedItems(order.order_items ?? [])
  const subtotal = orderSubtotalBani(order)
  const hasPromo = Boolean(order.promo_code?.trim()) || order.discount > 0
  const comment = order.comment?.trim()

  const addrRow = (label: string, value: string | null | undefined) => {
    const t = value?.trim()
    if (!t) return null
    return (
      <p>
        <span className="text-muted-foreground">{label}: </span>
        <span className="break-words">{t}</span>
      </p>
    )
  }

  return (
    <div className="space-y-4 text-sm">
      <section className="space-y-2">
        <h3 className="font-heading text-base font-semibold">Клиент</h3>
        <p>
          <span className="text-muted-foreground">Имя: </span>
          {order.user_name?.trim() || "—"}
        </p>
        <p>
          <span className="text-muted-foreground">Телефон: </span>
          {formatPhoneDisplay(order.user_phone)}
        </p>
      </section>

      <Separator />

      <section className="space-y-2">
        <h3 className="font-heading text-base font-semibold">Доставка</h3>
        {order.delivery_mode === "pickup" ? (
          <p>Самовывоз</p>
        ) : (
          <>
            <p className="break-words">
              <span className="text-muted-foreground">Адрес: </span>
              {order.delivery_address?.trim() || "—"}
            </p>
            {addrRow("Подъезд", order.address_entrance)}
            {addrRow("Этаж", order.address_floor)}
            {addrRow("Квартира", order.address_apartment)}
            {addrRow("Домофон", order.address_intercom)}
          </>
        )}
        <p>
          <span className="text-muted-foreground">Время: </span>
          {scheduledTimeLabel(order.scheduled_time)}
        </p>
      </section>

      {order.status === "cancelled" || order.status === "rejected" ? (
        <>
          <Separator />
          <section className="space-y-2">
            <h3 className="font-heading text-base font-semibold">
              {order.status === "rejected"
                ? "Отклонение заказа"
                : "Отмена заказа"}
            </h3>
            <p>
              <span className="text-muted-foreground">Причина: </span>
              {order.cancel_reason?.trim() || "—"}
            </p>
          </section>
        </>
      ) : null}

      <Separator />

      <section className="space-y-2">
        <h3 className="font-heading text-base font-semibold">Оплата</h3>
        <p>{paymentLabel(order.payment_method)}</p>
        {order.payment_method === "cash" && order.change_from != null ? (
          <p>
            <span className="text-muted-foreground">Сдача с: </span>
            {formatLei(order.change_from)} лей
          </p>
        ) : null}
      </section>

      {hasPromo ? (
        <>
          <Separator />
          <section className="space-y-2">
            <h3 className="font-heading text-base font-semibold">Промокод</h3>
            {order.promo_code?.trim() ? (
              <p>
                <span className="text-muted-foreground">Код: </span>
                {order.promo_code}
              </p>
            ) : null}
            {order.discount > 0 ? (
              <p>
                <span className="text-muted-foreground">Скидка: </span>
                <span className="text-green-700 dark:text-green-400">
                  −{formatLei(order.discount)} лей
                </span>
              </p>
            ) : (
              <p className="text-muted-foreground">—</p>
            )}
          </section>
        </>
      ) : null}

      <Separator />

      <section className="space-y-2">
        <h3 className="font-heading text-base font-semibold">Состав</h3>
        <ul className="space-y-3">
          {items.map((line) => {
            const sizeL = sizeLabelRu(line.size)
            return (
            <li key={line.id} className="border-b pb-3 last:border-0 last:pb-0">
              <div className="flex justify-between gap-2">
                <span>
                  <span className="text-muted-foreground">×{line.quantity}</span>{" "}
                  {line.item_name}
                  {sizeL ? (
                    <span className="text-muted-foreground"> ({sizeL})</span>
                  ) : null}
                </span>
                <span className="shrink-0 tabular-nums">
                  {formatLei(line.price)} лей
                </span>
              </div>
              {Array.isArray(line.toppings) && line.toppings.length > 0 ? (
                <p className="text-muted-foreground mt-1 text-xs">
                  {line.toppings.map((t) => t.name).join(", ")}
                </p>
              ) : null}
            </li>
            )
          })}
        </ul>
      </section>

      {comment ? (
        <>
          <Separator />
          <section className="space-y-2">
            <h3 className="font-heading text-base font-semibold">Комментарий</h3>
            <p className="whitespace-pre-wrap break-words">{comment}</p>
          </section>
        </>
      ) : null}

      <Separator />

      <section className="space-y-2">
        <h3 className="font-heading text-base font-semibold">Итого</h3>
        <div className="space-y-1 tabular-nums">
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground">Товары</span>
            <span>{formatLei(subtotal)} лей</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground">Доставка</span>
            <span>
              {order.delivery_fee > 0
                ? `${formatLei(order.delivery_fee)} лей`
                : "—"}
            </span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground">Скидка</span>
            <span className="text-green-700 dark:text-green-400">
              {order.discount > 0
                ? `−${formatLei(order.discount)} лей`
                : "—"}
            </span>
          </div>
          <div className="flex justify-between gap-2 border-t pt-2 font-semibold">
            <span>К оплате</span>
            <span>{formatLei(order.total)} лей</span>
          </div>
        </div>
      </section>
    </div>
  )
}
