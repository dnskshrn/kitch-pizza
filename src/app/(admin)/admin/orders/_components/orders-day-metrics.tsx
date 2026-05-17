import {
  Card,
  CardContent,
} from "@/components/ui/card"
import type { AdminOrdersTodayMetrics } from "@/lib/admin/orders-today-metrics"

const mdlFormatter = new Intl.NumberFormat("ro-MD", {
  maximumFractionDigits: 0,
})

type OrdersDayMetricsProps = {
  metrics: AdminOrdersTodayMetrics
}

export function OrdersDayMetrics({ metrics }: OrdersDayMetricsProps) {
  const {
    totalOrders,
    revenueBani,
    cancelledCount,
    avgCookMin,
    avgDeliveryMin,
    allOrdersCount,
  } = metrics

  const allDash = cancelledCount === 0 && totalOrders === 0

  const totalOrdersDisplay = allDash ? "—" : String(totalOrders)

  const revenueDisplay = allDash
    ? "—"
    : `${mdlFormatter.format(Math.round(revenueBani / 100))} MDL`

  const cancelDisplay = allDash
    ? "—"
    : `${cancelledCount} (${allOrdersCount > 0 ? Math.round((cancelledCount / allOrdersCount) * 100) : 0}%)`

  const cookDisplay =
    allDash || avgCookMin == null ? "—" : `${Math.round(avgCookMin)} мин`

  const deliveryDisplay =
    allDash || avgDeliveryMin == null
      ? "—"
      : `${Math.round(avgDeliveryMin)} мин`

  const cards: { label: string; value: string }[] = [
    { label: "Заказов", value: totalOrdersDisplay },
    { label: "Выручка", value: revenueDisplay },
    { label: "Отмены", value: cancelDisplay },
    { label: "Готовка avg", value: cookDisplay },
    { label: "Доставка avg", value: deliveryDisplay },
  ]

  return (
    <div className="mb-6 grid grid-cols-5 gap-3">
      {cards.map((c) => (
        <Card key={c.label} size="sm" className="gap-1 py-3">
          <CardContent className="flex flex-col gap-1 px-3 py-0">
            <div className="text-sm text-muted-foreground">{c.label}</div>
            <div className="text-2xl font-bold tabular-nums">{c.value}</div>
            <div className="text-xs text-muted-foreground">Сегодня</div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
