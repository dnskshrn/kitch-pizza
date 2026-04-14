import { create } from "zustand"

type DeliveryModalState = {
  isOpen: boolean
  open: () => void
  close: () => void
}

export const useDeliveryModalStore = create<DeliveryModalState>((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
}))
