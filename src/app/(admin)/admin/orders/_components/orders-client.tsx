"use client"

import type { AdminOrdersTodayMetrics } from "@/lib/admin/orders-today-metrics"
import type { OrderWithItems } from "@/types/database"
import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { OrderDetailSheet } from "../order-detail-sheet"
import { OrdersDayMetrics } from "./orders-day-metrics"
import { FiltersBar } from "./filters-bar"
import { OrdersTable } from "./orders-table"
import { Pagination } from "./pagination"

type OrdersClientProps = {
  orders: OrderWithItems[]
  total: number
  page: number
  pageSize: number
  brands: { id: string; name: string }[]
  todayMetrics: AdminOrdersTodayMetrics
}

export function OrdersClient({
  orders,
  total,
  page,
  pageSize,
  brands,
  todayMetrics,
}: OrdersClientProps) {
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)

  return (
    <div>
      <OrderDetailSheet
        orderId={selectedOrderId}
        onClose={() => setSelectedOrderId(null)}
      />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold">Заказы</h1>
          <Badge variant="secondary">{total}</Badge>
        </div>
      </div>

      <OrdersDayMetrics metrics={todayMetrics} />
      <FiltersBar brands={brands} />
      <OrdersTable
        orders={orders}
        onOpenOrderDetail={(id) => setSelectedOrderId(id)}
      />
      <Pagination total={total} page={page} pageSize={pageSize} />
    </div>
  )
}
