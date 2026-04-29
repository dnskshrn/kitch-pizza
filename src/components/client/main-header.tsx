"use client"

import { ClientContainer } from "@/components/client/client-container"
import { BRAND_ACCENT } from "@/lib/client-brand"
import { NAV_LINKS } from "@/components/client/top-nav"
import { useDeliveryModalStore } from "@/lib/store/delivery-modal-store"
import { useDeliveryStore } from "@/lib/store/delivery-store"
import Image from "next/image"
import Link from "next/link"
import { Bike, MapPin, Menu, X } from "lucide-react"
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

function hasBoutiqueHeader(brandSlug: string): boolean {
  return brandSlug === "the-spot" || brandSlug === "losos"
}

function getHeaderLogoMeta(brandSlug: string) {
  if (brandSlug === "the-spot") {
    return {
      src: "/the-spot-logo.svg",
      alt: "The Spot",
      width: 80,
      height: 47,
      className: "h-[40px] w-[68px] md:h-[42px] md:w-[72px]",
    }
  }

  if (brandSlug === "losos") {
    return {
      src: "/Losos_Logo.svg",
      alt: "LOSOS",
      width: 176,
      height: 56,
      className: "h-[40px] w-[126px] md:h-[42px] md:w-[132px]",
    }
  }

  return {
    src: "/kitch-pizza-logo.svg",
    alt: "Kitch Pizza",
    width: 121,
    height: 56,
    className: "h-10 w-auto md:h-12",
  }
}

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

function Logo({ brandSlug = "kitch-pizza" }: { brandSlug?: string }) {
  const logo = getHeaderLogoMeta(brandSlug)

  return (
    <Link
      href="/"
      className="inline-flex shrink-0 cursor-pointer items-center transition-all duration-200 hover:opacity-90"
      aria-label={`${logo.alt} — на главную`}
    >
      <Image
        src={logo.src}
        alt={logo.alt}
        width={logo.width}
        height={logo.height}
        className={logo.className}
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

function TheSpotDesktopHeader({
  brandSlug,
  addressLabel,
  menuOpen,
  overlayLang,
  onOpenAddress,
  onOpenMenu,
  onLangChange,
}: {
  brandSlug: string
  addressLabel: string
  menuOpen: boolean
  overlayLang: Lang
  onOpenAddress: () => void
  onOpenMenu: () => void
  onLangChange: (lang: Lang) => void
}) {
  const navLinks = [
    { href: "#menu", label: "Меню" },
    { href: "#promotions", label: "Акции" },
    { href: "#contacts", label: "Контакты" },
  ] as const

  return (
    <div className="hidden w-full md:block">
      <div className="flex min-h-[64px] w-full items-center gap-2 rounded-full bg-white p-2 shadow-[0_14px_42px_rgba(36,36,36,0.04)] md:-mx-2 md:w-[calc(100%+1rem)] lg:-mx-4 lg:w-[calc(100%+2rem)] lg:gap-3">
        <div className="flex min-w-[96px] shrink-0 justify-start pl-2 lg:min-w-[120px]">
          <Logo brandSlug={brandSlug} />
        </div>

        <button
          type="button"
          onClick={onOpenAddress}
          className="flex h-11 min-w-0 flex-1 items-center justify-center gap-2 rounded-full bg-[var(--color-bg)] px-4 text-left transition-all duration-200 hover:brightness-[0.98] lg:max-w-[340px]"
          aria-label="Адрес доставки"
        >
          <Bike className="size-4 shrink-0 text-[var(--color-text)]" strokeWidth={2.2} />
          <span className="min-w-0">
            <span className="block truncate text-[11px] font-normal leading-none text-[var(--color-muted)]">
              Адрес доставки
            </span>
            <span className="mt-1 block truncate text-[14px] font-bold leading-none text-[var(--color-text)]">
              {addressLabel}
            </span>
          </span>
        </button>

        <nav
          className="hidden min-w-0 flex-1 items-center justify-center gap-2 lg:flex"
          aria-label="Навигация The Spot"
        >
          {navLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="rounded-full px-3.5 py-2.5 text-[14px] font-bold text-[var(--color-text)] transition-all duration-200 hover:bg-[var(--color-bg)]"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-1 rounded-full bg-[var(--color-bg)] p-1 text-[13px] font-bold lg:flex">
          <button
            type="button"
            onClick={() => onLangChange("RU")}
            className={
              overlayLang === "RU"
                ? "rounded-full bg-white px-3 py-2 text-[var(--color-text)]"
                : "rounded-full px-3 py-2 text-[var(--color-muted)] transition-all duration-200 hover:text-[var(--color-text)]"
            }
          >
            RU
          </button>
          <button
            type="button"
            onClick={() => onLangChange("RO")}
            className={
              overlayLang === "RO"
                ? "rounded-full bg-white px-3 py-2 text-[var(--color-text)]"
                : "rounded-full px-3 py-2 text-[var(--color-muted)] transition-all duration-200 hover:text-[var(--color-text)]"
            }
          >
            RO
          </button>
        </div>

        <a
          href={PHONE_TEL}
          className="hidden h-11 shrink-0 items-center gap-2 rounded-full bg-[var(--color-bg)] px-4 text-[14px] font-bold text-[var(--color-text)] transition-all duration-200 hover:brightness-[0.98] xl:flex"
          aria-label="Позвонить 079 700 290"
        >
          <PhoneIcon className="size-4" />
          <span>079 700 290</span>
        </a>

        <button
          type="button"
          className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full bg-[var(--color-bg)] text-[var(--color-text)] transition-all duration-200 active:scale-[0.97] lg:hidden"
          aria-expanded={menuOpen}
          aria-label={menuOpen ? "Закрыть меню" : "Открыть меню"}
          onClick={onOpenMenu}
        >
          <Menu className="size-6" strokeWidth={2} />
        </button>
      </div>
    </div>
  )
}

export function MainHeader({ brandSlug = "kitch-pizza" }: { brandSlug?: string }) {
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
  const theSpotAddressLabel =
    deliveryMode === "pickup"
      ? "Самовывоз · bd. Dacia 27"
      : resolvedAddress
        ? truncAddress(resolvedAddress, 34)
        : "str. Dacia 35"

  const etaMinutes = selectedZone?.delivery_time_min ?? 42
  const hasBoutiqueLayout = hasBoutiqueHeader(brandSlug)
  const menuLinks = hasBoutiqueLayout
    ? ([
        { href: "#menu", label: "Меню" },
        { href: "#promotions", label: "Акции" },
        { href: "#contacts", label: "Контакты" },
      ] as const)
    : NAV_LINKS

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
    <header
      className={
        hasBoutiqueLayout
          ? menuOpen
            ? "sticky top-0 z-[120] bg-transparent"
            : "sticky top-0 z-30 bg-transparent"
          : "bg-white"
      }
    >
      <ClientContainer className={hasBoutiqueLayout ? "px-4 py-3 md:px-4 md:py-5 lg:px-4" : "py-3"}>
        {hasBoutiqueLayout ? (
          <>
            <div className="md:hidden">
              <div className="flex h-[63px] w-full items-center gap-3 rounded-full bg-white p-2">
                <Logo brandSlug={brandSlug} />
                <button
                  type="button"
                  onClick={openDeliveryModal}
                  className="flex min-w-0 flex-1 items-center justify-center gap-2 rounded-full bg-[var(--color-bg)] px-4 py-2 text-center"
                  aria-label="Адрес доставки"
                >
                  <Bike className="size-5 shrink-0 text-[var(--color-text)]" strokeWidth={2.2} />
                  <span className="min-w-0 leading-none">
                    <span className="block truncate text-[10px] font-normal text-[var(--color-muted)]">
                      Адрес доставки
                    </span>
                    <span className="mt-1 block truncate text-[14px] font-bold text-[var(--color-text)]">
                      {theSpotAddressLabel}
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  className="flex h-full w-[51px] shrink-0 cursor-pointer items-center justify-center rounded-full bg-white text-[var(--color-text)] transition-all duration-200 active:scale-[0.97]"
                  aria-expanded={menuOpen}
                  aria-label={menuOpen ? "Закрыть меню" : "Открыть меню"}
                  onClick={() => setMenuOpen((o) => !o)}
                >
                  <Menu className="h-7 w-7" strokeWidth={2} />
                </button>
              </div>
            </div>
            <TheSpotDesktopHeader
              brandSlug={brandSlug}
              addressLabel={theSpotAddressLabel}
              menuOpen={menuOpen}
              overlayLang={overlayLang}
              onOpenAddress={openDeliveryModal}
              onOpenMenu={() => setMenuOpen((o) => !o)}
              onLangChange={setOverlayLang}
            />
          </>
        ) : (
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
              <Logo brandSlug={brandSlug} />
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
        )}

        <div
          className={
            hasBoutiqueLayout
              ? "hidden"
              : "hidden md:grid md:grid-cols-[auto_1fr_auto] md:items-center md:gap-6"
          }
        >
          <div className="flex justify-start">
            <Logo brandSlug={brandSlug} />
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
          className={
            hasBoutiqueLayout
              ? "the-spot-menu-overlay fixed inset-0 z-[120] flex flex-col overflow-hidden bg-[var(--color-bg)] lg:hidden"
              : "fixed inset-0 z-[120] flex flex-col bg-white md:hidden"
          }
          role="dialog"
          aria-modal="true"
          aria-label="Меню"
        >
          {hasBoutiqueLayout ? (
            <>
              <div
                className="pointer-events-none absolute -right-20 top-20 size-56 rounded-full bg-[var(--color-accent-soft)] opacity-80"
                aria-hidden
              />
              <div
                className="pointer-events-none absolute -left-24 bottom-28 size-64 rounded-full bg-white/70"
                aria-hidden
              />
              <ClientContainer className="the-spot-menu-content relative z-10 flex items-center justify-between px-4 py-[max(0.75rem,env(safe-area-inset-top))]">
                <div className="flex h-[63px] min-w-0 flex-1 items-center rounded-full bg-white px-4 shadow-[0_16px_42px_rgba(36,36,36,0.06)]">
                  <Logo brandSlug={brandSlug} />
                </div>
                <button
                  type="button"
                  className="ml-3 flex size-[63px] shrink-0 cursor-pointer items-center justify-center rounded-full bg-white text-[var(--color-text)] shadow-[0_16px_42px_rgba(36,36,36,0.06)] transition-all duration-200 active:scale-[0.96]"
                  aria-label="Закрыть меню"
                  onClick={() => setMenuOpen(false)}
                >
                  <X className="size-7" strokeWidth={2} />
                </button>
              </ClientContainer>

              <ClientContainer className="the-spot-menu-content relative z-10 flex flex-1 flex-col overflow-y-auto px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3">
                <nav className="flex flex-col gap-3" aria-label="Навигация The Spot">
                  {menuLinks.map((link, index) => (
                    <a
                      key={link.label}
                      href={link.href}
                      className="group flex min-h-[72px] cursor-pointer items-center justify-between rounded-[24px] bg-white px-5 text-[28px] font-black leading-none tracking-[-0.04em] text-[var(--color-text)] shadow-[0_16px_42px_rgba(36,36,36,0.04)] transition-all duration-200 active:scale-[0.98]"
                      onClick={() => setMenuOpen(false)}
                    >
                      <span>{link.label}</span>
                      <span className="flex size-9 items-center justify-center rounded-full bg-[var(--color-accent-soft)] text-[15px] font-bold tracking-normal text-[var(--color-accent-text)] transition-colors group-active:bg-[var(--color-accent)] group-active:text-white">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                    </a>
                  ))}
                </nav>

                <div className="mt-5 grid gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false)
                      openDeliveryModal()
                    }}
                    className="flex cursor-pointer items-center gap-3 rounded-[24px] bg-white p-4 text-left shadow-[0_16px_42px_rgba(36,36,36,0.04)] transition-all duration-200 active:scale-[0.98]"
                  >
                    <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent)] text-white">
                      <Bike className="size-5" strokeWidth={2.2} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[12px] font-medium text-[var(--color-muted)]">
                        Адрес доставки
                      </span>
                      <span className="mt-1 block truncate text-[16px] font-bold text-[var(--color-text)]">
                        {theSpotAddressLabel}
                      </span>
                    </span>
                  </button>

                  <a
                    href={PHONE_TEL}
                    className="flex cursor-pointer items-center gap-3 rounded-[24px] bg-white p-4 text-[16px] font-bold text-[var(--color-text)] shadow-[0_16px_42px_rgba(36,36,36,0.04)] transition-all duration-200 active:scale-[0.98]"
                    aria-label="Позвонить 079 700 290"
                  >
                    <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent-soft)] text-[var(--color-accent-text)]">
                      <PhoneIcon className="size-5" />
                    </span>
                    <span>079 700 290</span>
                  </a>
                </div>

                <div className="mt-auto flex items-end justify-between gap-4 pt-6">
                  <div className="text-[12px] font-medium leading-relaxed text-[var(--color-muted)]">
                    <span className="block">График работы</span>
                    <span className="block font-bold text-[var(--color-text)]">
                      11:00 – 23:00
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-1 rounded-full bg-white p-1 text-[13px] font-bold shadow-[0_16px_42px_rgba(36,36,36,0.04)]">
                    <button
                      type="button"
                      onClick={() => setOverlayLang("RU")}
                      className={
                        overlayLang === "RU"
                          ? "rounded-full bg-[var(--color-accent)] px-4 py-2 text-white"
                          : "rounded-full px-4 py-2 text-[var(--color-muted)] transition-all duration-200"
                      }
                    >
                      RU
                    </button>
                    <button
                      type="button"
                      onClick={() => setOverlayLang("RO")}
                      className={
                        overlayLang === "RO"
                          ? "rounded-full bg-[var(--color-accent)] px-4 py-2 text-white"
                          : "rounded-full px-4 py-2 text-[var(--color-muted)] transition-all duration-200"
                      }
                    >
                      RO
                    </button>
                  </div>
                </div>
              </ClientContainer>
            </>
          ) : (
            <>
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
                {menuLinks.map((link) => (
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
            </>
          )}
        </div>
      ) : null}
    </header>
  )
}
