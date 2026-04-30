"use client"

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { AuthButton } from "@/components/client/auth/auth-button"
import { ClientContainer } from "@/components/client/client-container"
import { useLanguage } from "@/lib/store/language-store"

export const NAV_LINKS = [
  { href: "#", labelKey: "work" },
  { href: "#", labelKey: "about" },
  { href: "#", labelKey: "contacts" },
  { href: "#", labelKey: "cashback" },
  { href: "#", labelKey: "review" },
] as const

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

  const linkClass =
    "text-foreground cursor-pointer transition-all duration-200 hover:text-foreground/80"

  return (
    <header className="bg-white hidden md:block">
      <ClientContainer className="flex h-11 items-center justify-end text-[12px] md:justify-between">
        <nav className="hidden min-w-0 flex-1 flex-wrap items-center gap-x-5 md:flex">
            {NAV_LINKS.map((link) => (
              <a key={link.labelKey} href={link.href} className={linkClass}>
                {t.nav[link.labelKey]}
              </a>
            ))}
            <span className="text-muted-foreground" aria-hidden>
              ·
            </span>
            <a
              href="#"
              className="cursor-pointer rounded-full bg-[#ECFFA1] px-3 py-1 font-semibold text-[#5F7600] transition-all duration-200 hover:bg-[#dff090] active:scale-[0.97]"
            >
              {t.common.promotions}
            </a>
        </nav>

        <div className="hidden flex-1 items-center justify-end gap-6 md:flex">
          {/* <AuthButton /> */}
          {scheduleBlock}
          {langBlock}
        </div>
      </ClientContainer>
    </header>
  )
}
