"use client"

import { useStoreOpen } from "@/hooks/use-store-open"
import { htmlLang } from "@/lib/i18n/storefront"
import { useLanguage } from "@/lib/store/language-store"
import { useEffect, useState } from "react"

function StoreClosedModal({ brandSlug }: { brandSlug: string }) {
  const { isOpen, hours, minutes, mounted, openTimeLabel } =
    useStoreOpen(brandSlug)
  const { lang } = useLanguage()
  const locale = htmlLang(lang)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (isOpen) setDismissed(false)
  }, [isOpen])

  if (!mounted) return null
  if (isOpen || dismissed) return null

  const minStr = String(minutes).padStart(2, "0")
  const timeSuffix =
    hours === 0
      ? locale === "ro"
        ? `${minutes} min`
        : `${minStr} мин`
      : locale === "ro"
        ? `${hours} h ${minStr} min`
        : `${hours} ч ${minStr} мин`

  const heading =
    locale === "ro"
      ? "Momentan suntem închiși 😴"
      : "Мы сейчас закрыты 😴"

  const body =
    locale === "ro"
      ? `Deschidem la ${openTimeLabel} — peste ${timeSuffix}`
      : `Открываемся в ${openTimeLabel} — через ${timeSuffix}`

  const buttonLabel = locale === "ro" ? "Am înțeles :(" : "Понятно :("

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="presentation"
    >
      <div
        className="storefront-modal-surface storefront-modal-card-radius w-full max-w-sm rounded-2xl p-6 text-[var(--color-text)] shadow-lg"
        role="dialog"
        aria-modal="true"
        aria-labelledby="store-closed-heading"
      >
        <h2
          id="store-closed-heading"
          className="text-center text-xl font-bold leading-snug"
        >
          {heading}
        </h2>
        <p className="mt-3 text-center text-base text-[var(--color-muted)]">
          {body}
        </p>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="storefront-modal-cta mt-6 w-full cursor-pointer rounded-full py-3.5 text-[16px] font-bold transition-all hover:brightness-95 active:scale-[0.98]"
        >
          {buttonLabel}
        </button>
      </div>
    </div>
  )
}

export default StoreClosedModal
