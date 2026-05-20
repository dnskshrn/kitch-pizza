import {
  attachResolvedZoneParams,
  type DeliveryZoneWithResolvedParams,
  type ZoneWithSchedules,
} from "@/lib/delivery-zone-schedule"
import { findZoneForPoint } from "@/lib/geo"
import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

export const DELIVERY_STORAGE_KEY = "kitch-delivery"

export type DeliveryMode = "delivery" | "pickup"

type DeliveryState = {
  mode: DeliveryMode
  /** Черновик ввода в поле адреса */
  address: string
  resolvedAddress: string | null
  lat: number | null
  lng: number | null
  selectedZone: DeliveryZoneWithResolvedParams | null
  /** true, если геокод успешен, но точка вне зон */
  outOfZone: boolean
  geocoding: boolean
  entrance: string
  floor: string
  apartment: string
  intercom: string
  comment: string

  setMode: (mode: DeliveryMode) => void
  setAddress: (address: string) => void
  setGeocoding: (v: boolean) => void
  /**
   * Выставить координаты и зону после геокода / клика по карте / «Найти меня».
   */
  setResolved: (
    lat: number,
    lng: number,
    displayName: string | null,
    zone: ZoneWithSchedules | null,
  ) => void
  clearAddress: () => void
  /** Пересчитать зону по текущим lat/lng и списку зон (после загрузки зон / смена полигонов). */
  recheckZoneWithZones: (zones: ZoneWithSchedules[]) => void
  setSecondary: (patch: Partial<Pick<DeliveryState, "entrance" | "floor" | "apartment" | "intercom" | "comment">>) => void

  getDeliveryFeeBani: (orderSubtotalBani: number) => number
  isDeliveryFree: (orderSubtotalBani: number) => boolean
}

export const useDeliveryStore = create<DeliveryState>()(
  persist(
    (set, get) => ({
      mode: "delivery",
      address: "",
      resolvedAddress: null,
      lat: null,
      lng: null,
      selectedZone: null,
      outOfZone: false,
      geocoding: false,
      entrance: "",
      floor: "",
      apartment: "",
      intercom: "",
      comment: "",

      setMode: (mode) =>
        set({
          mode,
          ...(mode === "pickup"
            ? {
                outOfZone: false,
              }
            : {}),
        }),

      setAddress: (address) => set({ address }),

      setGeocoding: (geocoding) => set({ geocoding }),

      setResolved: (lat, lng, displayName, zone) =>
        set((s) => ({
          lat,
          lng,
          resolvedAddress: displayName,
          address:
            displayName != null && String(displayName).trim() !== ""
              ? displayName
              : s.address,
          selectedZone: zone ? attachResolvedZoneParams(zone) : null,
          outOfZone:
            zone === null &&
            Number.isFinite(lat) &&
            Number.isFinite(lng),
          geocoding: false,
        })),

      clearAddress: () =>
        set({
          address: "",
          resolvedAddress: null,
          lat: null,
          lng: null,
          selectedZone: null,
          outOfZone: false,
          entrance: "",
          floor: "",
          apartment: "",
          intercom: "",
          comment: "",
        }),

      recheckZoneWithZones: (zones) => {
        const { lat, lng, mode } = get()
        if (mode === "pickup") return
        if (lat == null || lng == null) {
          set({ selectedZone: null, outOfZone: false })
          return
        }
        const hit = findZoneForPoint(lat, lng, zones)
        const zone = hit ? attachResolvedZoneParams(hit) : null
        set({
          selectedZone: zone,
          outOfZone: zone === null,
        })
      },

      setSecondary: (patch) => set(patch),

      getDeliveryFeeBani: (orderSubtotalBani) => {
        const s = get()
        if (s.mode === "pickup") return 0
        const z = s.selectedZone
        if (!z) return 0
        const params = z.resolvedParams
        if (
          params.free_delivery_from_bani != null &&
          orderSubtotalBani >= params.free_delivery_from_bani
        ) {
          return 0
        }
        return params.delivery_price_bani
      },

      isDeliveryFree: (orderSubtotalBani) => {
        const z = get().selectedZone
        if (!z) return false
        const params = z.resolvedParams
        if (params.free_delivery_from_bani == null) return false
        return orderSubtotalBani >= params.free_delivery_from_bani
      },
    }),
    {
      name: DELIVERY_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        mode: s.mode,
        resolvedAddress: s.resolvedAddress,
        lat: s.lat,
        lng: s.lng,
      }),
    },
  ),
)
