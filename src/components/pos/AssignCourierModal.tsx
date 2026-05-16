"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  assignCourierPos,
  changeCourierPos,
} from "@/lib/actions/pos/assign-courier-pos"
import { createClient } from "@/lib/supabase/client"
import { Loader2 } from "lucide-react"
import { useEffect, useState } from "react"

type OnlineCourier = { id: string; name: string; phone: string | null }

export type AssignCourierModalMode = "assign" | "reassign"

type Props = {
  orderId: string
  orderNumber: number
  isOpen: boolean
  onClose: () => void
  onAssigned: (courierId: string, courierName: string) => void
  /** Первичное назначение (`ready` → `delivery`) или смена у заказа в доставке */
  mode?: AssignCourierModalMode
  /** Текущий курьер при `reassign` — тот же в списке игнорируем без запроса */
  currentCourierId?: string | null
}

export function AssignCourierModal({
  orderId,
  orderNumber,
  isOpen,
  onClose,
  onAssigned,
  mode = "assign",
  currentCourierId = null,
}: Props) {
  const [loading, setLoading] = useState(false)
  const [couriers, setCouriers] = useState<OnlineCourier[]>([])
  const [assigningId, setAssigningId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) {
      setCouriers([])
      setError(null)
      setAssigningId(null)
      return
    }
    setLoading(true)
    const supabase = createClient()
    void (async () => {
      try {
        const { data: locations } = await supabase
          .from("courier_locations")
          .select("staff_id")
          .eq("is_on_shift", true)

        if (!locations || locations.length === 0) {
          setCouriers([])
          return
        }

        const staffIds = locations.map(
          (l: { staff_id: string }) => l.staff_id,
        )

        const { data: staff } = await supabase
          .from("staff")
          .select("id, name, phone")
          .in("id", staffIds)
          .eq("role", "courier")
          .eq("is_active", true)

        setCouriers((staff ?? []) as OnlineCourier[])
      } finally {
        setLoading(false)
      }
    })()
  }, [isOpen])

  const handleAssign = async (courierId: string) => {
    if (mode === "reassign" && courierId === currentCourierId) {
      onClose()
      return
    }

    const picked = couriers.find((c) => c.id === courierId)

    setAssigningId(courierId)
    setError(null)
    const result =
      mode === "reassign"
        ? await changeCourierPos({ orderId, courierId })
        : await assignCourierPos({ orderId, courierId })
    if (!result.success) {
      setError(result.error)
      setAssigningId(null)
      return
    }
    onAssigned(courierId, picked?.name ?? "—")
    onClose()
  }

  const title =
    mode === "reassign"
      ? `Сменить курьера · #${orderNumber}`
      : `Курьер — Заказ #${orderNumber}`

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-sm font-bold">{title}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-2 py-1">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-6 text-sm text-[#808080]">
              <Loader2 className="size-4 animate-spin" />
              Загрузка…
            </div>
          ) : couriers.length === 0 ? (
            <p className="py-6 text-center text-sm text-[#808080]">
              Нет доступных курьеров на смене
            </p>
          ) : (
            couriers.map((courier) => (
              <button
                key={courier.id}
                type="button"
                disabled={assigningId !== null}
                onClick={() => void handleAssign(courier.id)}
                className="flex w-full items-center justify-between rounded-lg bg-[#f2f2f2] px-4 py-3 text-left text-sm transition-colors hover:bg-[#e8e8e8] disabled:opacity-50"
              >
                <span className="font-bold text-[#242424]">{courier.name}</span>
                <span className="flex items-center gap-2 text-[#808080]">
                  {courier.phone ?? "—"}
                  {assigningId === courier.id && (
                    <Loader2 className="size-3.5 animate-spin" />
                  )}
                </span>
              </button>
            ))
          )}

          {error && (
            <p className="text-center text-xs text-red-600">{error}</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
