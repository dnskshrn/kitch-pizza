import { useCallback, useRef, useState } from "react"
import type { Dispatch, SetStateAction } from "react"
import { toast } from "sonner"

import type { PosOrder, PosOrderStatus } from "@/types/pos"

type SetOrders = Dispatch<SetStateAction<PosOrder[]>>

type UpdateStatusAction = (
  id: string,
  status: PosOrderStatus
) => Promise<{ success: boolean; error?: string }>

export function usePosOrderMutations(setOrders: SetOrders) {
  const pendingRef = useRef<Set<string>>(new Set())
  const [pendingOrderIds, setPendingOrderIds] = useState<Set<string>>(
    () => new Set()
  )

  const updateStatus = useCallback(
    async (
      orderId: string,
      newStatus: PosOrderStatus,
      serverAction: UpdateStatusAction
    ) => {
      if (pendingRef.current.has(orderId)) return false

      pendingRef.current.add(orderId)
      setPendingOrderIds((prev) => {
        const next = new Set(prev)
        next.add(orderId)
        return next
      })

      let snapshot: PosOrder[] = []
      setOrders((prev) => {
        snapshot = prev
        return prev.map((order) =>
          order.id === orderId
            ? { ...order, status: newStatus, updated_at: new Date().toISOString() }
            : order
        )
      })

      try {
        const result = await serverAction(orderId, newStatus)
        if (!result.success) throw new Error(result.error ?? "Ошибка")
        return true
      } catch (error) {
        setOrders(snapshot)
        toast.error(
          error instanceof Error ? error.message : "Не удалось обновить статус"
        )
        return false
      } finally {
        pendingRef.current.delete(orderId)
        setPendingOrderIds((prev) => {
          const next = new Set(prev)
          next.delete(orderId)
          return next
        })
      }
    },
    [setOrders]
  )

  const isStatusPending = useCallback(
    (orderId: string) => pendingOrderIds.has(orderId),
    [pendingOrderIds]
  )

  return { updateStatus, pendingOrderIds, isStatusPending }
}
