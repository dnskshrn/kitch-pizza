"use client"

import { OrderDetail } from "@/components/pos/order-detail"
import { OrderCard } from "@/components/pos/order-card"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { acceptOrderPos } from "@/lib/actions/pos/accept-order-pos"
import { rejectOrderPos } from "@/lib/actions/pos/reject-order-pos"
import {
  fetchCompletedPosOrders,
  fetchPosOrders,
} from "@/lib/pos/fetch-orders"
import { createClient } from "@/lib/supabase/client"
import type { PosOrder } from "@/types/pos"
import { CheckCheck, ChevronLeft, Phone } from "lucide-react"

/** Если join `brands` в выборке заказа пустой, не теряем уже показанный slug после reload/realtime. */
function mergeOrdersPreserveBrandSlug(
  prev: PosOrder[],
  incoming: PosOrder[],
): PosOrder[] {
  const prevById = new Map(prev.map((o) => [o.id, o]))
  return incoming.map((next) => {
    const old = prevById.get(next.id)
    if (
      old &&
      !next.brand_slug.trim() &&
      Boolean(old.brand_slug.trim()) &&
      old.brand_id === next.brand_id
    ) {
      return { ...next, brand_slug: old.brand_slug }
    }
    return next
  })
}
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useState,
} from "react"

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
  /** Снимок активных заказов для мастера (поля заказа без повторного запроса при шаге «Детали»). */
  onMainOrdersChange?: (orders: PosOrder[]) => void
}

export type OrdersPanelHandle = {
  updateOrderLocalState: (orderId: string, patch: Partial<PosOrder>) => void
  refetchOrders: () => Promise<void>
}

export const OrdersPanel = forwardRef<OrdersPanelHandle, OrdersPanelProps>(
  function OrdersPanel({ selectedOrderId, onSelectOrder, onMainOrdersChange }, ref) {
    const [mainOrders, setMainOrders] = useState<PosOrder[]>([])
    const [completedOrders, setCompletedOrders] = useState<PosOrder[]>([])
    const [completedOpen, setCompletedOpen] = useState(false)
    const [completedDetailId, setCompletedDetailId] = useState<string | null>(
      null,
    )
    const [websiteActionOrderId, setWebsiteActionOrderId] = useState<
      string | null
    >(null)
    const [incomingCallBanner, setIncomingCallBanner] =
      useState<IncomingCallBannerState | null>(null)

    const reloadOrders = useCallback(async () => {
      const [main, completed] = await Promise.all([
        fetchPosOrders(),
        fetchCompletedPosOrders(),
      ])
      setMainOrders((prev) => mergeOrdersPreserveBrandSlug(prev, main))
      setCompletedOrders(completed)
    }, [])

    useImperativeHandle(ref, () => ({
      updateOrderLocalState: (orderId, patch) => {
        setMainOrders((prev) =>
          prev.map((o) => (o.id === orderId ? { ...o, ...patch } : o)),
        )
      },
      refetchOrders: reloadOrders,
    }))

    const mainPanelOrders = mainOrders

    useEffect(() => {
      void reloadOrders()
    }, [reloadOrders])

    useEffect(() => {
      onMainOrdersChange?.(mainOrders)
    }, [mainOrders, onMainOrdersChange])

    const handleStatusChange = useCallback(
      async (orderId: string, newStatus: string) => {
        const next = newStatus
        const updatedAt = new Date().toISOString()
        const supabase = createClient()
        const { error } = await supabase
          .from("orders")
          .update({ status: next, updated_at: updatedAt })
          .eq("id", orderId)

        if (error) {
          console.error("[orders-panel] status update", error.message)
        }
        await reloadOrders()
      },
      [reloadOrders],
    )

    const handleWebsiteAccept = useCallback(
      async (orderId: string) => {
        setWebsiteActionOrderId(orderId)
        try {
          const res = await acceptOrderPos({ orderId })
          if (!res.success) {
            console.error("[orders-panel] accept", res.error)
            return
          }
          await reloadOrders()
        } finally {
          setWebsiteActionOrderId(null)
        }
      },
      [reloadOrders],
    )

    const handleWebsiteReject = useCallback(
      async (orderId: string, reason: string) => {
        setWebsiteActionOrderId(orderId)
        try {
          const res = await rejectOrderPos({ orderId, reason })
          if (!res.success) {
            console.error("[orders-panel] reject", res.error)
            return
          }
          await reloadOrders()
        } finally {
          setWebsiteActionOrderId(null)
        }
      },
      [reloadOrders],
    )

    useEffect(() => {
      const supabase = createClient()

      const ordersChannel = supabase
        .channel("pos-orders")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "orders" },
          (payload) => {
            if (payload.eventType === "INSERT") {
              playNewOrderChime()
            }
            void reloadOrders()
          },
        )
        .subscribe((status, error) => {
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            console.error("[orders-panel] pos-orders realtime", status, error)
          }
        })

      const itemsChannel = supabase
        .channel("pos-order-items")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "order_items" },
          () => {
            void reloadOrders()
          },
        )
        .subscribe((status, error) => {
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            console.error(
              "[orders-panel] pos-order-items realtime",
              status,
              error,
            )
          }
        })

      return () => {
        void supabase.removeChannel(ordersChannel)
        void supabase.removeChannel(itemsChannel)
      }
    }, [reloadOrders])

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

    const handleCompletedOpenChange = (open: boolean) => {
      setCompletedOpen(open)
      if (!open) {
        setCompletedDetailId(null)
      }
    }

    return (
      <div className="flex h-full min-h-0 w-full flex-col overflow-hidden">
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

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden pt-3">
          <div className="relative mb-3 flex min-h-[40px] shrink-0 items-center justify-center px-2">
            <p className="text-center font-mono text-[11px] font-semibold uppercase tracking-[0.35em] text-[#808080]">
              Заказы
            </p>
            <button
              type="button"
              aria-label="Выданные заказы"
              onClick={() => setCompletedOpen(true)}
              className="absolute top-1/2 right-1 flex size-10 -translate-y-1/2 items-center justify-center rounded-full text-[#808080] transition-colors hover:text-[#242424] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#242424]"
            >
              <CheckCheck className="size-5" strokeWidth={2} />
            </button>
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-2 pb-3">
            {!mainPanelOrders.length ? (
              <div className="flex flex-1 items-center justify-center px-4 py-8 text-center">
                <span className="text-[13px] text-[#808080]">Нет заказов</span>
              </div>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto bg-[#f2f2f2] pt-1">
                {mainPanelOrders.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    isSelected={selectedOrderId === order.id}
                    onSelect={() => onSelectOrder(order.id)}
                    onStatusChange={handleStatusChange}
                    onWebsiteAccept={handleWebsiteAccept}
                    onWebsiteReject={handleWebsiteReject}
                    websiteActionBusy={websiteActionOrderId === order.id}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        <Sheet open={completedOpen} onOpenChange={handleCompletedOpenChange}>
          <SheetContent
            side="left"
            showCloseButton={!completedDetailId}
            className="flex h-full max-h-[100dvh] w-full flex-col gap-0 border-[#e8e8e8] bg-[#f2f2f2] p-0 sm:max-w-md"
          >
            {completedDetailId ? (
              <div className="flex min-h-0 flex-1 flex-col">
                <div className="flex shrink-0 items-center gap-2 border-b border-[#e8e8e8] bg-white px-3 py-2">
                  <button
                    type="button"
                    aria-label="Назад к списку"
                    className="flex size-9 shrink-0 items-center justify-center rounded-full text-[#242424] transition-colors hover:bg-[#f2f2f2]"
                    onClick={() => setCompletedDetailId(null)}
                  >
                    <ChevronLeft className="size-5" />
                  </button>
                  <span className="min-w-0 flex-1 text-[14px] font-semibold text-[#242424]">
                    Выданные
                  </span>
                </div>
                <div className="min-h-0 flex-1 overflow-hidden bg-white">
                  <OrderDetail
                    orderId={completedDetailId}
                    interactionMode="readonly"
                    onClose={() => setCompletedDetailId(null)}
                    onAddItemsToOrder={() => {}}
                    onEditOrderDetails={() => {}}
                  />
                </div>
              </div>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <SheetHeader className="shrink-0 border-b border-[#e8e8e8] bg-[#ffffff] px-4 pb-4 pt-6">
                  <SheetTitle className="text-[16px] font-bold text-[#242424]">
                    Выданные заказы
                  </SheetTitle>
                </SheetHeader>
                <div className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
                  {!completedOrders.length ? (
                    <p className="px-2 py-8 text-center text-[13px] text-[#808080]">
                      Нет заказов
                    </p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {completedOrders.map((order) => (
                        <OrderCard
                          key={order.id}
                          order={order}
                          isSelected={false}
                          onSelect={() => setCompletedDetailId(order.id)}
                          onStatusChange={() => {}}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </SheetContent>
        </Sheet>
      </div>
    )
  }
)
