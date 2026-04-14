import {
  ORDERS_PAGE_SIZE,
  parseOrdersSearchParams,
} from "@/lib/admin/orders-url"
import { getOrders } from "@/lib/actions/get-orders"
import { OrdersClient } from "./_components/orders-client"

type PageProps = {
  searchParams: Record<string, string | string[] | undefined>
}

export default async function AdminOrdersPage({ searchParams }: PageProps) {
  const state = parseOrdersSearchParams(searchParams)

  try {
    const { orders, total } = await getOrders(state)
    return (
      <OrdersClient
        orders={orders}
        total={total}
        page={state.page}
        pageSize={ORDERS_PAGE_SIZE}
      />
    )
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Не удалось загрузить заказы."
    return (
      <p className="text-destructive">
        {message.startsWith("Missing ")
          ? "Не удалось подключиться к базе: проверьте переменные окружения."
          : `Не удалось загрузить заказы: ${message}`}
      </p>
    )
  }
}
