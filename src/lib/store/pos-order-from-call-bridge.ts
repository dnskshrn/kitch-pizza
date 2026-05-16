import { create } from "zustand"

export type CreateOrderFromCallParams = {
  brandSlug: string | null
  userPhone: string | null
  profileId: string | null
  userName: string | null
}

type PosOrderFromCallBridge = {
  createFromCall: ((p: CreateOrderFromCallParams) => Promise<void>) | null
  setCreateFromCall: (fn: PosOrderFromCallBridge["createFromCall"]) => void
}

export const usePosOrderFromCallBridge = create<PosOrderFromCallBridge>(
  (set) => ({
    createFromCall: null,
    setCreateFromCall: (fn) => set({ createFromCall: fn }),
  }),
)
