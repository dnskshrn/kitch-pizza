"use client"

import { format, parseISO } from "date-fns"
import { Star } from "lucide-react"
import { useMemo, useState, type ReactNode } from "react"
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
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

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
            color: star <= rating ? "#ccff00" : "#c4c4c4",
            fill: star <= rating ? "#ccff00" : "transparent",
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
                  className="text-sm text-primary underline"
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
                      "cursor-pointer",
                      negative && "bg-red-50 dark:bg-red-950/30",
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
