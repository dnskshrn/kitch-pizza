"use client"

import { AuthButton } from "@/components/client/auth/auth-button"
import { ClientContainer } from "@/components/client/client-container"
import { useEffect, useState } from "react"

export const NAV_LINKS = [
  { href: "#", label: "Работа в Kitch!" },
  { href: "#", label: "О нас" },
  { href: "#", label: "Контакты" },
  { href: "#", label: "Кэшбек и бонусы" },
  { href: "#", label: "Оставить отзыв" },
] as const

const LANG_KEY = "lang"

type Lang = "RU" | "RO"

function readStoredLang(): Lang {
  if (typeof window === "undefined") return "RU"
  const v = window.localStorage.getItem(LANG_KEY)
  return v === "RO" ? "RO" : "RU"
}

export function TopNav() {
  const [lang, setLang] = useState<Lang>("RU")

  useEffect(() => {
    setLang(readStoredLang())
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    window.localStorage.setItem(LANG_KEY, lang)
  }, [lang])

  const scheduleBlock = (
    <div className="text-muted-foreground flex flex-wrap items-center gap-x-2 text-[12px]">
      <span>График работы</span>
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

  const linkClass =
    "text-foreground cursor-pointer transition-all duration-200 hover:text-foreground/80"

  return (
    <header className="bg-white hidden md:block">
      <ClientContainer className="flex h-11 items-center justify-end text-[12px] md:justify-between">
        <nav className="hidden min-w-0 flex-1 flex-wrap items-center gap-x-5 md:flex">
            {NAV_LINKS.map((link) => (
              <a key={link.label} href={link.href} className={linkClass}>
                {link.label}
              </a>
            ))}
            <span className="text-muted-foreground" aria-hidden>
              ·
            </span>
            <a
              href="#"
              className="cursor-pointer rounded-full bg-[#ECFFA1] px-3 py-1 font-semibold text-[#5F7600] transition-all duration-200 hover:bg-[#dff090] active:scale-[0.97]"
            >
              Акции
            </a>
        </nav>

        <div className="hidden flex-1 items-center justify-end gap-6 md:flex">
          <AuthButton />
          {scheduleBlock}
          {langBlock}
        </div>
      </ClientContainer>
    </header>
  )
}
