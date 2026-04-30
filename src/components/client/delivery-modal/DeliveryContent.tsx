"use client"

import { geocodeAddress } from "@/lib/actions/check-delivery-zone"
import { findZoneForPoint } from "@/lib/geo"
import { formatMoneyValue } from "@/lib/i18n/storefront"
import { useDeliveryStore } from "@/lib/store/delivery-store"
import { useLanguage } from "@/lib/store/language-store"
import type { DeliveryZone } from "@/types/database"
import { cn } from "@/lib/utils"
import { Clock, Gift, Loader2, MapPin, Navigation, ShoppingBag, Truck } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { DeliveryModeIsland } from "./delivery-mode-island"

type DeliveryContentProps = {
  zones: DeliveryZone[]
  onChoose: () => void
  /** Геолокация устройства → координаты (родитель делает reverse + setResolved). */
  onLocateMe: () => void
  locating: boolean
  /** Панель десктопа: фиксированная высота и justify-between. */
  layout?: "desktop" | "sheet"
  /** Моб. sheet: переключатель вынесен на карту — дубль в форме не показываем */
  hideModeToggle?: boolean
}

export function DeliveryContent({
  zones,
  onChoose,
  onLocateMe,
  locating,
  layout = "sheet",
  hideModeToggle = false,
}: DeliveryContentProps) {
  const { lang, t } = useLanguage()
  const [addrFocused, setAddrFocused] = useState(false)

  const mode = useDeliveryStore((s) => s.mode)
  const address = useDeliveryStore((s) => s.address)
  const resolvedAddress = useDeliveryStore((s) => s.resolvedAddress)
  const lat = useDeliveryStore((s) => s.lat)
  const lng = useDeliveryStore((s) => s.lng)
  const selectedZone = useDeliveryStore((s) => s.selectedZone)
  const outOfZone = useDeliveryStore((s) => s.outOfZone)
  const geocoding = useDeliveryStore((s) => s.geocoding)

  const setAddress = useDeliveryStore((s) => s.setAddress)
  const setGeocoding = useDeliveryStore((s) => s.setGeocoding)
  const setResolved = useDeliveryStore((s) => s.setResolved)
  const setSecondary = useDeliveryStore((s) => s.setSecondary)

  const entrance = useDeliveryStore((s) => s.entrance)
  const floor = useDeliveryStore((s) => s.floor)
  const apartment = useDeliveryStore((s) => s.apartment)
  const intercom = useDeliveryStore((s) => s.intercom)
  const comment = useDeliveryStore((s) => s.comment)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (mode !== "delivery") return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const q = address.trim()
    if (!q) {
      setGeocoding(false)
      return
    }
    if (q === (resolvedAddress ?? "").trim()) {
      setGeocoding(false)
      return
    }
    setGeocoding(true)
    debounceRef.current = setTimeout(() => {
      void (async () => {
        try {
          const hit = await geocodeAddress(q)
          if (!hit) {
            setGeocoding(false)
            return
          }
          const zone = findZoneForPoint(hit.lat, hit.lng, zones)
          setResolved(hit.lat, hit.lng, hit.display_name, zone)
        } catch {
          setGeocoding(false)
        }
      })()
    }, 800)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [address, resolvedAddress, mode, setGeocoding, setResolved, zones])

  const resolvedCoords = lat != null && lng != null
  const canSubmit =
    mode === "pickup" || (mode === "delivery" && selectedZone != null && !outOfZone)

  const addressLifted = addrFocused || address.trim().length > 0

  const mainScroll = (
    <div
      className={cn(
        "flex min-h-0 flex-col gap-4",
        layout === "desktop" &&
          "min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain pr-0.5",
      )}
    >
      {layout === "desktop" ? (
        <h2 className="text-[20px] font-bold leading-tight text-[#242424]">
          {t.delivery.title}
        </h2>
      ) : null}

      {hideModeToggle ? null : <DeliveryModeIsland variant="panel" />}

      {mode === "pickup" ? (
        <div className="storefront-modal-field flex items-start gap-3 rounded-[16px] p-4">
          <MapPin className="storefront-modal-accent mt-0.5 size-5 shrink-0" strokeWidth={2} />
          <div>
            <p className="text-sm font-semibold text-[#242424]">{t.delivery.pickupTitle}</p>
            <p className="text-muted-foreground mt-1 text-sm">
              bd. Dacia 27, Chișinău
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex items-stretch gap-2">
            <div
              className={cn(
                "storefront-modal-field relative min-w-0 flex-1 rounded-[12px] px-[16px] py-[8px]",
                outOfZone && "ring-2 ring-inset ring-orange-400",
              )}
            >
              <label
                htmlFor="delivery-address-input"
                className={cn(
                  "pointer-events-none absolute left-[16px] transition-all duration-150",
                  addressLifted
                    ? "top-[8px] text-[10px] font-medium text-[rgba(0,0,0,0.5)]"
                    : "top-1/2 -translate-y-1/2 text-[14px] font-medium text-[rgba(0,0,0,0.5)]",
                )}
              >
                {t.delivery.enterAddress}
              </label>
              <input
                id="delivery-address-input"
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                onFocus={() => setAddrFocused(true)}
                onBlur={() => setAddrFocused(false)}
                autoComplete="off"
                className={cn(
                  "w-full bg-transparent pr-10 text-[14px] font-bold text-[#343434] outline-none placeholder:text-transparent",
                  addressLifted ? "pt-[22px] pb-0" : "py-[10px]",
                )}
              />
              {geocoding ? (
                <Loader2
                  className={cn(
                    "storefront-modal-accent absolute right-3 size-5 animate-spin",
                    addressLifted ? "top-[26px]" : "top-1/2 -translate-y-1/2",
                  )}
                />
              ) : null}
            </div>
            <button
              type="button"
              onClick={onLocateMe}
              disabled={locating}
              className="storefront-modal-cta flex w-[54px] shrink-0 items-center justify-center self-stretch rounded-[12px] transition-opacity disabled:pointer-events-none disabled:opacity-50"
              aria-label={t.delivery.locateMe}
            >
              {locating ? (
                <Loader2 className="size-6 animate-spin" />
              ) : (
                <Navigation
                  className="size-6 rotate-180 scale-y-[-1]"
                  strokeWidth={2}
                />
              )}
            </button>
          </div>

          {outOfZone ? (
            <div className="flex gap-3 pt-1">
              <div
                className="storefront-modal-soft size-16 shrink-0 rounded-[12px] border border-dashed border-[#ccc]"
                aria-hidden
              />
              <div className="min-w-0">
                <p className="text-[16px] font-bold leading-snug text-[#242424]">
                  {t.delivery.outOfZoneTitle}
                </p>
                <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                  {t.delivery.outOfZoneText}
                </p>
              </div>
            </div>
          ) : null}

          {!outOfZone ? (
            <>
              <div className="flex gap-[10px]">
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder={t.delivery.entrance}
                  value={entrance}
                  onChange={(e) => setSecondary({ entrance: e.target.value })}
                  className="storefront-modal-field min-w-0 flex-1 rounded-[8px] p-[12px] text-[14px] font-medium text-[#808080] placeholder:text-[#808080]"
                />
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder={t.delivery.floor}
                  value={floor}
                  onChange={(e) => setSecondary({ floor: e.target.value })}
                  className="storefront-modal-field min-w-0 flex-1 rounded-[8px] p-[12px] text-[14px] font-medium text-[#808080] placeholder:text-[#808080]"
                />
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder={t.delivery.apartment}
                  value={apartment}
                  onChange={(e) => setSecondary({ apartment: e.target.value })}
                  className="storefront-modal-field min-w-0 flex-1 rounded-[8px] p-[12px] text-[14px] font-medium text-[#808080] placeholder:text-[#808080]"
                />
                <input
                  type="text"
                  placeholder={t.delivery.intercom}
                  value={intercom}
                  onChange={(e) => setSecondary({ intercom: e.target.value })}
                  className="storefront-modal-field min-w-0 flex-1 rounded-[8px] p-[12px] text-[14px] font-medium text-[#808080] placeholder:text-[#808080]"
                />
              </div>

              <input
                type="text"
                placeholder={t.delivery.comment}
                value={comment}
                onChange={(e) => setSecondary({ comment: e.target.value })}
                className="storefront-modal-field w-full rounded-[12px] px-[16px] py-[14px] text-[14px] font-medium text-[#808080] placeholder:text-[#808080]"
              />
            </>
          ) : null}

          {selectedZone && resolvedCoords ? (
            <div
              className={cn(
                "grid gap-2 sm:gap-3",
                selectedZone.free_delivery_from_bani != null
                  ? "grid-cols-4"
                  : "grid-cols-3",
              )}
            >
              <div className="flex min-w-0 flex-col items-center gap-1 text-center">
                <Clock
                  className="storefront-modal-accent size-[22px] shrink-0"
                  strokeWidth={2}
                  aria-hidden
                />
                <p className="text-[10px] leading-tight text-[rgba(36,36,36,0.55)]">
                  {t.delivery.deliveryTime}
                </p>
                <p className="text-[13px] font-semibold leading-tight text-[#242424] sm:text-sm">
                  ~{selectedZone.delivery_time_min} {t.header.etaSuffix}
                </p>
              </div>
              <div className="flex min-w-0 flex-col items-center gap-1 text-center">
                <Truck
                  className="storefront-modal-accent size-[22px] shrink-0"
                  strokeWidth={2}
                  aria-hidden
                />
                <p className="text-[10px] leading-tight text-[rgba(36,36,36,0.55)]">
                  {t.delivery.deliveryCost}
                </p>
                <p className="text-[13px] font-semibold leading-tight text-[#242424] sm:text-sm">
                  {selectedZone.delivery_price_bani === 0
                    ? t.common.free
                    : `${formatMoneyValue(selectedZone.delivery_price_bani)} ${
                        lang === "RO" ? "lei" : "лей"
                      }`}
                </p>
              </div>
              <div className="flex min-w-0 flex-col items-center gap-1 text-center">
                <ShoppingBag
                  className="storefront-modal-accent size-[22px] shrink-0"
                  strokeWidth={2}
                  aria-hidden
                />
                <p className="text-[10px] leading-tight text-[rgba(36,36,36,0.55)]">
                  {t.delivery.minOrder}
                </p>
                <p className="text-[13px] font-semibold leading-tight text-[#242424] sm:text-sm">
                  {t.menu.from} {formatMoneyValue(selectedZone.min_order_bani)}{" "}
                  {lang === "RO" ? "lei" : "лей"}
                </p>
              </div>
              {selectedZone.free_delivery_from_bani != null ? (
                <div className="flex min-w-0 flex-col items-center gap-1 text-center">
                  <Gift
                    className="storefront-modal-accent size-[22px] shrink-0"
                    strokeWidth={2}
                    aria-hidden
                  />
                  <p className="text-[10px] leading-tight text-[rgba(36,36,36,0.55)]">
                    {t.delivery.freeFrom}
                  </p>
                  <p className="text-[13px] font-semibold leading-tight text-[#242424] sm:text-sm">
                    {formatMoneyValue(selectedZone.free_delivery_from_bani)}{" "}
                    {lang === "RO" ? "lei" : "лей"}
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
    </div>
  )

  const chooseBlock = (
    <div className="relative w-full shrink-0 pt-2">
      <button
        type="button"
        onClick={() => {
          if (!canSubmit) return
          onChoose()
        }}
        aria-disabled={!canSubmit}
        className={cn(
          "storefront-modal-cta relative w-full overflow-hidden rounded-full py-3.5 text-[16px] font-bold",
          !canSubmit && "pointer-events-none",
        )}
      >
        {!canSubmit ? (
          <div
            className="pointer-events-none absolute inset-0 rounded-full bg-black/20"
            aria-hidden
          />
        ) : null}
        <span className="relative z-10">{t.delivery.choose}</span>
      </button>
    </div>
  )

  if (layout === "desktop") {
    return (
      <div className="flex h-full min-h-0 flex-col justify-between">
        {mainScroll}
        {chooseBlock}
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-col">
      {mainScroll}
      <div className="mt-auto shrink-0 pt-4">{chooseBlock}</div>
    </div>
  )
}
