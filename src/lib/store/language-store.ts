"use client"

import {
  DEFAULT_LANG,
  LANG_STORAGE_KEY,
  getMessages,
  htmlLang,
  normalizeLang,
  type Lang,
} from "@/lib/i18n/storefront"
import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

type LanguageState = {
  lang: Lang
  setLang: (lang: Lang) => void
}

function syncHtmlLang(lang: Lang) {
  if (typeof document === "undefined") return
  document.documentElement.lang = htmlLang(lang)
}

export const useLanguageStore = create<LanguageState>()(
  persist(
    (set) => ({
      lang: DEFAULT_LANG,
      setLang: (lang) => {
        const nextLang = normalizeLang(lang)
        syncHtmlLang(nextLang)
        set({ lang: nextLang })
      },
    }),
    {
      name: LANG_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ lang: state.lang }),
      onRehydrateStorage: () => (state) => {
        const lang = normalizeLang(state?.lang)
        syncHtmlLang(lang)
        if (state && state.lang !== lang) {
          state.setLang(lang)
        }
      },
    },
  ),
)

export function useLanguage() {
  const lang = useLanguageStore((state) => state.lang)
  const setLang = useLanguageStore((state) => state.setLang)
  return { lang, setLang, t: getMessages(lang) }
}
