"use client"

import { type ReactNode } from "react"
import { parseISO } from "date-fns"
import type { OrderWithItems } from "@/types/database"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { BrandLogoCell } from "@/components/admin/orders/brand-logo-cell"
import {
  formatCreatedAt,
  formatDurationRu,
  formatLei,
  truncateAddress,
} from "./order-helpers"

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  new: "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400",
  confirmed: "bg-blue-500/20 text-blue-600 dark:text-blue-400",
  cooking: "bg-orange-500/20 text-orange-600 dark:text-orange-400",
  ready: "bg-green-500/20 text-green-600 dark:text-green-400",
  delivery: "bg-purple-500/20 text-purple-600 dark:text-purple-400",
  done: "bg-muted text-muted-foreground",
  cancelled: "bg-destructive/20 text-destructive",
  rejected: "bg-destructive/20 text-destructive",
}

const STATUS_LABELS: Record<string, string> = {
  draft: "Черновик",
  new: "Новый",
  confirmed: "Подтверждён",
  cooking: "Готовится",
  ready: "Готов",
  delivery: "Доставка",
  done: "Выполнен",
  cancelled: "Отменён",
  rejected: "Отклонён",
}

const ACTIVE_STATUSES = new Set([
  "new",
  "confirmed",
  "cooking",
  "ready",
  "delivery",
])

function getPluralForm(n: number, forms: [string, string, string]): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return forms[0]
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20))
    return forms[1]
  return forms[2]
}

type OrdersTableProps = {
  orders: OrderWithItems[]
  /** Открывает боковую шторку с полной загрузкой заказа по id. */
  onOpenOrderDetail: (orderId: string) => void
}

function formatPhoneDisplay(phone: string | null): string {
  if (!phone) return "—"
  const d = phone.replace(/\D/g, "")
  if (d.length >= 11 && d.startsWith("373")) {
    return `+${d.slice(0, 3)} ${d.slice(3, 5)} ${d.slice(5, 8)} ${d.slice(8)}`
  }
  return phone
}

function brandMeta(order: OrderWithItems): { slug: string; name: string } {
  const b = order.brands
  if (b == null) return { slug: "", name: "—" }
  const row = Array.isArray(b) ? b[0] : b
  if (!row) return { slug: "", name: "—" }
  const name =
    typeof row.name === "string" && row.name.trim() ? row.name : "—"
  const slug = typeof row.slug === "string" && row.slug.trim() ? row.slug : ""
  return { slug, name }
}

function SourceBadges({ order }: { order: OrderWithItems }) {
  const isGlovo =
    order.delivery_mode === "aggregator" && order.aggregator === "glovo"
  const isWeb = order.source === "website"
  if (!isGlovo && !isWeb) return null
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {isGlovo ? (
        <Badge className="border-0 bg-orange-100 font-normal text-orange-950 dark:bg-orange-950 dark:text-orange-100">
          GLOVO
        </Badge>
      ) : null}
      {isWeb ? (
        <Badge
          variant="secondary"
          className="font-normal text-muted-foreground"
        >
          WEB
        </Badge>
      ) : null}
    </div>
  )
}

function executionTimeCell(order: OrderWithItems): ReactNode {
  if (order.status === "cancelled" || order.status === "rejected") {
    return "—"
  }
  if (order.status === "done") {
    if (order.paid_at) {
      return formatDurationRu(
        order.created_at,
        parseISO(order.paid_at).getTime(),
      )
    }
    return "—"
  }
  return (
    <span className="text-muted-foreground">
      {formatDurationRu(order.created_at, Date.now())} …
    </span>
  )
}

export function OrdersTable({
  orders,
  onOpenOrderDetail,
}: OrdersTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-14">#</TableHead>
          <TableHead className="min-w-[140px]">Бренд / Источник</TableHead>
          <TableHead>Время</TableHead>
          <TableHead>Клиент</TableHead>
          <TableHead className="max-w-[220px]">Доставка</TableHead>
          <TableHead className="min-w-[140px]">Состав</TableHead>
          <TableHead>Сумма</TableHead>
          <TableHead>Статус</TableHead>
          <TableHead className="min-w-[120px] whitespace-normal">
            Время исполнения
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {orders.length === 0 ? (
          <TableRow>
            <TableCell
              colSpan={9}
              className="text-muted-foreground h-24 text-center"
            >
              Нет заказов по выбранным фильтрам
            </TableCell>
          </TableRow>
        ) : (
          orders.map((order) => {
            const { slug, name } = brandMeta(order)
            const nItems = order.order_items?.length ?? 0
            const isActive = ACTIVE_STATUSES.has(order.status)

            return (
              <TableRow
                key={order.id}
                className={cn(
                  "cursor-pointer transition-colors",
                  isActive
                    ? "bg-[#F2FFBC] hover:bg-[#E6F39E]"
                    : "hover:bg-muted/50",
                )}
                onClick={() => {
                  onOpenOrderDetail(order.id)
                }}
              >
                <TableCell className="font-mono tabular-nums">
                  {order.order_number}
                </TableCell>
                <TableCell className="align-top">
                  <div className="text-sm font-medium leading-snug">
                    <BrandLogoCell slug={slug} name={name} />
                  </div>
                  <SourceBadges order={order} />
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
                    <span
                      className="text-sm"
                      title={order.delivery_address ?? ""}
                    >
                      {truncateAddress(order.delivery_address, 40)}
                    </span>
                  )}
                </TableCell>
                <TableCell className="align-top">
                  <span className="text-muted-foreground text-sm">
                    {nItems}{" "}
                    {getPluralForm(nItems, [
                      "позиция",
                      "позиции",
                      "позиций",
                    ])}
                  </span>
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
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                      STATUS_STYLES[order.status] ??
                        "bg-muted text-muted-foreground",
                    )}
                  >
                    {STATUS_LABELS[order.status] ?? order.status}
                  </span>
                </TableCell>
                <TableCell className="tabular-nums text-sm">
                  {executionTimeCell(order)}
                </TableCell>
              </TableRow>
            )
          })
        )}
      </TableBody>
    </Table>
  )
}
