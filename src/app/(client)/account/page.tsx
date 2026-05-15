"use client"

import { Avatar } from "@/components/client/avatar"
import { ClientContainer } from "@/components/client/client-container"
import { Button } from "@/components/ui/button"
import type { Lang } from "@/lib/i18n/storefront"
import { formatMoney } from "@/lib/i18n/storefront"
import { useLanguage } from "@/lib/store/language-store"
import { useAuthStore } from "@/lib/store/auth-store"
import { cn } from "@/lib/utils"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useState } from "react"

type MeProfile = {
  id?: string
  profileId?: string
  phone?: string
  name?: string | null
}

type AccountOrder = {
  id: string
  order_number: number
  created_at: string
  total: number
  status: string
  brand_slug: string | null
}

const STATUS_LABEL_RO: Record<string, string> = {
  draft: "Ciornă",
  new: "Nou",
  confirmed: "Confirmat",
  cooking: "Se prepară",
  ready: "Gata",
  delivery: "În livrare",
  done: "Livrat",
  cancelled: "Anulat",
  rejected: "Respins",
}

const STATUS_LABEL_RU: Record<string, string> = {
  draft: "Черновик",
  new: "Новый",
  confirmed: "Принят",
  cooking: "Готовится",
  ready: "Готов",
  delivery: "Доставляется",
  done: "Доставлен",
  cancelled: "Отменён",
  rejected: "Отклонён",
}

function orderStatusLabel(status: string, lang: Lang): string {
  const map = lang === "RO" ? STATUS_LABEL_RO : STATUS_LABEL_RU
  return map[status] ?? status
}

function formatOrderDate(iso: string, lang: Lang): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const locale = lang === "RO" ? "ro-MD" : "ru-RU"
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d)
}

function BrandBadge({ slug }: { slug: string | null }) {
  const label = slug ?? "—"
  const losos = slug === "losos"
  const spot = slug === "the-spot"
  return (
    <span
      className={cn(
        "inline-flex shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide",
        losos && "bg-[#ffe8dc] text-[#242424]",
        spot && "bg-[#242424] text-[#ccff00]",
        !losos && !spot && "bg-[#f2f2f2] text-[#242424]",
      )}
    >
      {label}
    </span>
  )
}

export default function AccountPage() {
  const router = useRouter()
  const { lang, t } = useLanguage()
  const fetchMe = useAuthStore((s) => s.fetchMe)

  const [allowed, setAllowed] = useState(false)
  const [profile, setProfile] = useState<MeProfile | null>(null)

  const [balance, setBalance] = useState<number | null>(null)
  const [orders, setOrders] = useState<AccountOrder[] | null>(null)
  const [ordersError, setOrdersError] = useState<string | null>(null)

  const [nameDraft, setNameDraft] = useState("")
  const [savingProfile, setSavingProfile] = useState(false)

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then((r) => r.json())
      .then((data: { profile: MeProfile | null }) => {
        const p = data.profile
        const id =
          p && typeof p.id === "string"
            ? p.id
            : p && typeof p.profileId === "string"
              ? p.profileId
              : null
        if (!p || !id) {
          router.replace("/")
          return
        }
        setProfile(p)
        setNameDraft(
          typeof p.name === "string" && p.name.trim() ? p.name.trim() : "",
        )
        setAllowed(true)
      })
      .catch(() => {
        router.replace("/")
      })
  }, [router])

  const profileId =
    profile && typeof profile.id === "string"
      ? profile.id
      : profile && typeof profile.profileId === "string"
        ? profile.profileId
        : null

  useEffect(() => {
    if (!allowed || !profileId) return

    fetch(`/api/bonus/balance?profileId=${encodeURIComponent(profileId)}`, {
      credentials: "include",
    })
      .then((r) => r.json())
      .then((d: { balance?: unknown }) => {
        const b = typeof d.balance === "number" ? d.balance : Number(d.balance)
        setBalance(Number.isFinite(b) ? b : 0)
      })
      .catch(() => setBalance(0))

    fetch("/api/account/orders", { credentials: "include" })
      .then(async (r) => {
        if (r.status === 401) {
          router.replace("/")
          return
        }
        const j: unknown = await r.json()
        if (!r.ok) {
          const err =
            j &&
            typeof j === "object" &&
            "error" in j &&
            typeof (j as { error: unknown }).error === "string"
              ? (j as { error: string }).error
              : "Orders fetch failed"
          setOrdersError(err)
          setOrders([])
          return
        }
        setOrdersError(null)
        const ordersRaw =
          j &&
          typeof j === "object" &&
          "orders" in j &&
          Array.isArray((j as { orders: unknown }).orders)
            ? (j as { orders: AccountOrder[] }).orders
            : []
        setOrders(ordersRaw)
      })
      .catch(() => {
        setOrdersError("Network error")
        setOrders([])
      })
  }, [allowed, profileId, router])

  const saveProfile = useCallback(async () => {
    setSavingProfile(true)
    try {
      const res = await fetch("/api/account/profile", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nameDraft }),
      })
      if (res.status === 401) {
        router.replace("/")
        return
      }
      if (!res.ok) return
      await fetchMe()
      const me = await fetch("/api/auth/me", { credentials: "include" }).then(
        (r) => r.json(),
      )
      const p = me.profile as MeProfile | null
      if (p) setProfile(p)
    } finally {
      setSavingProfile(false)
    }
  }, [fetchMe, nameDraft, router])

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
    })
    useAuthStore.getState().clearProfile()
    router.replace("/")
    router.refresh()
  }, [router])

  if (!allowed || !profile || !profileId) {
    return null
  }

  const ordersTitle = lang === "RO" ? "Comenzi recente" : "История заказов"
  const emptyOrders =
    lang === "RO" ? "Nu aveți încă comenzi." : "Пока нет заказов."
  const profileTitle = lang === "RO" ? "Profil" : "Профиль"
  const nameLabel = lang === "RO" ? "Nume" : "Имя"
  const saveLabel = lang === "RO" ? "Salvează" : "Сохранить"
  const phoneLabel = lang === "RO" ? "Telefon" : "Телефон"
  const logoutLabel = lang === "RO" ? "Ieșire" : "Выйти"
  const pageTitle = lang === "RO" ? "Contul meu" : "Личный кабинет"

  const bal = balance ?? null

  return (
    <div className="min-h-[60vh] pb-16 pt-8 md:pb-24 md:pt-10">
      <ClientContainer className="max-w-2xl">
        <h1 className="text-[28px] font-bold leading-tight text-[#242424]">
          {pageTitle}
        </h1>

        <div className="mt-8 flex justify-center">
          <Avatar profileId={profileId} size={64} />
        </div>

        <section className="mt-10 border-t border-[#eee] pt-10">
          <p
            className={cn(
              "text-[56px] font-bold tabular-nums leading-none tracking-tight text-[#242424]",
              bal === 0 && "text-[#808080]",
            )}
          >
            {bal !== null ? bal : "—"}
          </p>
          <p className="mt-2 text-[15px] font-normal text-[#808080]">
            {t.bonus.balance}
          </p>
        </section>

        <section className="mt-12 border-t border-[#eee] pt-10">
          <h2 className="text-[18px] font-bold text-[#242424]">{ordersTitle}</h2>
          {orders === null ? null : ordersError ? (
            <p className="mt-4 text-[14px] text-red-600" role="alert">
              {ordersError}
            </p>
          ) : orders.length === 0 ? (
            <p className="mt-4 text-[14px] text-[#808080]">{emptyOrders}</p>
          ) : (
            <ul className="mt-4 divide-y divide-[#f2f2f2]">
              {orders.map((o) => (
                <li
                  key={o.id}
                  className="flex flex-col gap-3 py-5 md:flex-row md:items-center md:justify-between"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <BrandBadge slug={o.brand_slug} />
                    <span className="text-[15px] font-bold text-[#242424]">
                      #{o.order_number}
                    </span>
                    <span className="text-[13px] text-[#808080]">
                      {formatOrderDate(o.created_at, lang)}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-[15px] font-semibold tabular-nums text-[#242424]">
                      {formatMoney(o.total, lang)}
                    </span>
                    <span className="rounded-full bg-[#f2f2f2] px-3 py-1 text-[12px] font-medium text-[#242424]">
                      {orderStatusLabel(o.status, lang)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-12 border-t border-[#eee] pt-10">
          <h2 className="text-[18px] font-bold text-[#242424]">{profileTitle}</h2>
          <div className="mt-5 flex flex-col gap-4">
            <div>
              <label
                htmlFor="account-name"
                className="mb-2 block text-[13px] font-medium text-[#808080]"
              >
                {nameLabel}
              </label>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <input
                  id="account-name"
                  type="text"
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  className="storefront-input min-h-[48px] flex-1 rounded-[12px] border border-transparent px-4 py-3 text-[16px] text-[#242424] outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                  autoComplete="name"
                />
                <Button
                  type="button"
                  variant="outline"
                  className="h-12 shrink-0 rounded-full border-[#242424] px-6 font-bold text-[#242424] hover:bg-[#f2f2f2]"
                  disabled={savingProfile}
                  onClick={() => void saveProfile()}
                >
                  {saveLabel}
                </Button>
              </div>
            </div>
            <div>
              <span className="mb-2 block text-[13px] font-medium text-[#808080]">
                {phoneLabel}
              </span>
              <p className="text-[16px] font-medium text-[#242424]">
                {profile.phone ?? "—"}
              </p>
            </div>
            <div>
              <Button
                type="button"
                variant="outline"
                className="h-12 rounded-full border-[#242424] px-6 font-bold text-[#242424] hover:bg-[#f2f2f2]"
                onClick={() => void logout()}
              >
                {logoutLabel}
              </Button>
            </div>
          </div>
        </section>
      </ClientContainer>
    </div>
  )
}
