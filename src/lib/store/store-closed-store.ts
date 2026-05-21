import { create } from "zustand"

type StoreClosedState = {
  dismissed: boolean
  setDismissed: (dismissed: boolean) => void
  requestShow: () => void
}

export const useStoreClosedStore = create<StoreClosedState>((set) => ({
  dismissed: false,
  setDismissed: (dismissed) => set({ dismissed }),
  requestShow: () => set({ dismissed: false }),
}))

/** Показать оверлей «магазин закрыт» (например, при клике на корзину или товар). */
export function showStoreClosedModal() {
  useStoreClosedStore.getState().requestShow()
}
