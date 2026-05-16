"use client"

import { PosFoodServiceLogo } from "@/components/pos/pos-food-service-logo"
import { KdsOrderCard } from "@/components/pos/kds/kds-order-card"
import {
  filterKdsOrderForWorkshops,
  KDS_ORDER_QUERY_SELECT,
  KDS_WORKSHOP_OPTIONS,
  KDS_WORKSHOPS_STORAGE_KEY,
  normalizeKdsOrderItemFromRaw,
  parseKdsWorkshopsFromStorage,
  POS_KDS_BRAND_STORAGE_KEY,
  isKdsScheduledOrder,
  scheduledSortKey,
  type KdsOrderItemRow,
  type KdsOrderRow,
  type KdsWorkshopId,
} from "@/components/pos/kds/types"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
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
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"

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
      className="font-mono text-[18px] font-bold tabular-nums tracking-tight text-white"
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
  const itemsRaw = Array.isArray(o.order_items) ? o.order_items : []
  const order_items = itemsRaw
    .map(normalizeKdsOrderItemFromRaw)
    .filter((x): x is KdsOrderItemRow => x != null)
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
    order_items,
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
  const [workshopSelection, setWorkshopSelection] = useState<string[]>([])
  const [kdsSettingsOpen, setKdsSettingsOpen] = useState(false)
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
      setWorkshopSelection(
        parseKdsWorkshopsFromStorage(
          typeof window !== "undefined"
            ? window.localStorage.getItem(KDS_WORKSHOPS_STORAGE_KEY)
            : null,
        ),
      )
    } catch {
      setWorkshopSelection([])
    }
  }, [])

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== KDS_WORKSHOPS_STORAGE_KEY) return
      setWorkshopSelection(parseKdsWorkshopsFromStorage(e.newValue))
    }
    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [])

  const toggleWorkshop = useCallback((id: KdsWorkshopId, checked: boolean) => {
    setWorkshopSelection((prev) => {
      const next = checked
        ? [...new Set([...prev, id])]
        : prev.filter((x) => x !== id)
      try {
        window.localStorage.setItem(
          KDS_WORKSHOPS_STORAGE_KEY,
          JSON.stringify(next),
        )
      } catch {
        /* ignore */
      }
      return next
    })
  }, [])

  const onKdsMenuOpenChange = useCallback((open: boolean) => {
    setKdsSettingsOpen(open)
    if (!open) return
    try {
      setWorkshopSelection(
        parseKdsWorkshopsFromStorage(
          typeof window !== "undefined"
            ? window.localStorage.getItem(KDS_WORKSHOPS_STORAGE_KEY)
            : null,
        ),
      )
    } catch {
      setWorkshopSelection([])
    }
  }, [])

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
      .select(KDS_ORDER_QUERY_SELECT)
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

  const visibleOrders = useMemo(() => {
    return orders
      .map((o) => filterKdsOrderForWorkshops(o, workshopSelection))
      .filter((o): o is KdsOrderRow => o != null)
  }, [orders, workshopSelection])

  return (
    <div
      className="fixed inset-0 z-[200] flex min-h-0 min-w-0 flex-col overflow-hidden bg-[#111]"
      onClick={unlockAudio}
      onTouchStart={unlockAudio}
    >
      <div className="shrink-0 px-4 pt-2 pb-0 sm:px-5 sm:pt-2.5">
        <nav
          className="flex items-center gap-2 py-1 sm:gap-3 sm:py-1.5"
          aria-label="KDS"
        >
          <div className="flex min-w-0 flex-1 items-center justify-start">
            <PosFoodServiceLogo className="h-6 w-auto brightness-0 invert sm:h-7" />
          </div>
          <div className="flex flex-none justify-center">
            <KdsClock />
          </div>
          <div className="flex min-w-0 flex-1 items-center justify-end">
            <Popover open={kdsSettingsOpen} onOpenChange={onKdsMenuOpenChange}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-9 shrink-0 rounded-lg text-white hover:bg-white/10 hover:text-white sm:size-10"
                  aria-label="Меню"
                >
                  <MoreVertical className="size-5 sm:size-6" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                align="end"
                sideOffset={8}
                className="z-[320] w-[min(320px,calc(100vw-2rem))] gap-0 border border-white/15 bg-[#242424] p-0 text-white shadow-lg ring-0"
              >
                <section
                  className="flex flex-col gap-3 p-4"
                  aria-labelledby="kds-menu-workshop-filter-heading"
                >
                  <div className="space-y-1">
                    <h2
                      id="kds-menu-workshop-filter-heading"
                      className="text-[15px] font-bold leading-tight"
                    >
                      Фильтр цеха
                    </h2>
                    <p className="text-[13px] leading-snug text-white/65">
                      Ничего не выбрано — все позиции. Иначе только выбранные
                      цеха; без цеха в категории — всегда показываются.
                    </p>
                  </div>
                  <div className="flex flex-col gap-3">
                    {KDS_WORKSHOP_OPTIONS.map((opt) => {
                      const cbId = `kds-workshop-${opt.id}`
                      const checked = workshopSelection.includes(opt.id)
                      return (
                        <div key={opt.id} className="flex items-center gap-3">
                          <Checkbox
                            id={cbId}
                            checked={checked}
                            onCheckedChange={(v) =>
                              toggleWorkshop(opt.id, v === true)
                            }
                            className="border-white/40 data-checked:border-[#ccff00] data-checked:bg-[#ccff00] data-checked:text-[#111]"
                          />
                          <Label
                            htmlFor={cbId}
                            className="cursor-pointer text-[15px] font-medium text-white"
                          >
                            {opt.label}
                          </Label>
                        </div>
                      )
                    })}
                  </div>
                </section>
              </PopoverContent>
            </Popover>
          </div>
        </nav>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2 pt-2 sm:pt-3">
        {!brandId ? (
          <p className="px-6 text-sm text-white/70">
            Ожидание UUID бренда… проверьте slug в cookie{" "}
            <span className="font-mono">pos-brand-slug</span> и доступ к таблице{" "}
            <span className="font-mono">brands</span>.
          </p>
        ) : null}

        <div className="flex min-h-0 flex-1 overflow-x-auto overflow-y-hidden px-4 pb-4 [-webkit-overflow-scrolling:touch] sm:px-5 sm:pb-5">
          <div className="flex h-full min-h-0 items-stretch gap-5">
            {visibleOrders.map((order) => (
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
