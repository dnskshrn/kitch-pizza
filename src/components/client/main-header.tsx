"use client"

import { ClientContainer } from "@/components/client/client-container"
import { BRAND_ACCENT } from "@/lib/client-brand"
import { NAV_LINKS } from "@/components/client/top-nav"
import { useDeliveryModalStore } from "@/lib/store/delivery-modal-store"
import { useDeliveryStore } from "@/lib/store/delivery-store"
import Image from "next/image"
import Link from "next/link"
import { MapPin } from "lucide-react"
import { useEffect, useState } from "react"

const LANG_KEY = "lang"

type Lang = "RU" | "RO"

function readStoredLang(): Lang {
  if (typeof window === "undefined") return "RU"
  return window.localStorage.getItem(LANG_KEY) === "RO" ? "RO" : "RU"
}
const ADDRESS_BG = "#f3f4f6"
/** Фиксированная ширина полосы доставки на десктопе (не растягивается на всю колонку). */
const DELIVERY_BAR_MAX_WIDTH_CLASS = "max-w-[520px]"
const PHONE_TEL = "tel:+37379700290"

function PhoneNumberDisplay({ className }: { className?: string }) {
  return (
    <span className={className}>
      <span className="font-bold not-italic">079 </span>
      <span className="font-black italic">700 290</span>
    </span>
  )
}

function truncAddress(s: string, max: number): string {
  const t = s.trim()
  if (t.length <= max) return t
  return `${t.slice(0, Math.max(0, max - 1))}…`
}

function Logo() {
  return (
    <Link
      href="/"
      className="inline-flex shrink-0 cursor-pointer items-center transition-all duration-200 hover:opacity-90"
      aria-label="Kitch Pizza — на главную"
    >
      <Image
        src="/kitch-pizza-logo.svg"
        alt="Kitch Pizza"
        width={121}
        height={56}
        className="h-10 w-auto md:h-12"
        priority
        unoptimized
      />
    </Link>
  )
}

function PhoneIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  )
}

function DeliveryBanner({
  addressLabel,
  etaMinutes,
  onOpenAddress,
}: {
  addressLabel: string
  etaMinutes: number
  onOpenAddress: () => void
}) {
  return (
    <div
      className={`flex w-full flex-col gap-3 rounded-2xl p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4 ${DELIVERY_BAR_MAX_WIDTH_CLASS}`}
      style={{ backgroundColor: ADDRESS_BG }}
    >
      <div className="min-w-0">
        <p className="text-sm font-bold leading-tight text-foreground">
          Доставляем пиццу{" "}
          <span style={{ color: BRAND_ACCENT }}>Ботаника</span>
        </p>
        <p className="text-muted-foreground mt-1 text-xs">
          Привезем за{" "}
          <span className="font-bold text-foreground">~{etaMinutes} мин</span>
        </p>
      </div>
      <button
        type="button"
        onClick={onOpenAddress}
        className="flex w-full max-w-full shrink-0 cursor-pointer items-center gap-2 rounded-full bg-white px-3 py-2.5 text-left text-sm text-foreground transition-all duration-200 hover:brightness-[0.98] sm:w-auto"
        aria-label="Адрес доставки"
      >
        <MapPin
          className="size-4 shrink-0"
          style={{ color: BRAND_ACCENT }}
          aria-hidden
          strokeWidth={2.25}
        />
        <span className="min-w-0 truncate">{addressLabel}</span>
      </button>
    </div>
  )
}

export function MainHeader() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [overlayLang, setOverlayLang] = useState<Lang>("RU")

  const openDeliveryModal = useDeliveryModalStore((s) => s.open)
  const deliveryMode = useDeliveryStore((s) => s.mode)
  const resolvedAddress = useDeliveryStore((s) => s.resolvedAddress)
  const selectedZone = useDeliveryStore((s) => s.selectedZone)

  const addressLabel =
    deliveryMode === "pickup"
      ? "Самовывоз · bd. Dacia 27"
      : resolvedAddress
        ? truncAddress(resolvedAddress, 42)
        : "Укажите ваш адрес"

  const etaMinutes = selectedZone?.delivery_time_min ?? 42

  useEffect(() => {
    setOverlayLang(readStoredLang())
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    window.localStorage.setItem(LANG_KEY, overlayLang)
  }, [overlayLang])

  useEffect(() => {
    if (!menuOpen) return
    setOverlayLang(readStoredLang())
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [menuOpen])

  const scheduleBlock = (
    <div className="text-muted-foreground flex flex-wrap items-center gap-x-2 text-[12px]">
      <span>График работы</span>
      <span className="whitespace-nowrap">11:00 – 23:00</span>
    </div>
  )

  const overlayLangBlock = (
    <div className="flex items-center gap-1 text-[12px]">
      <button
        type="button"
        onClick={() => setOverlayLang("RU")}
        className={
          overlayLang === "RU"
            ? "cursor-pointer font-semibold underline transition-all duration-200"
            : "text-muted-foreground hover:text-foreground cursor-pointer transition-all duration-200"
        }
      >
        RU
      </button>
      <span className="text-muted-foreground">/</span>
      <button
        type="button"
        onClick={() => setOverlayLang("RO")}
        className={
          overlayLang === "RO"
            ? "cursor-pointer font-semibold underline transition-all duration-200"
            : "text-muted-foreground hover:text-foreground cursor-pointer transition-all duration-200"
        }
      >
        RO
      </button>
    </div>
  )

  return (
    <header className="bg-white">
      <ClientContainer className="py-3">
        <div className="flex flex-col gap-3 md:hidden">
          <div className="flex w-full items-center gap-2">
            <button
              type="button"
              className="text-foreground -ml-1 flex shrink-0 cursor-pointer p-1 transition-all duration-200 active:scale-[0.97]"
              aria-expanded={menuOpen}
              aria-label={menuOpen ? "Закрыть меню" : "Открыть меню"}
              onClick={() => setMenuOpen((o) => !o)}
            >
              <svg
                className="size-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>
            <div className="flex min-w-0 flex-1 justify-center">
              <Logo />
            </div>
            <a
              href={PHONE_TEL}
              className="text-foreground flex shrink-0 cursor-pointer items-center justify-center rounded-full bg-[#f3f4f6] p-2.5 transition-all duration-200 hover:brightness-[0.97] active:scale-[0.98]"
              aria-label="Позвонить 079 700 290"
            >
              <PhoneIcon className="size-6" />
            </a>
          </div>
          <DeliveryBanner
            addressLabel={addressLabel}
            etaMinutes={etaMinutes}
            onOpenAddress={openDeliveryModal}
          />
        </div>

        <div className="hidden md:grid md:grid-cols-[auto_1fr_auto] md:items-center md:gap-6">
          <div className="flex justify-start">
            <Logo />
          </div>
          <div className="flex min-w-0 justify-start">
            <DeliveryBanner
              addressLabel={addressLabel}
              etaMinutes={etaMinutes}
              onOpenAddress={openDeliveryModal}
            />
          </div>
          <div className="flex justify-end">
            <a
              href={PHONE_TEL}
              className="text-foreground inline-flex cursor-pointer items-center gap-2 rounded-full bg-[#f3f4f6] px-4 py-2.5 transition-all duration-200 hover:brightness-[0.97] active:scale-[0.98]"
              aria-label="Позвонить 079 700 290"
            >
              <PhoneIcon className="size-5 shrink-0" />
              <PhoneNumberDisplay className="text-lg tracking-tight" />
            </a>
          </div>
        </div>
      </ClientContainer>

      {menuOpen ? (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-white md:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Меню"
        >
          <ClientContainer className="flex h-11 items-center justify-end">
            <button
              type="button"
              className="cursor-pointer p-1 transition-all duration-200 active:scale-[0.97]"
              aria-label="Закрыть меню"
              onClick={() => setMenuOpen(false)}
            >
              <svg
                className="size-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </ClientContainer>
          <ClientContainer className="flex flex-1 flex-col gap-1 overflow-y-auto py-4">
            {NAV_LINKS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="cursor-pointer py-3 text-base transition-all duration-200 hover:text-foreground/80"
                onClick={() => setMenuOpen(false)}
              >
                {link.label}
              </a>
            ))}
            <a
              href="#"
              className="mt-2 inline-flex w-fit cursor-pointer rounded-full bg-[#ECFFA1] px-4 py-2 font-semibold text-[#5F7600] transition-all duration-200 hover:bg-[#dff090] active:scale-[0.97]"
              onClick={() => setMenuOpen(false)}
            >
              Акции
            </a>
          </ClientContainer>
          <ClientContainer className="py-4">
            <div className="flex flex-col gap-4">
              {scheduleBlock}
              {overlayLangBlock}
            </div>
          </ClientContainer>
        </div>
      ) : null}
    </header>
  )
}
