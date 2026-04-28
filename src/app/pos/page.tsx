"use client"

import { OrderDetail } from "@/components/pos/order-detail"
import { OrderForm } from "@/components/pos/order-form"
import { OrdersPanel } from "@/components/pos/orders-panel"
import { Button } from "@/components/ui/button"
import { useCallback, useState } from "react"

export type RightPanelState =
  | { mode: "idle" }
  | { mode: "detail"; orderId: string }
  | { mode: "create" }

function PosRightIdle({ onNewOrder }: { onNewOrder: () => void }) {
  return (
    <aside className="flex min-w-0 flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="text-muted-foreground text-sm">
        Выберите заказ или нажмите «Новый заказ»
      </p>
      <Button type="button" onClick={onNewOrder}>
        + Новый заказ
      </Button>
    </aside>
  )
}

export default function PosHomePage() {
  const [panel, setPanel] = useState<RightPanelState>({ mode: "idle" })

  const selectedOrderId =
    panel.mode === "detail" ? panel.orderId : null

  const handleSelectOrder = useCallback((id: string) => {
    setPanel({ mode: "detail", orderId: id })
  }, [])

  const handleNewOrder = useCallback(() => {
    setPanel({ mode: "create" })
  }, [])

  const handleOrderCreated = useCallback((orderId: string) => {
    setPanel({ mode: "detail", orderId })
  }, [])

  const handleClosePanel = useCallback(() => {
    setPanel({ mode: "idle" })
  }, [])

  return (
    <div className="grid min-h-0 flex-1 grid-cols-12 grid-rows-1 gap-5 bg-white p-5">
      {/* Левая панель — 3 колонки */}
      <div className="col-span-3 flex min-h-0 flex-col overflow-hidden rounded-xl bg-[#f2f2f2]">
        <OrdersPanel
          selectedOrderId={selectedOrderId}
          onSelectOrder={handleSelectOrder}
          onNewOrder={handleNewOrder}
        />
      </div>

      {/* Основная зона — 9 колонок (делится на 6+3 при создании/деталях) */}
      <div className="col-span-9 flex min-h-0 flex-col overflow-hidden rounded-xl bg-[#f2f2f2]">
        {panel.mode === "idle" ? (
          <PosRightIdle onNewOrder={handleNewOrder} />
        ) : null}
        {panel.mode === "detail" ? (
          <OrderDetail
            orderId={panel.orderId}
            onClose={handleClosePanel}
            onEdit={() => {}}
          />
        ) : null}
        {panel.mode === "create" ? (
          <OrderForm
            onClose={handleClosePanel}
            onOrderCreated={handleOrderCreated}
          />
        ) : null}
      </div>
    </div>
  )
}
