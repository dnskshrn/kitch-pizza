"use client"

import type { Lang } from "@/lib/i18n/storefront"
import { storefrontAccountPath } from "@/lib/storefront-account-path"
import { useAuthStore } from "@/lib/store/auth-store"
import Link from "next/link"
import { User } from "lucide-react"

export function AccountNavLink({
  brandSlug,
  lang,
  className,
}: {
  brandSlug: string
  lang: Lang
  className?: string
}) {
  const profile = useAuthStore((s) => s.profile)
  if (!profile) return null

  return (
    <Link
      href={storefrontAccountPath(brandSlug)}
      className={className}
      aria-label={lang === "RO" ? "Contul meu" : "Личный кабинет"}
    >
      <User className="size-5 shrink-0" strokeWidth={2} aria-hidden />
    </Link>
  )
}
