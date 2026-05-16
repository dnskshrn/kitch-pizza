"use client"

import { getBrandBySlug } from "@/brands/index"
import { Avatar } from "@/components/client/avatar"
import {
  getBrandPhone,
  getBrandPhoneHref,
} from "@/lib/brand-phone"
import { storefrontAccountPath } from "@/lib/storefront-account-path"
import { useAuthStore } from "@/lib/store/auth-store"
import { Clock } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"

/** Высота белой полосы в потоке (tailwind `h-11` / 44px). */
export const STOREFRONT_TOP_BAR_HEIGHT_PX = 44

function BrandPhoneText({
  phone,
  className,
}: {
  phone: string
  className?: string
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

export function StorefrontTopBarSchedule({ brandSlug }: { brandSlug: string }) {
  const hours = getBrandBySlug(brandSlug).hours
  return (
    <div className="flex min-w-0 shrink-0 items-center gap-2 text-[#242424]">
      <Clock className="size-4 shrink-0" strokeWidth={2} aria-hidden />
      <span className="text-[13px] font-normal tabular-nums whitespace-nowrap">
        {hours}
      </span>
    </div>
  )
}

/** Только блок входа / аватар для lg+ в шапке (без телефона — он уже в острове). */
export function StorefrontDesktopAuthStrip({ brandSlug }: { brandSlug: string }) {
  const profile = useAuthStore((s) => s.profile)
  const openAuth = useAuthStore((s) => s.openAuth)
  const accountHref = storefrontAccountPath(brandSlug)

  if (profile) {
    return (
      <Link
        href={accountHref}
        className="flex max-w-[min(100%,220px)] shrink-0 items-center gap-2 text-[#242424]"
      >
        <span className="truncate text-[13px] font-semibold tabular-nums">
          {profile.name?.trim() || profile.phone}
        </span>
        <Avatar profileId={profile.id} size={32} />
      </Link>
    )
  }

  return (
    <button
      type="button"
      onClick={() => openAuth()}
      className="flex shrink-0 items-center gap-2 rounded-lg outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-[#242424]/25"
    >
      <span className="text-[13px] font-normal text-[#242424]">Войти</span>
      <span className="size-8 shrink-0 rounded-full bg-[#e0e0e0]" aria-hidden />
    </button>
  )
}

type StorefrontTopBarProps = {
  brandSlug: string
}

export function StorefrontTopBar({ brandSlug }: StorefrontTopBarProps) {
  const pathname = usePathname()
  const profile = useAuthStore((s) => s.profile)
  const openAuth = useAuthStore((s) => s.openAuth)

  /** `/checkout`, `/losos/checkout`, `/thespot/checkout`, `/checkout/success` и т.д. */
  const isCheckoutFlow = pathname.split("/").includes("checkout")
  if (isCheckoutFlow) return null

  const phone = getBrandPhone(brandSlug)
  const telHref = getBrandPhoneHref(phone)
  const accountHref = storefrontAccountPath(brandSlug)

  return (
    <>
      <div
        className="fixed inset-x-0 top-0 z-10 hidden max-lg:block"
        style={{
          paddingTop: "max(0px, env(safe-area-inset-top))",
        }}
      >
        <div className="flex h-11 items-center justify-between rounded-b-2xl bg-[#ffffff] px-4">
          <StorefrontTopBarSchedule brandSlug={brandSlug} />

          <div className="flex min-w-0 shrink-0 items-center gap-3">
            {profile ? (
              <Link
                href={accountHref}
                className="flex max-w-[min(100%,280px)] items-center gap-2 text-[#242424]"
              >
                <Avatar profileId={profile.id} size={32} />
                <span className="truncate text-[13px] font-normal tabular-nums">
                  {profile.name?.trim() || profile.phone}
                </span>
              </Link>
            ) : (
              <>
                <a
                  href={telHref}
                  className="text-[13px] font-normal tabular-nums text-[#242424] underline-offset-2 hover:underline"
                >
                  <BrandPhoneText phone={phone} />
                </a>
                <button
                  type="button"
                  onClick={() => openAuth()}
                  className="flex items-center gap-2 rounded-lg outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-[#242424]/25"
                >
                  <span className="text-[13px] font-normal text-[#242424]">
                    Войти
                  </span>
                  <span
                    className="size-8 shrink-0 rounded-full bg-[#e0e0e0]"
                    aria-hidden
                  />
                </button>
              </>
            )}
          </div>
        </div>
      </div>
      <div
        className="hidden shrink-0 max-lg:block"
        style={{
          height: `calc(${STOREFRONT_TOP_BAR_HEIGHT_PX}px + env(safe-area-inset-top, 0px))`,
        }}
        aria-hidden
      />
    </>
  )
}
