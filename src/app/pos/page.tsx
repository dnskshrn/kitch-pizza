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
import { createClient } from "@/lib/supabase/client"
import type { PosOrder, PosWizardBrandOption } from "@/types/pos"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

export type RightPanelState =
  | { mode: "idle" }
  | { mode: "detail"; orderId: string }
  | { mode: "wizard"; orderId: string }

function PosRightIdle({
  onNewOrder,
  busy,
  error,
}: {
  onNewOrder: () => void
  busy: boolean
  error: string | null
}) {
  return (
    <aside className="flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center gap-4 overflow-hidden p-6 text-center">
      <p className="text-muted-foreground text-sm">
        Выберите заказ или нажмите «Новый заказ»
      </p>
      <Button type="button" onClick={onNewOrder} disabled={busy}>
        {busy ? "Создание…" : "+ Новый заказ"}
      </Button>
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
    if (isDeliveredDetailStatus(o.status)) {
      setPanel({ mode: "detail", orderId: id })
      return
    }
    if (isWizardOrderStatus(o.status)) {
      setPanel({ mode: "wizard", orderId: id })
      return
    }
    setPanel({ mode: "detail", orderId: id })
  }, [])

  const handleNewOrder = useCallback(async () => {
    setNewOrderError(null)
    setNewOrderBusy(true)
    try {
      const res = await createDraftOrderPos()
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
              onNewOrder={() => void handleNewOrder()}
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
