"use client"

import { OrderCard } from "@/components/pos/order-card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  fetchPosOrderById,
  fetchPosOrders,
  mapOrder,
  type OrderRow,
} from "@/lib/pos/fetch-orders"
import { createClient } from "@/lib/supabase/client"
import type { PosOrder, PosOrderStatus } from "@/types/pos"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

function isWithinLast24h(iso: string): boolean {
  const minTs = Date.now() - 24 * 60 * 60 * 1000
  return new Date(iso).getTime() >= minTs
}

function playBeep() {
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = 880
    gain.gain.setValueAtTime(0.3, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.4)
  } catch {
    // Web Audio может быть недоступен до жеста пользователя
  }
}

type OrderFilterTab = "all" | "new" | "active" | "done"

function ordersForTab(orders: PosOrder[], tab: OrderFilterTab): PosOrder[] {
  switch (tab) {
    case "all":
      return orders
    case "new":
      return orders.filter((o) => o.status === "new")
    case "active":
      return orders.filter(
        (o) => o.status === "in_progress" || o.status === "delivering"
      )
    case "done":
      return orders.filter(
        (o) => o.status === "done" || o.status === "cancelled"
      )
    default:
      return orders
  }
}

function isOrderFilterTab(v: string): v is OrderFilterTab {
  return v === "all" || v === "new" || v === "active" || v === "done"
}

type OrdersPanelProps = {
  selectedOrderId: string | null
  onSelectOrder: (id: string) => void
  onNewOrder: () => void
}

export function OrdersPanel({
  selectedOrderId,
  onSelectOrder,
  onNewOrder,
}: OrdersPanelProps) {
  const [orders, setOrders] = useState<PosOrder[]>([])
  const [tab, setTab] = useState<OrderFilterTab>("all")
  const onNewOrderRef = useRef(onNewOrder)
  onNewOrderRef.current = onNewOrder

  const listsByTab = useMemo(
    () => ({
      all: ordersForTab(orders, "all"),
      new: ordersForTab(orders, "new"),
      active: ordersForTab(orders, "active"),
      done: ordersForTab(orders, "done"),
    }),
    [orders]
  )

  const reloadOrders = useCallback(async () => {
    const data = await fetchPosOrders()
    setOrders(data)
  }, [])

  useEffect(() => {
    void reloadOrders()
  }, [reloadOrders])

  const handleStatusChange = useCallback(
    async (orderId: string, newStatus: string) => {
      const next = newStatus as PosOrderStatus
      const updatedAt = new Date().toISOString()
      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId ? { ...o, status: next, updated_at: updatedAt } : o
        )
      )

      const supabase = createClient()
      const { error } = await supabase
        .from("orders")
        .update({ status: next, updated_at: updatedAt })
        .eq("id", orderId)

      if (error) {
        console.error("[orders-panel] status update", error.message)
        const fresh = await fetchPosOrderById(orderId)
        if (fresh) {
          setOrders((prev) => prev.map((o) => (o.id === orderId ? fresh : o)))
        } else {
          void reloadOrders()
        }
      }
    },
    [reloadOrders]
  )

  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel("pos-orders-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders" },
        (payload) => {
          const id = (payload.new as { id?: string })?.id
          if (!id) return
          void (async () => {
            const supabase = createClient()
            const { data: newOrder, error } = await supabase
              .from("orders")
              .select("*, brands(slug), order_items(count)")
              .eq("id", id)
              .maybeSingle()

            if (error) {
              console.error("[orders-panel] realtime insert fetch", error.message)
              return
            }
            if (!newOrder) return
            const row = newOrder as OrderRow
            if (!isWithinLast24h(row.created_at)) return

            const mapped = mapOrder(row)
            setOrders((prev) => {
              if (prev.some((o) => o.id === mapped.id)) return prev
              return [mapped, ...prev]
            })
            playBeep()
          })()
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders" },
        (payload) => {
          const id = (payload.new as { id?: string })?.id
          if (!id) return
          void (async () => {
            const supabase = createClient()
            const { data: updated, error } = await supabase
              .from("orders")
              .select("*, brands(slug), order_items(count)")
              .eq("id", id)
              .maybeSingle()

            if (error) {
              console.error("[orders-panel] realtime update fetch", error.message)
              return
            }
            if (!updated) return
            const row = mapOrder(updated as OrderRow)
            setOrders((prev) => {
              const idx = prev.findIndex((o) => o.id === row.id)
              if (idx === -1) {
                if (isWithinLast24h(row.created_at)) {
                  return [row, ...prev]
                }
                return prev
              }
              const next = [...prev]
              next[idx] = row
              return next
            })
          })()
        }
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [])

  const onTabChange = (v: string) => {
    if (isOrderFilterTab(v)) setTab(v)
  }

  function renderList(forTab: OrderFilterTab) {
    const list = listsByTab[forTab]
    if (!list.length) {
      return (
        <div className="flex flex-1 items-center justify-center px-4 py-8 text-center">
          <span className="text-[13px] text-[#808080]">Нет заказов</span>
        </div>
      )
    }
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto bg-[#f2f2f2] px-2 pt-1 pb-3">
        {list.map((order) => (
          <OrderCard
            key={order.id}
            order={order}
            isSelected={selectedOrderId === order.id}
            onSelect={() => onSelectOrder(order.id)}
            onStatusChange={handleStatusChange}
          />
        ))}
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <Tabs
        value={tab}
        onValueChange={onTabChange}
        className="flex min-h-0 flex-1 flex-col"
      >
        {/* Панель серая; полоска табов — белая «таблетка» */}
        <div className="shrink-0 rounded-t-xl bg-[#f2f2f2] px-2 pt-4 pb-0">
          <p className="mb-3 w-full text-center font-mono text-[11px] font-semibold uppercase tracking-[0.35em] text-[#808080]">
            Заказы
          </p>
          <div className="rounded-full bg-white p-1.5">
            <TabsList
              variant="pos"
              className="flex h-auto w-full min-w-0 justify-between gap-1 border-0 bg-transparent p-0 shadow-none ring-0"
            >
              <TabsTrigger
                value="all"
                className="h-auto min-w-0 flex-1 rounded-full px-2 py-1.5 text-xs"
              >
                Все
              </TabsTrigger>
              <TabsTrigger
                value="new"
                className="h-auto min-w-0 flex-1 rounded-full px-2 py-1.5 text-xs"
              >
                Новые
              </TabsTrigger>
              <TabsTrigger
                value="active"
                className="h-auto min-w-0 flex-1 rounded-full px-2 py-1.5 text-xs"
              >
                В работе
              </TabsTrigger>
              <TabsTrigger
                value="done"
                className="h-auto min-w-0 flex-1 rounded-full px-2 py-1.5 text-xs"
              >
                Готово
              </TabsTrigger>
            </TabsList>
          </div>
        </div>

        <TabsContent
          value="all"
          className="mt-0 flex min-h-0 flex-1 flex-col outline-none data-[state=inactive]:hidden"
        >
          {renderList("all")}
        </TabsContent>
        <TabsContent
          value="new"
          className="mt-0 flex min-h-0 flex-1 flex-col outline-none data-[state=inactive]:hidden"
        >
          {renderList("new")}
        </TabsContent>
        <TabsContent
          value="active"
          className="mt-0 flex min-h-0 flex-1 flex-col outline-none data-[state=inactive]:hidden"
        >
          {renderList("active")}
        </TabsContent>
        <TabsContent
          value="done"
          className="mt-0 flex min-h-0 flex-1 flex-col outline-none data-[state=inactive]:hidden"
        >
          {renderList("done")}
        </TabsContent>
      </Tabs>
    </div>
  )
}
