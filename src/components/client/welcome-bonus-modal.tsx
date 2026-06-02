"use client"

import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog"
import { useLanguage } from "@/lib/store/language-store"
import { useAuthStore } from "@/lib/store/auth-store"
import { useEffect, useState } from "react"
import { Drawer } from "vaul"

const COPY = {
  title: "🎉 +100 бонусов!",
  subtitleRu:
    "Добро пожаловать в LOSOS! Вам начислено 100 приветственных бонусов — используйте их при следующем заказе.",
  subtitleRo:
    "Bun venit la LOSOS! Ți-am acordat 100 de bonusuri de bun venit — folosește-le la următoarea comandă.",
  buttonRu: "Отлично!",
  buttonRo: "Super!",
  a11yTitle: "Приветственный бонус",
} as const

/** Drawer на мобилке и планшете; Dialog — от `lg` (1024px). */
function useIsDrawerLayout() {
  const [drawer, setDrawer] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)")
    setDrawer(mq.matches)
    const handler = (e: MediaQueryListEvent) => setDrawer(e.matches)
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [])

  return drawer
}

export function WelcomeBonusModal() {
  const { lang } = useLanguage()
  const welcomeBonusPending = useAuthStore((s) => s.welcomeBonusPending)
  const setWelcomeBonusPending = useAuthStore((s) => s.setWelcomeBonusPending)
  const isDrawer = useIsDrawerLayout()

  const subtitle = lang === "RO" ? COPY.subtitleRo : COPY.subtitleRu
  const buttonLabel = lang === "RO" ? COPY.buttonRo : COPY.buttonRu

  const close = () => setWelcomeBonusPending(false)

  const inner = (
    <div className="flex flex-col">
      <h2 className="text-center text-2xl font-bold text-[var(--color-text)]">
        {COPY.title}
      </h2>
      <p className="mt-3 text-center text-base text-[var(--color-muted)]">
        {subtitle}
      </p>
      <button
        type="button"
        onClick={close}
        className="storefront-modal-cta mt-6 w-full cursor-pointer rounded-full py-3.5 text-[16px] font-bold transition-all hover:brightness-95 active:scale-[0.98]"
      >
        {buttonLabel}
      </button>
    </div>
  )

  if (isDrawer) {
    return (
      <Drawer.Root
        open={welcomeBonusPending}
        onOpenChange={(open) => {
          if (!open) close()
        }}
      >
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 z-50 bg-black/40" />
          <Drawer.Content
            className="fixed bottom-0 left-0 right-0 z-50 flex w-full max-h-[90vh] flex-col rounded-t-[24px] bg-[var(--color-bg)] px-5 pt-4 pb-[max(2.5rem,env(safe-area-inset-bottom))] text-[var(--color-text)] outline-none"
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            <div className="mx-auto mb-6 h-1 w-10 shrink-0 rounded-full bg-[var(--color-muted)]/30" />
            <Drawer.Title className="sr-only">{COPY.a11yTitle}</Drawer.Title>
            {inner}
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    )
  }

  return (
    <Dialog
      open={welcomeBonusPending}
      onOpenChange={(open) => {
        if (!open) close()
      }}
    >
      <DialogContent
        showCloseButton
        className="max-w-md gap-0 rounded-2xl border-0 bg-[var(--color-bg)] p-0 text-[var(--color-text)] sm:max-w-md"
      >
        <DialogTitle className="sr-only">{COPY.a11yTitle}</DialogTitle>
        <div className="px-5 pt-6 pb-10">{inner}</div>
      </DialogContent>
    </Dialog>
  )
}
