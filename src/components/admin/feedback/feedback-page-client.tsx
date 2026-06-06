"use client"

import { format, parseISO } from "date-fns"
import { Star } from "lucide-react"
import { useEffect, useMemo, useState, type ReactNode } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { PeriodFilter } from "@/components/admin/finances/period-filter"
import type {
  FeedbackPageData,
  FeedbackRow,
} from "@/lib/actions/admin/feedback"
import { isNegativeFeedback } from "@/lib/feedback"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import type { CustomerGift } from "@/types/database"

type MenuItemOption = { id: string; name_ru: string }

type OrderItem = {
  name: string
  quantity: number
  price_bani: number
  size: string | null
  is_gift: boolean
  toppings: unknown
}
type OrderDetails = {
  order_number: number
  created_at: string
  done_at: string | null
  total_bani: number
  subtotal_bani: number
  discount_bani: number
  delivery_fee_bani: number
  promo_code: string | null
  payment_method: string
  delivery_mode: string
  bonuses_redeemed: number
  delivery_address: string | null
  items: OrderItem[]
}

type SentimentFilter = "all" | "negative" | "positive"
type ResolutionFilter = "all" | "pending" | "resolved"

type FeedbackPageClientProps = {
  initialData: FeedbackPageData
  dateFrom: string
  dateTo: string
  brandFilter: string
}

const BRAND_TABS = [
  { slug: "", label: "Все" },
  { slug: "losos", label: "LOSOS" },
  { slug: "the-spot", label: "The Spot" },
  { slug: "kitch-pizza", label: "Kitch! Pizza" },
] as const

function formatSubmittedAt(iso: string): string {
  return format(parseISO(iso), "dd.MM.yy HH:mm")
}

const GSM_7_BASIC_CHARS =
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà"

const GSM_7_EXTENDED_CHARS = "\\^{}[~]|€"

const GSM_7_BASIC = new Set(GSM_7_BASIC_CHARS.split(""))
const GSM_7_EXTENDED = new Set(GSM_7_EXTENDED_CHARS.split(""))

function gsm7SeptetLength(text: string): number | null {
  let len = 0
  for (const char of text) {
    if (GSM_7_BASIC.has(char)) len += 1
    else if (GSM_7_EXTENDED.has(char)) len += 2
    else return null
  }
  return len
}

function smsSegmentCount(
  length: number,
  singleMax: number,
  multiMax: number,
): number {
  if (length <= 0) return 0
  if (length <= singleMax) return 1
  return Math.ceil(length / multiMax)
}

function calcSmsCost(text: string): {
  chars: number
  segments: number
  costMdl: number
} {
  const chars = text.length
  if (chars === 0) {
    return { chars: 0, segments: 0, costMdl: 0 }
  }

  const gsmLen = gsm7SeptetLength(text)
  const segments =
    gsmLen === null
      ? smsSegmentCount(chars, 70, 67)
      : smsSegmentCount(gsmLen, 160, 153)

  return { chars, segments, costMdl: segments * 0.3 }
}

function truncateComment(text: string | null, max = 60): string {
  if (!text?.trim()) return "—"
  const t = text.trim()
  return t.length <= max ? t : `${t.slice(0, max)}…`
}

function ratingDotClass(rating: number | null): string {
  if (rating == null) return "bg-muted"
  return rating <= 4 ? "bg-red-500" : "bg-green-500"
}

function RatingCell({ rating }: { rating: number | null }) {
  if (rating == null) return <span className="text-muted-foreground">—</span>
  return (
    <span className="inline-flex items-center gap-1.5 font-medium">
      <span
        className={cn("size-2 rounded-full", ratingDotClass(rating))}
        aria-hidden
      />
      {rating}/5
    </span>
  )
}

function StarDisplay({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className="size-5"
          style={{
            color: star <= rating ? "#f59e0b" : "#d1d5db",
            fill: star <= rating ? "#f59e0b" : "transparent",
          }}
        />
      ))}
    </div>
  )
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <Button
      type="button"
      variant={active ? "default" : "outline"}
      size="sm"
      className={cn(
        active && "bg-[#ccff00] text-[#242424] hover:bg-[#ccff00]/90",
      )}
      onClick={onClick}
    >
      {children}
    </Button>
  )
}

function MetricCard({
  label,
  value,
  prominent,
}: {
  label: string
  value: ReactNode
  prominent?: boolean
}) {
  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1 font-semibold tabular-nums",
          prominent ? "text-3xl" : "text-xl",
        )}
      >
        {value}
      </p>
    </div>
  )
}

function FeedbackDetailSheet({
  row,
  open,
  onOpenChange,
  onResolved,
}: {
  row: FeedbackRow | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onResolved: (id: string, note: string, by: string, at: string) => void
}) {
  const [resolutionNote, setResolutionNote] = useState("")
  const [resolvedBy, setResolvedBy] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [orderDetails, setOrderDetails] = useState<OrderDetails | null>(null)
  const [orderLoading, setOrderLoading] = useState(false)
  const [smsText, setSmsText] = useState("")
  const [smsSending, setSmsSending] = useState(false)
  const [smsResult, setSmsResult] = useState<"ok" | "error" | null>(null)
  const [giftMenuItemId, setGiftMenuItemId] = useState("")
  const [giftQuantity, setGiftQuantity] = useState(1)
  const [giftReason, setGiftReason] = useState("")
  const [giftSaving, setGiftSaving] = useState(false)
  const [giftSaved, setGiftSaved] = useState(false)
  const [menuItems, setMenuItems] = useState<MenuItemOption[]>([])
  const [menuItemsLoading, setMenuItemsLoading] = useState(false)
  const [pendingGifts, setPendingGifts] = useState<CustomerGift[]>([])

  async function loadPendingGifts(profileId: string, brandId: string) {
    try {
      const res = await fetch(
        `/api/admin/gifts?profile_id=${encodeURIComponent(profileId)}&brand_id=${encodeURIComponent(brandId)}&status=pending`,
      )
      if (!res.ok) {
        setPendingGifts([])
        return
      }
      const data = (await res.json()) as CustomerGift[]
      setPendingGifts(Array.isArray(data) ? data : [])
    } catch {
      setPendingGifts([])
    }
  }

  useEffect(() => {
    if (!open || !row?.brand_id) {
      setMenuItems([])
      return
    }
    setMenuItemsLoading(true)
    fetch(`/api/admin/menu-items?brand_id=${encodeURIComponent(row.brand_id)}`)
      .then((r) => r.json())
      .then((data) => {
        setMenuItems(Array.isArray(data) ? (data as MenuItemOption[]) : [])
      })
      .catch(() => setMenuItems([]))
      .finally(() => setMenuItemsLoading(false))
  }, [open, row?.brand_id])

  useEffect(() => {
    if (!open) {
      setOrderDetails(null)
      setPendingGifts([])
      return
    }

    if (row?.order_id) {
      setOrderLoading(true)
      fetch(`/api/admin/feedback/${row.id}/order-details`)
        .then((r) => r.json())
        .then((data) => setOrderDetails(data))
        .finally(() => setOrderLoading(false))
    } else {
      setOrderDetails(null)
    }

    if (row?.profile_id && row?.brand_id) {
      void loadPendingGifts(row.profile_id, row.brand_id)
    } else {
      setPendingGifts([])
    }
  }, [row?.id, row?.order_id, row?.profile_id, row?.brand_id, open])

  const smsCost = useMemo(() => calcSmsCost(smsText), [smsText])

  const isResolved = row?.resolved_at != null
  const isNegative =
    row != null &&
    isNegativeFeedback(row.food_rating, row.service_rating)

  async function handleResolve() {
    if (!row) return
    const note = resolutionNote.trim()
    const by = resolvedBy.trim()
    if (!note || !by) {
      setError("Заполните резолюцию и имя")
      return
    }

    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/feedback/${row.id}/resolve`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resolution_note: note,
          resolved_by: by,
        }),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string
        } | null
        setError(data?.error ?? "Не удалось сохранить")
        return
      }
      const at = new Date().toISOString()
      onResolved(row.id, note, by, at)
      setResolutionNote("")
      setResolvedBy("")
    } catch {
      setError("Не удалось сохранить")
    } finally {
      setSaving(false)
    }
  }

  async function handleAttachGift() {
    if (!row || !giftMenuItemId || !giftReason.trim() || !row.profile_id) return
    setGiftSaving(true)
    setGiftSaved(false)
    try {
      const res = await fetch("/api/admin/gifts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile_id: row.profile_id,
          brand_id: row.brand_id,
          menu_item_id: giftMenuItemId,
          quantity: giftQuantity,
          reason: giftReason.trim(),
          created_by: "",
          source_feedback_id: row.id,
          source_order_id: row.order_id,
        }),
      })
      if (!res.ok) return
      setGiftSaved(true)
      setGiftMenuItemId("")
      setGiftQuantity(1)
      setGiftReason("")
      await loadPendingGifts(row.profile_id, row.brand_id)
    } finally {
      setGiftSaving(false)
    }
  }

  async function handleSendSms() {
    if (!row || !smsText.trim()) return
    setSmsSending(true)
    setSmsResult(null)
    try {
      const res = await fetch(`/api/admin/feedback/${row.id}/sms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: smsText.trim() }),
      })
      setSmsResult(res.ok ? "ok" : "error")
    } catch {
      setSmsResult("error")
    } finally {
      setSmsSending(false)
    }
  }

  if (!row) return null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Отзыв · {row.brand_name}</SheetTitle>
        </SheetHeader>

        <div className="space-y-6 px-4 pb-6">
          <div className="space-y-3">
            <div>
              <p className="text-xs text-muted-foreground">Дата</p>
              <p className="font-medium">
                {row.submitted_at
                  ? formatSubmittedAt(row.submitted_at)
                  : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Клиент</p>
              <p className="font-medium">
                {row.customer_name ?? "—"}
              </p>
              {row.customer_phone ? (
                <a
                  href={`tel:${row.customer_phone}`}
                  className="text-sm text-blue-600 dark:text-blue-400 underline"
                >
                  {row.customer_phone}
                </a>
              ) : (
                <p className="text-sm text-muted-foreground">нет телефона</p>
              )}
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Курьер</p>
              <p className="font-medium">{row.courier_name ?? "—"}</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <p className="mb-1 text-sm font-medium">🍱 Продукт</p>
              {row.food_rating != null ? (
                <StarDisplay rating={row.food_rating} />
              ) : (
                "—"
              )}
            </div>
            <div>
              <p className="mb-1 text-sm font-medium">🚀 Сервис</p>
              {row.service_rating != null ? (
                <StarDisplay rating={row.service_rating} />
              ) : (
                "—"
              )}
            </div>
          </div>

          <div>
            <p className="mb-1 text-sm font-medium">Комментарий</p>
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">
              {row.comment?.trim() || "—"}
            </p>
          </div>

          {(row.photo_urls?.length ?? 0) > 0 ? (
            <div>
              <p className="mb-2 text-sm font-medium">Фото от клиента</p>
              <div className="flex flex-wrap gap-2">
                {row.photo_urls!.slice(0, 3).map((path) => {
                  const src = `/api/feedback/${row.token}/photo/${path
                    .split("/")
                    .map((segment) => encodeURIComponent(segment))
                    .join("/")}`
                  return (
                    <a
                      key={path}
                      href={src}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block size-[120px] shrink-0 overflow-hidden rounded-md border"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={src}
                        alt=""
                        className="size-[120px] object-cover"
                      />
                    </a>
                  )
                })}
              </div>
            </div>
          ) : null}

          <div className="space-y-2 rounded-lg border bg-muted/30 p-4">
            <p className="text-sm font-medium">Заказ</p>
            {orderLoading ? (
              <p className="text-xs text-muted-foreground">Загрузка…</p>
            ) : orderDetails ? (
              <div className="space-y-2">
                <div className="space-y-1 text-sm">
                  <p className="font-medium">
                    #{orderDetails.order_number} ·{" "}
                    {formatSubmittedAt(orderDetails.created_at)}
                  </p>
                  {orderDetails.delivery_address ? (
                    <p className="text-muted-foreground">
                      {orderDetails.delivery_address}
                    </p>
                  ) : null}
                </div>
                <div className="space-y-1">
                  {orderDetails.items.map((item, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span>
                        {item.quantity}× {item.name}
                        {item.size ? ` (${item.size})` : ""}
                        {item.is_gift ? " подарок 🎁" : ""}
                      </span>
                      <span className="text-muted-foreground">
                        {(item.price_bani / 100).toFixed(0)} MDL
                      </span>
                    </div>
                  ))}
                </div>
                <div className="border-t pt-2 space-y-1 text-sm">
                  {orderDetails.discount_bani > 0 && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>Скидка</span>
                      <span>
                        −{(orderDetails.discount_bani / 100).toFixed(0)} MDL
                      </span>
                    </div>
                  )}
                  {orderDetails.delivery_fee_bani > 0 && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>Доставка</span>
                      <span>
                        {(orderDetails.delivery_fee_bani / 100).toFixed(0)} MDL
                      </span>
                    </div>
                  )}
                  {orderDetails.promo_code && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>Промокод</span>
                      <span className="font-mono text-xs">
                        {orderDetails.promo_code}
                      </span>
                    </div>
                  )}
                  {orderDetails.bonuses_redeemed > 0 && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>Бонусы</span>
                      <span>−{orderDetails.bonuses_redeemed} MDL</span>
                    </div>
                  )}
                  <div className="flex justify-between font-semibold">
                    <span>Итого</span>
                    <span>
                      {(orderDetails.total_bani / 100).toFixed(0)} MDL
                    </span>
                  </div>
                </div>
                <div className="flex gap-3 text-xs text-muted-foreground">
                  <span>
                    {orderDetails.delivery_mode === "delivery"
                      ? "Доставка"
                      : orderDetails.delivery_mode === "pickup"
                        ? "Самовывоз"
                        : "Агрегатор"}
                  </span>
                  <span>·</span>
                  <span>
                    {orderDetails.payment_method === "cash"
                      ? "Наличные"
                      : orderDetails.payment_method === "card"
                        ? "Карта"
                        : orderDetails.payment_method === "online_card"
                          ? "Онлайн"
                          : orderDetails.payment_method}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Нет данных</p>
            )}
          </div>

          <div className="space-y-2 rounded-lg border p-4">
            <p className="text-sm font-medium">📱 Написать клиенту</p>
            <Textarea
              value={smsText}
              onChange={(e) => setSmsText(e.target.value)}
              rows={3}
              placeholder="Например: Здравствуйте! Спасибо за отзыв — подарим вам колу к следующему заказу 🎁"
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {smsCost.chars === 0
                  ? "0 симв."
                  : `${smsCost.chars} симв. · ${smsCost.segments} сегм. · ~${smsCost.costMdl.toFixed(2)} MDL`}
              </span>
              <Button
                type="button"
                size="sm"
                disabled={smsSending || !smsText.trim()}
                onClick={() => void handleSendSms()}
              >
                {smsSending ? "Отправка…" : "Отправить SMS"}
              </Button>
            </div>
            {smsResult === "ok" && (
              <p className="text-xs text-green-600">SMS отправлено</p>
            )}
            {smsResult === "error" && (
              <p className="text-xs text-destructive">Ошибка отправки</p>
            )}
          </div>

          <div className="space-y-2 rounded-lg border p-4">
            <p className="text-sm font-medium">🎁 Прикрепить подарок</p>
            {!row.profile_id ? (
              <p className="text-xs text-muted-foreground">
                Нет профиля клиента — подарок недоступен
              </p>
            ) : (
              <>
                {pendingGifts.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">
                      Активные подарки:
                    </p>
                    <ul className="space-y-2">
                      {pendingGifts.map((gift) => (
                        <li
                          key={gift.id}
                          className="rounded-md bg-amber-50 px-3 py-2 text-sm dark:bg-amber-950/30"
                        >
                          <p>
                            🎁 {gift.item_name} × {gift.quantity} — «
                            {gift.reason}»
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {formatSubmittedAt(gift.created_at)}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                <Select
                  value={giftMenuItemId || undefined}
                  onValueChange={setGiftMenuItemId}
                  disabled={menuItemsLoading}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        menuItemsLoading ? "Загрузка меню…" : "Выберите позицию"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {menuItems.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name_ru}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  min={1}
                  value={giftQuantity}
                  onChange={(e) =>
                    setGiftQuantity(Math.max(1, Number(e.target.value) || 1))
                  }
                />
                <Textarea
                  value={giftReason}
                  onChange={(e) => setGiftReason(e.target.value)}
                  rows={2}
                  placeholder="Причина подарка"
                />
                <Button
                  type="button"
                  size="sm"
                  className="w-full"
                  disabled={
                    giftSaving ||
                    !giftMenuItemId ||
                    !giftReason.trim()
                  }
                  onClick={() => void handleAttachGift()}
                >
                  {giftSaving ? "Сохранение…" : "Прикрепить подарок"}
                </Button>
                {giftSaved ? (
                  <p className="text-xs text-green-600">Подарок прикреплён</p>
                ) : null}
              </>
            )}
          </div>

          <div className="space-y-3 rounded-lg border p-4">
            <p className="font-medium">Резолюция</p>
            {isResolved ? (
              <div className="space-y-2 text-sm">
                <p className="whitespace-pre-wrap">{row.resolution_note}</p>
                <p className="text-muted-foreground">
                  {row.resolved_by} ·{" "}
                  {row.resolved_at
                    ? formatSubmittedAt(row.resolved_at)
                    : "—"}
                </p>
              </div>
            ) : isNegative ? (
              <>
                <Textarea
                  value={resolutionNote}
                  onChange={(e) => setResolutionNote(e.target.value)}
                  rows={4}
                  placeholder="Что сделали по отзыву"
                />
                <Input
                  value={resolvedBy}
                  onChange={(e) => setResolvedBy(e.target.value)}
                  placeholder="Кто разобрался"
                />
                {error ? (
                  <p className="text-sm text-destructive">{error}</p>
                ) : null}
                <Button
                  type="button"
                  className="w-full bg-[#ccff00] text-[#242424] hover:bg-[#ccff00]/90"
                  disabled={saving}
                  onClick={() => void handleResolve()}
                >
                  {saving ? "Сохранение…" : "Отметить решённым"}
                </Button>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Резолюция нужна только для негативных отзывов.
              </p>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

export function FeedbackPageClient({
  initialData,
  dateFrom,
  dateTo,
  brandFilter,
}: FeedbackPageClientProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [rows, setRows] = useState<FeedbackRow[]>(initialData.feedbacks)
  const [sentimentFilter, setSentimentFilter] =
    useState<SentimentFilter>("all")
  const [resolutionFilter, setResolutionFilter] =
    useState<ResolutionFilter>("all")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  const metrics = initialData.metrics

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const negative = isNegativeFeedback(
        row.food_rating,
        row.service_rating,
      )
      if (sentimentFilter === "negative" && !negative) return false
      if (sentimentFilter === "positive" && negative) return false

      const resolved = row.resolved_at != null
      if (resolutionFilter === "pending" && (!negative || resolved)) {
        return false
      }
      if (resolutionFilter === "resolved" && !resolved) return false

      return true
    })
  }, [rows, sentimentFilter, resolutionFilter])

  const selectedRow =
    filteredRows.find((r) => r.id === selectedId) ??
    rows.find((r) => r.id === selectedId) ??
    null

  function setBrandInUrl(slug: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (slug) params.set("brand", slug)
    else params.delete("brand")
    const qs = params.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname)
  }

  function openRow(row: FeedbackRow) {
    setSelectedId(row.id)
    setSheetOpen(true)
  }

  function handleResolved(
    id: string,
    note: string,
    by: string,
    at: string,
  ) {
    setRows((prev) =>
      prev.map((r) =>
        r.id === id
          ? {
              ...r,
              resolution_note: note,
              resolved_by: by,
              resolved_at: at,
            }
          : r,
      ),
    )
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-medium">Отзывы</h1>
          <p className="text-sm text-muted-foreground">
            Отзывы клиентов после заказа
          </p>
        </div>
        <PeriodFilter dateFrom={dateFrom} dateTo={dateTo} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <MetricCard
          label="⭐ Продукт"
          value={metrics.avg_food ?? "—"}
        />
        <MetricCard
          label="⭐ Сервис"
          value={metrics.avg_service ?? "—"}
        />
        <MetricCard
          label="📊 Конверсия"
          value={
            metrics.conversion_pct != null
              ? `${metrics.conversion_pct}%`
              : "—"
          }
          prominent
        />
        <MetricCard
          label="🔴 Негативных"
          value={`${metrics.negative_count}${
            metrics.negative_pct != null ? ` (${metrics.negative_pct}%)` : ""
          }`}
        />
        <MetricCard
          label="📨 SMS отправлено"
          value={metrics.total_sms_sent}
        />
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          {BRAND_TABS.map((tab) => (
            <FilterChip
              key={tab.slug || "all"}
              active={brandFilter === tab.slug}
              onClick={() => setBrandInUrl(tab.slug)}
            >
              {tab.label}
            </FilterChip>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <FilterChip
            active={sentimentFilter === "all"}
            onClick={() => setSentimentFilter("all")}
          >
            Все
          </FilterChip>
          <FilterChip
            active={sentimentFilter === "negative"}
            onClick={() => setSentimentFilter("negative")}
          >
            Негативные
          </FilterChip>
          <FilterChip
            active={sentimentFilter === "positive"}
            onClick={() => setSentimentFilter("positive")}
          >
            Позитивные
          </FilterChip>

          <span className="mx-1 hidden h-6 w-px bg-border sm:inline" />

          <FilterChip
            active={resolutionFilter === "all"}
            onClick={() => setResolutionFilter("all")}
          >
            Все
          </FilterChip>
          <FilterChip
            active={resolutionFilter === "pending"}
            onClick={() => setResolutionFilter("pending")}
          >
            Ждёт решения
          </FilterChip>
          <FilterChip
            active={resolutionFilter === "resolved"}
            onClick={() => setResolutionFilter("resolved")}
          >
            Решено
          </FilterChip>
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Дата</TableHead>
              <TableHead>Бренд</TableHead>
              <TableHead>Клиент</TableHead>
              <TableHead>Курьер</TableHead>
              <TableHead>🍱</TableHead>
              <TableHead>🚀</TableHead>
              <TableHead>Комментарий</TableHead>
              <TableHead>Статус</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="h-24 text-center text-muted-foreground"
                >
                  Нет отзывов за выбранный период
                </TableCell>
              </TableRow>
            ) : (
              filteredRows.map((row) => {
                const negative = isNegativeFeedback(
                  row.food_rating,
                  row.service_rating,
                )
                const resolved = row.resolved_at != null
                const pending = negative && !resolved

                return (
                  <TableRow
                    key={row.id}
                    className={cn(
                      "cursor-pointer transition-colors hover:bg-muted/50",
                      negative &&
                        "bg-red-500/10 border-l-2 border-l-red-500",
                    )}
                    onClick={() => openRow(row)}
                  >
                    <TableCell className="whitespace-nowrap text-sm">
                      {row.submitted_at
                        ? formatSubmittedAt(row.submitted_at)
                        : "—"}
                    </TableCell>
                    <TableCell>{row.brand_name}</TableCell>
                    <TableCell>
                      <div className="max-w-[140px] truncate">
                        {row.customer_name ?? row.customer_phone ?? "—"}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[120px] truncate">
                      {row.courier_name ?? "—"}
                    </TableCell>
                    <TableCell>
                      <RatingCell rating={row.food_rating} />
                    </TableCell>
                    <TableCell>
                      <RatingCell rating={row.service_rating} />
                    </TableCell>
                    <TableCell className="max-w-[200px] text-muted-foreground">
                      {truncateComment(row.comment)}
                    </TableCell>
                    <TableCell>
                      {resolved ? (
                        <Badge className="bg-green-600 text-white hover:bg-green-600">
                          Решено
                        </Badge>
                      ) : pending ? (
                        <Badge variant="destructive">Ждёт</Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      <FeedbackDetailSheet
        row={selectedRow}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onResolved={handleResolved}
      />
    </div>
  )
}
