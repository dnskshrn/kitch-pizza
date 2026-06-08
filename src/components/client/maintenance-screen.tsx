"use client"

import {
  DEFAULT_LANG,
  LANG_STORAGE_KEY,
  htmlLang,
  normalizeLang,
  type Lang,
} from "@/lib/i18n/storefront"
import { useEffect, useState } from "react"

type MaintenanceScreenProps = {
  logoSrc: string
  brandName: string
}

type MaintenanceUiLang = "ru" | "ro"

const t = {
  ru: {
    heading: "Извините, мы закрыты сегодня по техническим причинам",
    sub: "",
  },
  ro: {
    heading: "Ne pare rău, astăzi suntem închiși din motive tehnice",
    sub: "",
  },
} as const

function uiLangFromStore(lang: Lang): MaintenanceUiLang {
  return lang === "RO" ? "ro" : "ru"
}

function readLangFromStorage(): MaintenanceUiLang {
  if (typeof window === "undefined") return uiLangFromStore(DEFAULT_LANG)
  try {
    const raw = localStorage.getItem(LANG_STORAGE_KEY)
    if (!raw) return uiLangFromStore(DEFAULT_LANG)
    const parsed = JSON.parse(raw) as unknown
    if (
      parsed &&
      typeof parsed === "object" &&
      "state" in parsed &&
      (parsed as { state: unknown }).state !== null &&
      typeof (parsed as { state: unknown }).state === "object"
    ) {
      const st = (parsed as { state: { lang?: unknown } }).state
      if ("lang" in st) {
        return uiLangFromStore(normalizeLang(st.lang))
      }
    }
  } catch {
    /* ignore corrupt storage */
  }
  return uiLangFromStore(DEFAULT_LANG)
}

function persistLang(ui: MaintenanceUiLang): void {
  const lang: Lang = ui === "ro" ? "RO" : "RU"
  localStorage.setItem(
    LANG_STORAGE_KEY,
    JSON.stringify({ state: { lang }, version: 0 }),
  )
  if (typeof document !== "undefined") {
    document.documentElement.lang = htmlLang(lang)
  }
}

export function MaintenanceScreen({ logoSrc, brandName }: MaintenanceScreenProps) {
  const [lang, setLang] = useState<MaintenanceUiLang>("ro")

  useEffect(() => {
    const next = readLangFromStorage()
    setLang(next)
    const storeLang: Lang = next === "ro" ? "RO" : "RU"
    document.documentElement.lang = htmlLang(storeLang)
  }, [])

  function selectLang(next: MaintenanceUiLang) {
    setLang(next)
    persistLang(next)
  }

  const copy = t[lang]

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-[#f2f2f2] font-[inherit]">
      <div
        className="absolute right-6 top-6 z-10 flex items-center gap-1 text-sm"
        role="group"
        aria-label={lang === "ro" ? "Limbă" : "Язык"}
      >
        <button
          type="button"
          onClick={() => selectLang("ru")}
          className={
            lang === "ru"
              ? "font-bold text-[#242424]"
              : "font-normal text-[#808080]"
          }
        >
          RU
        </button>
        <span className="select-none text-[#808080]" aria-hidden>
          |
        </span>
        <button
          type="button"
          onClick={() => selectLang("ro")}
          className={
            lang === "ro"
              ? "font-bold text-[#242424]"
              : "font-normal text-[#808080]"
          }
        >
          RO
        </button>
      </div>

      <div className="flex max-w-md flex-col items-center px-6 text-center">
        <img
          src={logoSrc}
          alt={brandName}
          width={200}
          height={80}
          className="h-auto max-h-20 w-auto max-w-[200px] object-contain"
        />
        <span
          className="mt-6 h-1 w-10 shrink-0 rounded-full bg-[#ccff00]"
          aria-hidden
        />
        <h1 className="mt-6 text-3xl font-bold leading-tight tracking-tight text-[#242424] sm:text-4xl">
          {copy.heading}
        </h1>
        {copy.sub ? (
          <p className="mt-4 text-base leading-relaxed text-[#808080] sm:text-lg">
            {copy.sub}
          </p>
        ) : null}
      </div>
    </div>
  )
}
