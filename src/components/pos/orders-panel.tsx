"use client"

import { OrderCard } from "@/components/pos/order-card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { fetchPosOrderById, fetchPosOrders } from "@/lib/pos/fetch-orders"
import { createClient } from "@/lib/supabase/client"
import type { PosOrder, PosOrderStatus } from "@/types/pos"
import { Phone } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

function isWithinLast24h(iso: string): boolean {
  const minTs = Date.now() - 24 * 60 * 60 * 1000
  return new Date(iso).getTime() >= minTs
}

const POS_NEW_ORDER_CHIME_URL = "/pos-new-order-chime.wav"

function playNewOrderChime() {
  try {
    const audio = new Audio(POS_NEW_ORDER_CHIME_URL)
    audio.volume = 0.85
    void audio.play().catch(() => {
      // автовоспроизведение может быть заблокировано до жеста пользователя
    })
  } catch {
    // Audio API недоступен
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

function incomingCallBrandLabel(brandSlug: string | null): string {
  switch (brandSlug) {
    case "kitch-pizza":
      return "🍕 Kitch Pizza"
    case "losos":
      return "🐟 Losos"
    case "the-spot":
      return "🎯 The Spot"
    default:
      return "Неизвестный номер"
  }
}

type IncomingCallBannerState = {
  callerPhone: string
  brandLabel: string
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
  const [incomingCallBanner, setIncomingCallBanner] =
    useState<IncomingCallBannerState | null>(null)
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

  const upsertRealtimeOrder = useCallback(
    async (orderId: string, options?: { shouldBeep?: boolean }) => {
      const fresh = await fetchPosOrderById(orderId)
      if (!fresh) return

      let shouldPlayBeep = false
      setOrders((prev) => {
        const idx = prev.findIndex((o) => o.id === fresh.id)
        if (idx === -1) {
          if (!isWithinLast24h(fresh.created_at)) return prev
          shouldPlayBeep = Boolean(options?.shouldBeep)
          return [fresh, ...prev]
        }

        const next = [...prev]
        next[idx] = fresh
        return next
      })

      if (shouldPlayBeep) {
        playNewOrderChime()
      }
    },
    [],
  )

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
    const retryTimers = new Set<ReturnType<typeof setTimeout>>()

    const scheduleRetry = (orderId: string) => {
      const timer = setTimeout(() => {
        retryTimers.delete(timer)
        void upsertRealtimeOrder(orderId)
      }, 800)
      retryTimers.add(timer)
    }

    const channel = supabase
      .channel("pos-orders-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders" },
        (payload) => {
          const id = (payload.new as { id?: string })?.id
          if (!id) return
          void upsertRealtimeOrder(id, { shouldBeep: true })
          scheduleRetry(id)
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders" },
        (payload) => {
          const id = (payload.new as { id?: string })?.id
          if (!id) return
          void upsertRealtimeOrder(id)
        },
      )
      .subscribe((status, error) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.error("[orders-panel] realtime subscription", status, error)
        }
      })

    return () => {
      retryTimers.forEach((timer) => clearTimeout(timer))
      void supabase.removeChannel(channel)
    }
  }, [upsertRealtimeOrder])

  useEffect(() => {
    const supabase = createClient()
    let hideBannerAfterMs: ReturnType<typeof setTimeout> | null = null

    const clearHideBannerTimer = () => {
      if (hideBannerAfterMs) {
        clearTimeout(hideBannerAfterMs)
        hideBannerAfterMs = null
      }
    }

    const handleIncomingCallRow = (row: Record<string, unknown>) => {
      const eventType =
        typeof row.event_type === "string" ? row.event_type : ""
      if (
        eventType === "ACCEPTED" ||
        eventType === "COMPLETED" ||
        eventType === "CANCELLED"
      ) {
        clearHideBannerTimer()
        setIncomingCallBanner(null)
        return
      }
      if (eventType !== "INCOMING") return

      const rawPhone =
        typeof row.caller_phone === "string" ? row.caller_phone.trim() : ""
      const callerPhone = rawPhone || "—"
      const rawSlug = row.brand_slug
      const brandSlug =
        rawSlug === null
          ? null
          : typeof rawSlug === "string" && rawSlug.trim()
            ? rawSlug.trim()
            : null
      const brandLabel = incomingCallBrandLabel(brandSlug)

      clearHideBannerTimer()
      setIncomingCallBanner({ callerPhone, brandLabel })
      hideBannerAfterMs = setTimeout(() => {
        hideBannerAfterMs = null
        setIncomingCallBanner(null)
      }, 60_000)
    }

    const channel = supabase
      .channel("pos-incoming-calls-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "incoming_calls" },
        (payload) => {
          handleIncomingCallRow(payload.new as Record<string, unknown>)
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "incoming_calls" },
        (payload) => {
          handleIncomingCallRow(payload.new as Record<string, unknown>)
        },
      )
      .subscribe((status, error) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.error(
            "[orders-panel] incoming_calls realtime",
            status,
            error,
          )
        }
      })

    return () => {
      clearHideBannerTimer()
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
      {incomingCallBanner ? (
        <div
          className="shrink-0 px-3 py-2.5 shadow-sm"
          style={{ backgroundColor: "#ccff00", color: "#242424" }}
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center gap-3">
            <span className="relative flex size-10 shrink-0 items-center justify-center">
              <span
                className="absolute size-10 animate-ping rounded-full bg-emerald-500/35"
                aria-hidden
              />
              <span
                className="relative flex size-9 items-center justify-center rounded-full bg-white/95 ring-2 ring-emerald-500 ring-offset-2 ring-offset-[#ccff00] animate-pulse"
                aria-hidden
              >
                <Phone className="size-5" strokeWidth={2} />
              </span>
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-bold leading-tight tabular-nums">
                {incomingCallBanner.callerPhone}
              </p>
              <p className="mt-0.5 text-[12px] font-semibold leading-tight text-[#242424]/90">
                {incomingCallBanner.brandLabel}
              </p>
            </div>
          </div>
        </div>
      ) : null}
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
