"use client"

import { OrderDetail } from "@/components/pos/order-detail"
import { OrderForm } from "@/components/pos/order-form"
import { OrdersPanel, type OrdersPanelHandle } from "@/components/pos/orders-panel"
import { Button } from "@/components/ui/button"
import { brands as staticBrandConfigs, normalizePosBrandSlug } from "@/brands/index"
import { createDraftOrderPos } from "@/lib/actions/pos/create-draft-order"
import { fetchPosOrderById } from "@/lib/pos/fetch-orders"
import {
  isDeliveredDetailStatus,
  isWizardOrderStatus,
} from "@/lib/pos/order-wizard-status"
import {
  usePosOrderFromCallBridge,
  type CreateOrderFromCallParams,
} from "@/lib/store/pos-order-from-call-bridge"
import { usePosMenuCache } from "@/lib/store/pos-menu-cache"
import { createClient } from "@/lib/supabase/client"
import type { PosOrder, PosOrderStatus, PosWizardBrandOption } from "@/types/pos"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"

export type RightPanelState =
  | { mode: "idle" }
  | { mode: "detail"; orderId: string }
  | { mode: "wizard"; orderId: string }

function PosRightIdle({
  onNewOrder,
  busy,
  error,
}: {
  onNewOrder: (deliveryMode: "delivery" | "pickup") => void
  busy: boolean
  error: string | null
}) {
  return (
    <aside className="flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center gap-4 overflow-hidden p-6 text-center">
      <p className="text-muted-foreground text-sm">
        Выберите заказ или создайте новый
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button
          type="button"
          onClick={() => onNewOrder("delivery")}
          disabled={busy}
        >
          {busy ? "Создание…" : "Новый заказ Доставка"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => onNewOrder("pickup")}
          disabled={busy}
        >
          {busy ? "Создание…" : "Новый заказ Навынос"}
        </Button>
      </div>
      {error ? (
        <p className="text-destructive max-w-sm text-sm">{error}</p>
      ) : null}
    </aside>
  )
}

type BrandTableRow = { id: string; slug: string; name: string }

export default function PosHomePage() {
  const ordersPanelRef = useRef<OrdersPanelHandle>(null)
  const [panel, setPanel] = useState<RightPanelState>({ mode: "idle" })
  const [brandRows, setBrandRows] = useState<BrandTableRow[]>([])
  const [mainOrdersSnapshot, setMainOrdersSnapshot] = useState<PosOrder[]>([])
  const [newOrderBusy, setNewOrderBusy] = useState(false)
  const [newOrderError, setNewOrderError] = useState<string | null>(null)
  const loadBrandsMenu = usePosMenuCache((s) => s.loadBrandsMenu)

  useEffect(() => {
    const supabase = createClient()
    void supabase
      .from("brands")
      .select("id, name, slug")
      .then(({ data, error }) => {
        if (error) {
          console.error("[pos] brands", error.message)
          return
        }
        if (data) setBrandRows(data as BrandTableRow[])
      })
  }, [])

  const wizardBrands = useMemo<PosWizardBrandOption[]>(() => {
    return staticBrandConfigs.map((cfg) => {
      const row = brandRows.find(
        (r) => normalizePosBrandSlug(r.slug) === cfg.slug,
      )
      return { ...cfg, dbId: row?.id ?? null }
    })
  }, [brandRows])

  useEffect(() => {
    const brandIds = wizardBrands
      .map((brand) => brand.dbId)
      .filter((id): id is string => Boolean(id))
    if (!brandIds.length) return
    void loadBrandsMenu(brandIds)
  }, [loadBrandsMenu, wizardBrands])

  const wizardListOrder = useMemo(() => {
    if (panel.mode !== "wizard") return null
    return mainOrdersSnapshot.find((o) => o.id === panel.orderId) ?? null
  }, [panel, mainOrdersSnapshot])

  const selectedOrderId =
    panel.mode === "detail" || panel.mode === "wizard"
      ? panel.orderId
      : null

  const handleSelectOrder = useCallback(async (id: string) => {
    const o = await fetchPosOrderById(id)
    if (!o) {
      console.error("[pos] fetchPosOrderById: пусто", id)
      return
    }
    setMainOrdersSnapshot((prev) => {
      const ix = prev.findIndex((x) => x.id === id)
      if (ix < 0) return prev
      const next = [...prev]
      next[ix] = o
      return next
    })
    void ordersPanelRef.current?.refetchOrders()
    if (isDeliveredDetailStatus(o.status)) {
      setPanel({ mode: "detail", orderId: id })
    } else if (isWizardOrderStatus(o.status)) {
      setPanel({ mode: "wizard", orderId: id })
    } else {
      setPanel({ mode: "detail", orderId: id })
    }
  }, [])

  const openNewOrderFromCall = useCallback(
    async (params: CreateOrderFromCallParams) => {
      setNewOrderError(null)
      setNewOrderBusy(true)
      try {
        const res = await createDraftOrderPos({
          brandSlug: params.brandSlug,
          userPhone: params.userPhone,
          profileId: params.profileId,
          userName: params.userName,
        })
        if (!res.success) {
          const msg = res.error ?? "Не удалось создать черновик"
          setNewOrderError(msg)
          toast.error(msg)
          return
        }
        setPanel({ mode: "wizard", orderId: res.orderId })
        await ordersPanelRef.current?.refetchOrders()
      } finally {
        setNewOrderBusy(false)
      }
    },
    [],
  )

  useEffect(() => {
    usePosOrderFromCallBridge.getState().setCreateFromCall(openNewOrderFromCall)
    return () => {
      usePosOrderFromCallBridge.getState().setCreateFromCall(null)
    }
  }, [openNewOrderFromCall])

  const handleNewOrder = useCallback(async (deliveryMode: "delivery" | "pickup") => {
    setNewOrderError(null)
    setNewOrderBusy(true)
    try {
      const res = await createDraftOrderPos({ deliveryMode })
      if (!res.success) {
        setNewOrderError(res.error ?? "Не удалось создать черновик")
        return
      }
      setPanel({ mode: "wizard", orderId: res.orderId })
    } finally {
      setNewOrderBusy(false)
    }
  }, [])

  const handleClosePanel = useCallback(() => {
    setPanel({ mode: "idle" })
  }, [])

  const handleDetailStatusChange = useCallback(
    async (orderId: string, nextStatus: PosOrderStatus) => {
      const success =
        (await ordersPanelRef.current?.updateOrderStatus(orderId, nextStatus)) ??
        false

      if (success) {
        setMainOrdersSnapshot((prev) =>
          prev.map((order) =>
            order.id === orderId
              ? {
                  ...order,
                  status: nextStatus,
                  updated_at: new Date().toISOString(),
                }
              : order,
          ),
        )
      }

      return success
    },
    [],
  )

  const noopDetailAction = useCallback(() => {}, [])

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-white p-5">
      <div className="grid min-h-0 flex-1 grid-cols-12 grid-rows-[minmax(0,1fr)] gap-5 overflow-hidden">
        <div className="col-span-3 flex h-full min-h-0 flex-col overflow-hidden rounded-xl bg-[#f2f2f2]">
          <OrdersPanel
            ref={ordersPanelRef}
            selectedOrderId={selectedOrderId}
            onSelectOrder={handleSelectOrder}
            onMainOrdersChange={setMainOrdersSnapshot}
          />
        </div>

        <div className="col-span-9 flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-xl bg-[#f2f2f2]">
          {panel.mode === "idle" ? (
            <PosRightIdle
              onNewOrder={(deliveryMode) => void handleNewOrder(deliveryMode)}
              busy={newOrderBusy}
              error={newOrderError}
            />
          ) : null}
          {panel.mode === "detail" ? (
            <div className="flex h-full min-h-0 flex-col overflow-hidden">
              <OrderDetail
                orderId={panel.orderId}
                onClose={handleClosePanel}
                interactionMode="readonly"
                onAddItemsToOrder={noopDetailAction}
                onEditOrderDetails={noopDetailAction}
                onStatusChange={handleDetailStatusChange}
              />
            </div>
          ) : null}
          {panel.mode === "wizard" ? (
            <div className="flex h-full min-h-0 flex-col overflow-hidden">
              <OrderForm
                key={panel.orderId}
                orderId={panel.orderId}
                wizardBrands={wizardBrands}
                listOrder={wizardListOrder}
                onClose={handleClosePanel}
                ordersPanelRef={ordersPanelRef}
              />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
