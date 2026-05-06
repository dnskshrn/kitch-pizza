"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { format, isSameDay } from "date-fns"
import { ru } from "date-fns/locale"
import type { DateRange } from "react-day-picker"
import { CalendarDays } from "lucide-react"
import { Calendar } from "@/components/ui/calendar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

const ORDERS_PATH = "/admin/orders"

function parseYmdLocal(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number)
  return new Date(y, m - 1, d)
}

function formatRangeLabel(from: Date, to: Date): string {
  const fmt = (dt: Date) =>
    format(dt, "d MMM", { locale: ru }).replace(/\.$/, "").trim()
  if (isSameDay(from, to)) {
    return fmt(from)
  }
  return `${fmt(from)} — ${fmt(to)}`
}

export function FiltersBar() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const searchFromUrl = searchParams.get("search") ?? ""
  const [searchDraft, setSearchDraft] = useState(searchFromUrl)
  const [rangeOpen, setRangeOpen] = useState(false)
  const [calendarRange, setCalendarRange] = useState<DateRange | undefined>(
    undefined,
  )

  useEffect(() => {
    setSearchDraft(searchFromUrl)
  }, [searchFromUrl])

  const dateFrom = searchParams.get("date_from") ?? ""
  const dateTo = searchParams.get("date_to") ?? ""
  const timeFrom = searchParams.get("time_from") ?? ""
  const timeTo = searchParams.get("time_to") ?? ""

  useEffect(() => {
    if (dateFrom) {
      const from = parseYmdLocal(dateFrom)
      const to = dateTo ? parseYmdLocal(dateTo) : from
      setCalendarRange({ from, to })
    } else {
      setCalendarRange(undefined)
    }
  }, [dateFrom, dateTo])

  const replaceUrl = useCallback(
    (
      updates: Record<string, string | null | undefined>,
      options?: { resetPage?: boolean },
    ) => {
      const next = new URLSearchParams(searchParams.toString())
      for (const [k, v] of Object.entries(updates)) {
        if (v === undefined || v === null || v === "") next.delete(k)
        else next.set(k, v)
      }
      if (options?.resetPage !== false) {
        next.delete("page")
      }
      const qs = next.toString()
      router.replace(qs ? `${ORDERS_PATH}?${qs}` : ORDERS_PATH, {
        scroll: false,
      })
    },
    [router, searchParams],
  )

  useEffect(() => {
    const t = setTimeout(() => {
      const trimmed = searchDraft.trim()
      const cur = searchFromUrl.trim()
      if (trimmed === cur) return
      replaceUrl({ search: trimmed || null }, { resetPage: true })
    }, 500)
    return () => clearTimeout(t)
  }, [searchDraft, searchFromUrl, replaceUrl])

  const statusValue = searchParams.get("status") ?? "all"
  const pageNum = Number(searchParams.get("page") ?? "1")

  const hasDateFilter = Boolean(dateFrom || dateTo)

  const hasActiveFilters =
    searchFromUrl.trim() !== "" ||
    statusValue !== "all" ||
    hasDateFilter ||
    Boolean(timeFrom || timeTo) ||
    pageNum > 1

  function handleRangeSelect(range: DateRange | undefined) {
    setCalendarRange(range)
    if (range?.from && range?.to) {
      replaceUrl(
        {
          date_from: format(range.from, "yyyy-MM-dd"),
          date_to: format(range.to, "yyyy-MM-dd"),
        },
        { resetPage: true },
      )
      setRangeOpen(false)
    }
  }

  function handleRangeOpenChange(open: boolean) {
    setRangeOpen(open)
    if (!open) {
      if (dateFrom) {
        const from = parseYmdLocal(dateFrom)
        const to = dateTo ? parseYmdLocal(dateTo) : from
        setCalendarRange({ from, to })
      } else {
        setCalendarRange(undefined)
      }
    }
  }

  const rangeButtonLabel =
    calendarRange?.from && calendarRange?.to
      ? formatRangeLabel(calendarRange.from, calendarRange.to)
      : "Все даты"

  return (
    <div
      className={cn(
        "mb-6 flex flex-col gap-3",
        "md:flex-row md:flex-wrap md:items-end",
      )}
    >
      <div className="flex w-full min-w-0 flex-col gap-1.5 md:w-auto md:min-w-[200px]">
        <Label className="text-muted-foreground text-xs" htmlFor="ord-search">
          Поиск
        </Label>
        <Input
          id="ord-search"
          placeholder="Имя или телефон"
          value={searchDraft}
          onChange={(e) => setSearchDraft(e.target.value)}
        />
      </div>

      <div className="flex w-full min-w-0 flex-col gap-1.5 md:w-auto">
        <Label className="text-muted-foreground text-xs">Статус</Label>
        <Select
          value={statusValue}
          onValueChange={(v) =>
            replaceUrl(
              { status: v === "all" ? null : v },
              { resetPage: true },
            )
          }
        >
          <SelectTrigger size="sm" className="w-full min-w-[200px] md:w-[220px]">
            <SelectValue placeholder="Статус" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все статусы</SelectItem>
            <SelectItem value="draft">Черновик</SelectItem>
            <SelectItem value="new">Новый</SelectItem>
            <SelectItem value="confirmed">Подтверждён</SelectItem>
            <SelectItem value="cooking">Готовится</SelectItem>
            <SelectItem value="ready">Готов</SelectItem>
            <SelectItem value="delivery">Доставляется</SelectItem>
            <SelectItem value="done">Выполнен</SelectItem>
            <SelectItem value="cancelled">Отменён</SelectItem>
            <SelectItem value="rejected">Отклонён</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex w-full min-w-0 flex-col gap-1.5 md:w-auto">
        <Label className="text-muted-foreground text-xs">Период</Label>
        <Popover open={rangeOpen} onOpenChange={handleRangeOpenChange}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={cn(
                "h-8 w-full min-w-0 justify-start gap-2 font-normal md:min-w-[200px]",
                !hasDateFilter && "text-muted-foreground",
              )}
            >
              <CalendarDays className="size-4 shrink-0 opacity-70" />
              <span className="truncate">{rangeButtonLabel}</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              locale={ru}
              numberOfMonths={1}
              selected={calendarRange}
              onSelect={handleRangeSelect}
              defaultMonth={calendarRange?.from ?? new Date()}
            />
          </PopoverContent>
        </Popover>
      </div>

      {hasDateFilter ? (
        <>
          <div className="flex w-full min-w-[120px] flex-col gap-1.5 md:w-auto">
            <Label className="text-muted-foreground text-xs" htmlFor="ord-tf">
              с
            </Label>
            <Input
              id="ord-tf"
              type="time"
              className="h-8"
              value={timeFrom}
              onChange={(e) =>
                replaceUrl(
                  { time_from: e.target.value || null },
                  { resetPage: true },
                )
              }
            />
          </div>
          <div className="flex w-full min-w-[120px] flex-col gap-1.5 md:w-auto">
            <Label className="text-muted-foreground text-xs" htmlFor="ord-tt">
              до
            </Label>
            <Input
              id="ord-tt"
              type="time"
              className="h-8"
              value={timeTo}
              onChange={(e) =>
                replaceUrl(
                  { time_to: e.target.value || null },
                  { resetPage: true },
                )
              }
            />
          </div>
        </>
      ) : null}

      {hasActiveFilters ? (
        <div className="flex w-full flex-col gap-1.5 pt-1 md:w-auto md:pt-0">
          <span className="text-muted-foreground text-xs md:invisible md:h-4 md:select-none">
            {"\u00a0"}
          </span>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-8 w-full md:w-auto"
            onClick={() => router.replace(ORDERS_PATH, { scroll: false })}
          >
            Сбросить
          </Button>
        </div>
      ) : null}
    </div>
  )
}
