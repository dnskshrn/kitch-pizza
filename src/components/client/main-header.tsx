"use client"

import { getBrandBySlug } from "@/brands/index"
import { AccountNavLink } from "@/components/client/account-nav-link"
import { ClientContainer } from "@/components/client/client-container"
import {
  StorefrontDesktopAuthStrip,
  StorefrontTopBarSchedule,
} from "@/components/client/storefront-top-bar"
import {
  getBrandCallLabel,
  getBrandPhone,
  getBrandPhoneHref,
} from "@/lib/brand-phone"
import { useDeliveryModalStore } from "@/lib/store/delivery-modal-store"
import { useDeliveryStore } from "@/lib/store/delivery-store"
import type { Lang, StorefrontMessages } from "@/lib/i18n/storefront"
import { useLanguage } from "@/lib/store/language-store"
import Image from "next/image"
import Link from "next/link"
import { Bike, ChevronDown, Menu, X } from "lucide-react"
import { useEffect, useState } from "react"

function getHeaderLogoMeta(brandSlug: string) {
  const brand = getBrandBySlug(brandSlug)
  switch (brand.slug) {
    case "the-spot":
      return {
        src: brand.logo,
        alt: brand.name,
        width: 80,
        height: 47,
        className: "h-[40px] w-[68px] md:h-[42px] md:w-[72px]",
      }
    case "losos":
      return {
        src: brand.logo,
        alt: brand.name,
        width: 176,
        height: 56,
        className: "h-[40px] w-[126px] md:h-[42px] md:w-[132px]",
      }
    default:
      return {
        src: brand.logo,
        alt: brand.name,
        width: 121,
        height: 56,
        className: "h-10 w-auto md:h-12",
      }
  }
}

function PhoneNumberDisplay({
  className,
  phone,
}: {
  className?: string
  phone: string
}) {
  if (phone !== "079 700 290") {
    return <span className={className}>{phone}</span>
  }

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

function Logo({
  brandSlug = "kitch-pizza",
  homeLabel,
}: {
  brandSlug?: string
  homeLabel: (brandName: string) => string
}) {
  const logo = getHeaderLogoMeta(brandSlug)

  return (
    <Link
      href="/"
      className="inline-flex shrink-0 cursor-pointer items-center transition-all duration-200 hover:opacity-90"
      aria-label={homeLabel(logo.alt)}
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

function TheSpotDesktopHeader({
  brandSlug,
  addressLabel,
  brandPhone,
  brandPhoneHref,
  brandCallLabel,
  menuOpen,
  overlayLang,
  onOpenAddress,
  onOpenMenu,
  onLangChange,
  t,
}: {
  brandSlug: string
  addressLabel: string
  brandPhone: string
  brandPhoneHref: string
  brandCallLabel: string
  menuOpen: boolean
  overlayLang: Lang
  onOpenAddress: () => void
  onOpenMenu: () => void
  onLangChange: (lang: Lang) => void
  t: StorefrontMessages
}) {
  return (
    <div className="hidden w-full md:block">
      <div className="flex min-h-[64px] w-full items-center gap-2 rounded-full bg-white p-2 shadow-[0_14px_42px_rgba(36,36,36,0.04)] md:-mx-2 md:w-[calc(100%+1rem)] lg:-mx-4 lg:w-[calc(100%+2rem)] lg:gap-3">
        <div className="flex min-w-[96px] shrink-0 justify-start pl-2 lg:min-w-[120px]">
          <Logo brandSlug={brandSlug} homeLabel={t.common.brandHome} />
        </div>

        <button
          type="button"
          onClick={onOpenAddress}
          className="flex h-11 min-w-0 flex-1 items-center justify-center gap-2 rounded-full bg-[var(--color-bg)] px-4 text-left transition-all duration-200 hover:brightness-[0.98] lg:max-w-[340px]"
          aria-label={t.header.deliveryAddress}
        >
          <Bike className="size-4 shrink-0 text-[var(--color-text)]" strokeWidth={2.2} />
          <span className="min-w-0">
            <span className="block truncate text-[11px] font-normal leading-none text-[var(--color-muted)]">
              {t.header.deliveryAddress}
            </span>
            <span className="mt-1 block truncate text-[14px] font-bold leading-none text-[var(--color-text)]">
              {addressLabel}
            </span>
          </span>
        </button>

        <div className="hidden shrink-0 lg:flex">
          <StorefrontTopBarSchedule />
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-2 lg:gap-3">
          <AccountNavLink
            brandSlug={brandSlug}
            lang={overlayLang}
            className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--color-bg)] text-[var(--color-text)] transition-all duration-200 hover:brightness-[0.98] md:flex lg:hidden"
          />
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
            href={brandPhoneHref}
            className="hidden h-11 shrink-0 items-center gap-2 rounded-full bg-[var(--color-bg)] px-4 text-[14px] font-bold text-[var(--color-text)] transition-all duration-200 hover:brightness-[0.98] lg:flex"
            aria-label={brandCallLabel}
          >
            <PhoneIcon className="size-4" />
            <span>{brandPhone}</span>
          </a>
          <div className="hidden lg:flex">
            <StorefrontDesktopAuthStrip brandSlug={brandSlug} />
          </div>
        </div>

        <button
          type="button"
          className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full bg-[var(--color-bg)] text-[var(--color-text)] transition-all duration-200 active:scale-[0.97] lg:hidden"
          aria-expanded={menuOpen}
          aria-label={menuOpen ? t.header.closeMenu : t.header.openMenu}
          onClick={onOpenMenu}
        >
          <Menu className="size-6" strokeWidth={2} />
        </button>
      </div>
    </div>
  )
}

function MobileFullMenuOverlay({
  brandSlug,
  onClose,
  onAddressClick,
  brandPhone,
  brandPhoneHref,
  brandCallLabel,
  addressLabel,
  lang,
  setLang,
  t,
}: {
  brandSlug: string
  onClose: () => void
  onAddressClick: () => void
  brandPhone: string
  brandPhoneHref: string
  brandCallLabel: string
  addressLabel: string
  lang: Lang
  setLang: (next: Lang) => void
  t: StorefrontMessages
}) {
  const langBtnBase =
    "rounded-full px-3 py-2 text-[14px] font-bold transition-all duration-200"

  return (
    <div
      className="fixed inset-0 z-[120] flex flex-col bg-[#F5F2F0] px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] md:hidden"
      role="dialog"
      aria-modal="true"
      aria-label={t.common.menu}
    >
      <div className="flex shrink-0 items-center justify-between gap-2 rounded-full bg-white p-2 pl-3 shadow-[0_16px_42px_rgba(36,36,36,0.06)]">
        <Logo brandSlug={brandSlug} homeLabel={t.common.brandHome} />
        <div className="flex shrink-0 items-center gap-2">
          <AccountNavLink
            brandSlug={brandSlug}
            lang={lang}
            className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full bg-[var(--color-bg)] text-[var(--color-text)] transition-all duration-200 hover:brightness-[0.98] active:scale-[0.96]"
          />
          <div
            className="flex items-center rounded-full bg-[var(--color-bg)] p-1"
            role="group"
            aria-label={
              lang === "RO" ? "Selectați limba (RU / RO)" : "Выберите язык (RU / RO)"
            }
          >
            <button
              type="button"
              onClick={() => setLang("RO")}
              className={
                lang === "RO"
                  ? `${langBtnBase} bg-[var(--color-accent)] text-[var(--color-accent-text)]`
                  : `${langBtnBase} text-[var(--color-muted)]`
              }
            >
              RO
            </button>
            <button
              type="button"
              onClick={() => setLang("RU")}
              className={
                lang === "RU"
                  ? `${langBtnBase} bg-[var(--color-accent)] text-[var(--color-accent-text)]`
                  : `${langBtnBase} text-[var(--color-muted)]`
              }
            >
              RU
            </button>
          </div>
          <button
            type="button"
            className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full bg-[var(--color-bg)] text-[var(--color-text)] transition-all duration-200 active:scale-[0.96]"
            aria-label={t.header.closeMenu}
            onClick={onClose}
          >
            <X className="size-6" strokeWidth={2} />
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={onAddressClick}
        className="mt-5 flex w-full shrink-0 items-center gap-3 rounded-full bg-white px-4 py-3 text-left shadow-[0_16px_42px_rgba(36,36,36,0.06)] transition-all duration-200 active:scale-[0.99]"
        aria-label={t.header.deliveryAddress}
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent)] text-[var(--color-accent-text)]">
          <Bike className="size-5" strokeWidth={2.2} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[10px] font-normal leading-tight text-[var(--color-muted)]">
            {t.header.deliveryAddress}
          </span>
          <span className="mt-0.5 block truncate text-[14px] font-bold leading-tight text-[var(--color-text)]">
            {addressLabel}
          </span>
        </span>
        <ChevronDown
          className="size-4 shrink-0 text-[var(--color-text)] opacity-70"
          strokeWidth={2.25}
          aria-hidden
        />
      </button>

      <div className="min-h-0 flex-1" aria-hidden />

      <a
        href={brandPhoneHref}
        onClick={onClose}
        className="mt-4 flex w-full shrink-0 items-center justify-center gap-2 rounded-full bg-[var(--color-accent)] px-4 py-3.5 text-[16px] font-bold text-[var(--color-accent-text)] shadow-[0_8px_24px_rgba(36,36,36,0.12)] transition-all duration-200 hover:brightness-105 active:scale-[0.99]"
        aria-label={brandCallLabel}
      >
        <PhoneIcon className="size-5 shrink-0 text-[var(--color-accent-text)]" />
        <PhoneNumberDisplay phone={brandPhone} className="tabular-nums" />
      </a>
    </div>
  )
}

export function MainHeader({ brandSlug = "kitch-pizza" }: { brandSlug?: string }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const { lang: overlayLang, setLang: setOverlayLang, t } = useLanguage()
  const brandPhone = getBrandPhone(brandSlug)
  const brandPhoneHref = getBrandPhoneHref(brandPhone)
  const brandCallLabel = getBrandCallLabel(brandPhone, overlayLang)

  const openDeliveryModal = useDeliveryModalStore((s) => s.open)
  const deliveryMode = useDeliveryStore((s) => s.mode)
  const resolvedAddress = useDeliveryStore((s) => s.resolvedAddress)

  const theSpotAddressLabel =
    deliveryMode === "pickup"
      ? t.header.pickupShort
      : resolvedAddress
        ? truncAddress(resolvedAddress, 34)
        : t.header.theSpotFallbackAddress

  useEffect(() => {
    if (!menuOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [menuOpen])

  const openAddressFromMenu = () => {
    setMenuOpen(false)
    openDeliveryModal()
  }

  return (
    <header
      className={
        menuOpen
          ? "sticky top-10 z-[120] bg-transparent lg:top-0"
          : "sticky top-10 z-30 bg-transparent lg:top-0"
      }
    >
      <ClientContainer className="px-4 py-3 md:px-4 md:py-5 lg:px-4">
        <div className="md:hidden">
          <div className="flex h-[63px] w-full items-center gap-3 rounded-full bg-white p-2 shadow-[0_14px_42px_rgba(36,36,36,0.04)]">
              <Logo brandSlug={brandSlug} homeLabel={t.common.brandHome} />
              <button
                type="button"
                onClick={openDeliveryModal}
                className="flex min-w-0 flex-1 items-center justify-center gap-2 rounded-full bg-[var(--color-bg)] px-4 py-2 text-center transition-all duration-200 active:scale-[0.99]"
                aria-label={t.header.deliveryAddress}
              >
                <Bike
                  className="size-5 shrink-0 text-[var(--color-text)]"
                  strokeWidth={2.2}
                />
                <span className="min-w-0 leading-none">
                  <span className="block truncate text-[10px] font-normal text-[var(--color-muted)]">
                    {t.header.deliveryAddress}
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
                aria-label={menuOpen ? t.header.closeMenu : t.header.openMenu}
                onClick={() => setMenuOpen((o) => !o)}
              >
                <Menu className="h-7 w-7" strokeWidth={2} />
              </button>
          </div>
        </div>
        <TheSpotDesktopHeader
            brandSlug={brandSlug}
            addressLabel={theSpotAddressLabel}
            brandPhone={brandPhone}
            brandPhoneHref={brandPhoneHref}
            brandCallLabel={brandCallLabel}
            menuOpen={menuOpen}
            overlayLang={overlayLang}
            onOpenAddress={openDeliveryModal}
            onOpenMenu={() => setMenuOpen((o) => !o)}
            onLangChange={setOverlayLang}
            t={t}
        />
      </ClientContainer>

      {menuOpen ? (
        <MobileFullMenuOverlay
          brandSlug={brandSlug}
          onClose={() => setMenuOpen(false)}
          onAddressClick={openAddressFromMenu}
          brandPhone={brandPhone}
          brandPhoneHref={brandPhoneHref}
          brandCallLabel={brandCallLabel}
          addressLabel={theSpotAddressLabel}
          lang={overlayLang}
          setLang={setOverlayLang}
          t={t}
        />
      ) : null}
    </header>
  )
}
