"use client"

import type { OrderWithItems } from "@/types/database"
import { Badge } from "@/components/ui/badge"
import { FiltersBar } from "./filters-bar"
import { OrdersTable } from "./orders-table"
import { Pagination } from "./pagination"

type OrdersClientProps = {
  orders: OrderWithItems[]
  total: number
  page: number
  pageSize: number
}

export function OrdersClient({
  orders,
  total,
  page,
  pageSize,
}: OrdersClientProps) {
  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold">Заказы</h1>
          <Badge variant="secondary">{total}</Badge>
        </div>
      </div>

      <FiltersBar />
      <OrdersTable orders={orders} />
      <Pagination total={total} page={page} pageSize={pageSize} />
    </div>
  )
}
