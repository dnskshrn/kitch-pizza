"use client"

import { PosFoodServiceLogo } from "@/components/pos/pos-food-service-logo"
import { KdsOrderCard } from "@/components/pos/kds/kds-order-card"
import {
  POS_KDS_BRAND_STORAGE_KEY,
  isKdsScheduledOrder,
  scheduledSortKey,
  type KdsOrderRow,
} from "@/components/pos/kds/types"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { brands as staticBrands, getBrandBySlug, normalizePosBrandSlug } from "@/brands/index"
import { fetchKdsOrderByIdPos } from "@/lib/actions/pos/fetch-kds-orders"
import {
  readPosBrandSlugFromCookie,
  writePosBrandSlugCookie,
} from "@/lib/pos/pos-brand-slug-cookie"
import { updateOrderStatusKds } from "@/lib/actions/pos/update-order-status-kds"
import { createClient } from "@/lib/supabase/client"
import { Toaster } from "@/components/ui/sonner"
import { MoreVertical } from "lucide-react"
import { toast } from "sonner"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

function sortKdsOrders(rows: KdsOrderRow[]): KdsOrderRow[] {
  const asap = rows
    .filter((o) => !isKdsScheduledOrder(o.scheduled_time))
    .sort(
      (a, b) =>
        new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime(),
    )
  const sch = rows
    .filter((o) => isKdsScheduledOrder(o.scheduled_time))
    .sort((a, b) => {
      const ta = a.scheduled_time ?? ""
      const tb = b.scheduled_time ?? ""
      return scheduledSortKey(ta) - scheduledSortKey(tb)
    })
  return [...asap, ...sch]
}

function KdsClock() {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [])

  const txt = now.toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })

  return (
    <time
      dateTime={now.toISOString()}
      className="font-mono text-[28px] font-bold tabular-nums tracking-tight text-white sm:text-[32px]"
    >
      {txt}
    </time>
  )
}

function brandSlugFromEmbed(brandsRaw: unknown): string | null {
  if (brandsRaw == null) return null
  if (Array.isArray(brandsRaw)) {
    const first = brandsRaw[0]
    if (
      first &&
      typeof first === "object" &&
      typeof (first as { slug?: unknown }).slug === "string"
    ) {
      return (first as { slug: string }).slug
    }
    return null
  }
  if (
    typeof brandsRaw === "object" &&
    typeof (brandsRaw as { slug?: unknown }).slug === "string"
  ) {
    return (brandsRaw as { slug: string }).slug
  }
  return null
}

function normalizeOrderRow(raw: unknown): KdsOrderRow | null {
  if (!raw || typeof raw !== "object") return null
  const o = raw as Record<string, unknown>
  const slug = brandSlugFromEmbed(o.brands)
  const items = Array.isArray(o.order_items) ? o.order_items : []
  return {
    id: String(o.id),
    order_number: Number(o.order_number),
    brand_id: String(o.brand_id),
    status: String(o.status),
    scheduled_time:
      o.scheduled_time == null ? null : String(o.scheduled_time),
    updated_at: String(o.updated_at),
    cooking_started_at:
      o.cooking_started_at == null || o.cooking_started_at === ""
        ? null
        : String(o.cooking_started_at),
    brands: slug ? { slug } : null,
    order_items: items as KdsOrderRow["order_items"],
  }
}

type KdsScreenProps = {
  initialBrandSlug?: string
}

export function KdsScreen({ initialBrandSlug }: KdsScreenProps) {
  const [brandSlug, setBrandSlug] = useState<string>(() =>
    getBrandBySlug(initialBrandSlug ?? "").slug,
  )
  const [hydratedBrand, setHydratedBrand] = useState(false)
  const [brandId, setBrandId] = useState<string | null>(null)

  const [orders, setOrders] = useState<KdsOrderRow[]>([])
  const [undoExpiresByOrderId, setUndoExpiresByOrderId] = useState<
    Record<string, number>
  >({})
  const [removingIds, setRemovingIds] = useState<Set<string>>(() => new Set())

  const audioCtxRef = useRef<AudioContext | null>(null)
  const knownOrderIdsRef = useRef<Set<string>>(new Set())

  const activeBrandConfig = useMemo(
    () => getBrandBySlug(brandSlug),
    [brandSlug],
  )

  useEffect(() => {
    try {
      const fromCookie = readPosBrandSlugFromCookie()?.trim()
      const fromUrl = initialBrandSlug?.trim()
      const stored =
        typeof window !== "undefined"
          ? window.localStorage.getItem(POS_KDS_BRAND_STORAGE_KEY)
          : null
      const candidate =
        fromCookie ||
        fromUrl ||
        (stored && stored.trim()) ||
        staticBrands[0]?.slug ||
        ""
      setBrandSlug(getBrandBySlug(candidate).slug)
    } finally {
      setHydratedBrand(true)
    }
  }, [initialBrandSlug])

  useEffect(() => {
    if (!hydratedBrand || !brandSlug.trim()) return
    try {
      window.localStorage.setItem(POS_KDS_BRAND_STORAGE_KEY, brandSlug)
      writePosBrandSlugCookie(brandSlug)
    } catch {
      /* ignore */
    }
  }, [brandSlug, hydratedBrand])

  useEffect(() => {
    if (!hydratedBrand || !brandSlug.trim()) return

    setBrandId(null)

    let cancelled = false
    const supabase = createClient()
    const cfgSlug = getBrandBySlug(brandSlug).slug
    const attempts = Array.from(
      new Set([cfgSlug, brandSlug.trim()].filter(Boolean)),
    )

    void (async () => {
      for (const slugAttempt of attempts) {
        const { data, error } = await supabase
          .from("brands")
          .select("id")
          .eq("slug", slugAttempt)
          .maybeSingle()

        if (cancelled) return
        if (
          !error &&
          data &&
          typeof (data as { id?: unknown }).id === "string"
        ) {
          setBrandId((data as { id: string }).id)
          return
        }
      }
      if (!cancelled) setBrandId(null)
    })()

    return () => {
      cancelled = true
    }
  }, [brandSlug, hydratedBrand])

  const fetchOrderFull = useCallback(async (id: string) => {
    const res = await fetchKdsOrderByIdPos(id)
    if (!res.success) {
      console.error("[kds] fetch order", res.error)
      return null
    }
    return normalizeOrderRow(res.order)
  }, [])

  const scheduleRemoveOrder = useCallback((id: string) => {
    setRemovingIds((prev) => new Set(prev).add(id))
    window.setTimeout(() => {
      setOrders((prev) => prev.filter((o) => o.id !== id))
      knownOrderIdsRef.current.delete(id)
      setRemovingIds((prev) => {
        const n = new Set(prev)
        n.delete(id)
        return n
      })
    }, 380)
  }, [])

  const unlockAudio = useCallback(() => {
    if (!audioCtxRef.current) {
      const win = window as typeof window & {
        webkitAudioContext?: typeof AudioContext
      }
      const Ctor = window.AudioContext ?? win.webkitAudioContext
      if (Ctor) {
        audioCtxRef.current = new Ctor()
      }
    }
    const ctx = audioCtxRef.current
    if (ctx?.state === "suspended") {
      void ctx.resume()
    }
  }, [])

  const playNewOrderBeep = useCallback(() => {
    const ctx = audioCtxRef.current
    if (!ctx || ctx.state !== 'running') return
    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = 'sine'
    osc.frequency.setValueAtTime(880, now)
    osc.frequency.setValueAtTime(1100, now + 0.12)
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(0.35, now + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45)
    osc.start(now)
    osc.stop(now + 0.45)
  }, [])

  const reloadCookingOrders = useCallback(async () => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("orders")
      .select(
        "id, order_number, brand_id, status, scheduled_time, updated_at, cooking_started_at, brands(slug), order_items(id, item_name, quantity, price, size, toppings)",
      )
      .eq("status", "cooking")
      .order("updated_at", { ascending: true })
    if (error) {
      console.error("[kds] load orders", error.message)
      return
    }
    const rows = (data ?? [])
      .map(normalizeOrderRow)
      .filter((x): x is KdsOrderRow => x != null)
    setOrders(sortKdsOrders(rows))
    knownOrderIdsRef.current = new Set(rows.map((r) => r.id))
  }, [])

  useEffect(() => {
    void reloadCookingOrders()
  }, [reloadCookingOrders])

  useEffect(() => {
    const supabase = createClient()

    const upsertCookingOrder = (id: string) => {
      void (async () => {
        const full = await fetchOrderFull(id)
        if (!full || full.status !== "cooking") return
        setOrders((prev) => {
          const map = new Map(prev.map((o) => [o.id, o]))
          map.set(full.id, full)
          if (!knownOrderIdsRef.current.has(full.id)) {
            knownOrderIdsRef.current.add(full.id)
            playNewOrderBeep()
          }
          return sortKdsOrders([...map.values()])
        })
      })()
    }

    const channel = supabase
      .channel("kds-orders")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
        },
        (payload) => {
          const p = payload as {
            eventType: string
            new?: Record<string, unknown>
            old?: Record<string, unknown>
          }

          if (p.eventType === "DELETE") {
            const oldId = p.old?.id
            const oid =
              typeof oldId === "string"
                ? oldId
                : oldId != null
                  ? String(oldId)
                  : ""
            if (oid) scheduleRemoveOrder(oid)
            return
          }

          const row = p.new ?? {}
          const idRaw = row.id
          const id =
            typeof idRaw === "string" ? idRaw : idRaw != null ? String(idRaw) : ""
          if (!id) return

          const status = String(row.status ?? "")
          const oldRow = p.old
          const oldStatus =
            oldRow && "status" in oldRow ? String(oldRow.status ?? "") : ""

          const leftCooking =
            oldStatus === "cooking" && status !== "cooking"

          if (leftCooking) {
            scheduleRemoveOrder(id)
            return
          }

          if (status !== "cooking") {
            setOrders((prev) => prev.filter((o) => o.id !== id))
            return
          }

          if (
            p.eventType === "INSERT" ||
            (p.eventType === "UPDATE" && status === "cooking")
          ) {
            upsertCookingOrder(id)
          }
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [fetchOrderFull, scheduleRemoveOrder, playNewOrderBeep])

  const handleMarkReady = useCallback((orderId: string) => {
    setUndoExpiresByOrderId((prev) => ({
      ...prev,
      [orderId]: Date.now() + 5000,
    }))
  }, [])

  const handleCancelReady = useCallback((orderId: string) => {
    setUndoExpiresByOrderId((prev) => {
      const n = { ...prev }
      delete n[orderId]
      return n
    })
  }, [])

  const commitGuardRef = useRef<Set<string>>(new Set())

  const handleCommitReady = useCallback(
    async (orderId: string) => {
      setUndoExpiresByOrderId((prev) => {
        const n = { ...prev }
        delete n[orderId]
        return n
      })

      if (commitGuardRef.current.has(orderId)) return
      commitGuardRef.current.add(orderId)

      try {
        const res = await updateOrderStatusKds(orderId)
        if (!res.success) {
          toast.error(res.error)
          return
        }
        scheduleRemoveOrder(orderId)
      } finally {
        commitGuardRef.current.delete(orderId)
      }
    },
    [scheduleRemoveOrder],
  )

  const slugForCard = useCallback((order: KdsOrderRow) => {
    const raw = order.brands?.slug
    return normalizePosBrandSlug(raw ?? activeBrandConfig.slug)
  }, [activeBrandConfig.slug])

  return (
    <div
      className="fixed inset-0 z-[200] flex min-h-0 min-w-0 flex-col overflow-hidden bg-[#111]"
      onClick={unlockAudio}
      onTouchStart={unlockAudio}
    >
      <div className="shrink-0 p-5 pb-0">
        <nav
          className="flex items-center gap-4 rounded-[16px] bg-[#242424] px-5 py-4"
          aria-label="KDS"
        >
          <div className="flex min-w-0 flex-1 items-center justify-start">
            <PosFoodServiceLogo className="h-8 brightness-0 invert sm:h-9" />
          </div>
          <div className="flex flex-none justify-center">
            <KdsClock />
          </div>
          <div className="flex min-w-0 flex-1 items-center justify-end gap-3">
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="truncate text-right text-[18px] font-bold text-white underline-offset-4 hover:underline"
                >
                  {activeBrandConfig.name}
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-56 p-2">
                <p className="mb-2 px-2 text-xs font-medium text-muted-foreground">
                  Бренд экрана кухни
                </p>
                <div className="flex flex-col gap-1">
                  {staticBrands.map((b) => (
                    <Button
                      key={b.slug}
                      type="button"
                      variant={brandSlug === b.slug ? "secondary" : "ghost"}
                      className="justify-start font-semibold"
                      size="sm"
                      onClick={() => setBrandSlug(b.slug)}
                    >
                      {b.name}
                    </Button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-10 shrink-0 rounded-lg text-white hover:bg-white/10 hover:text-white"
              aria-label="Меню"
            >
              <MoreVertical className="size-6" />
            </Button>
          </div>
        </nav>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 pt-5">
        {!brandId ? (
          <p className="px-6 text-sm text-white/70">
            Ожидание UUID бренда… проверьте slug в cookie{" "}
            <span className="font-mono">pos-brand-slug</span> и доступ к таблице{" "}
            <span className="font-mono">brands</span>.
          </p>
        ) : null}

        <div className="flex min-h-0 flex-1 overflow-x-auto overflow-y-hidden px-5 pb-5 [-webkit-overflow-scrolling:touch]">
          <div className="flex h-full min-h-0 items-stretch gap-5">
            {orders.map((order) => (
              <KdsOrderCard
                key={order.id}
                order={order}
                brandSlug={slugForCard(order)}
                undoExpiresAt={undoExpiresByOrderId[order.id] ?? null}
                removing={removingIds.has(order.id)}
                onMarkReady={handleMarkReady}
                onCommitReady={handleCommitReady}
                onCancelReady={handleCancelReady}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="pointer-events-none fixed inset-0 z-[300] hidden items-center justify-center bg-black/85 p-8 text-center text-[18px] font-bold text-white portrait:flex">
        Поверните устройство в альбомную ориентацию
      </div>

      <Toaster theme="dark" position="top-center" />
    </div>
  )
}
