"use client"

import { Button } from "@/components/ui/button"
import type { OrderType } from "@/types/pos"
import { Bike } from "lucide-react"

export function OrderTypeSelectModal({
  onSelect,
  busy,
  error,
}: {
  onSelect: (orderType: OrderType) => void
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
          onClick={() => onSelect("delivery")}
          disabled={busy}
        >
          {busy ? "Создание…" : "Новый заказ Доставка"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => onSelect("pickup")}
          disabled={busy}
        >
          {busy ? "Создание…" : "Новый заказ Навынос"}
        </Button>
        <Button
          type="button"
          className="bg-orange-500 text-white hover:bg-orange-600"
          onClick={() => onSelect("aggregator")}
          disabled={busy}
        >
          {busy ? (
            "Создание…"
          ) : (
            <span className="inline-flex items-center gap-2">
              <Bike className="size-4 shrink-0" aria-hidden />
              Новый заказ Glovo
            </span>
          )}
        </Button>
      </div>
      {error ? (
        <p className="text-destructive max-w-sm text-sm">{error}</p>
      ) : null}
    </aside>
  )
}
