"use client"

import { ClientContainer } from "@/components/client/client-container"
import { useLanguage } from "@/lib/store/language-store"

export function TopNav() {
  const { lang, setLang, t } = useLanguage()

  const scheduleBlock = (
    <div className="text-muted-foreground flex flex-wrap items-center gap-x-2 text-[12px]">
      <span>{t.common.schedule}</span>
      <span className="whitespace-nowrap">11:00 – 23:00</span>
    </div>
  )

  const langBlock = (
    <div className="flex items-center gap-1 text-[12px]">
      <button
        type="button"
        onClick={() => setLang("RU")}
        className={
          lang === "RU"
            ? "cursor-pointer font-semibold underline transition-all duration-200"
            : "text-muted-foreground hover:text-foreground cursor-pointer transition-all duration-200"
        }
      >
        RU
      </button>
      <span className="text-muted-foreground">/</span>
      <button
        type="button"
        onClick={() => setLang("RO")}
        className={
          lang === "RO"
            ? "cursor-pointer font-semibold underline transition-all duration-200"
            : "text-muted-foreground hover:text-foreground cursor-pointer transition-all duration-200"
        }
      >
        RO
      </button>
    </div>
  )

  return (
    <header className="bg-white hidden md:block">
      <ClientContainer className="flex h-11 items-center justify-end text-[12px]">
        <div className="hidden w-full items-center justify-end gap-6 md:flex">
          {scheduleBlock}
          {langBlock}
        </div>
      </ClientContainer>
    </header>
  )
}
