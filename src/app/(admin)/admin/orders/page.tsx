import {
  ORDERS_PAGE_SIZE,
  parseOrdersSearchParams,
} from "@/lib/admin/orders-url"
import { getAdminOrdersTodayMetrics } from "@/lib/admin/orders-today-metrics"
import { getBrands } from "@/lib/actions/get-brands"
import { getOrders } from "@/lib/actions/get-orders"
import { OrdersClient } from "./_components/orders-client"

export const dynamic = "force-dynamic"

/** Детальный просмотр заказа — боковая шторка `OrderDetailSheet` внутри клиентского `OrdersClient` (state нельзя держать в этой Server Component странице). */
type PageProps = {
  searchParams: Record<string, string | string[] | undefined>
}

export default async function AdminOrdersPage({ searchParams }: PageProps) {
  const state = parseOrdersSearchParams(searchParams)

  let brands: { id: string; name: string }[] = []
  try {
    const raw = await getBrands()
    brands = [...raw]
      .map(({ id, name }) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "ru"))
  } catch {
    brands = []
  }

  try {
    const [{ orders, total }, todayMetrics] = await Promise.all([
      getOrders(state),
      getAdminOrdersTodayMetrics(state.brandId),
    ])
    return (
      <OrdersClient
        orders={orders}
        total={total}
        page={state.page}
        pageSize={ORDERS_PAGE_SIZE}
        brands={brands}
        todayMetrics={todayMetrics}
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
