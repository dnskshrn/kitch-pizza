"use client"

import Link from "next/link"
import { useCallback } from "react"
import { format, parseISO } from "date-fns"
import { useRouter, useSearchParams } from "next/navigation"
import type { CashSessionListItem } from "@/lib/actions/admin/cash-sessions"
import {
  cashSessionsHasActiveFilters,
  type CashSessionsFilters,
  type CashSessionsStatusFilter,
  utcDaysAgoYmd,
} from "@/lib/admin/cash-sessions-url"
import { utcTodayYmd } from "@/lib/admin/orders-url"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { discrepancyTextClass, fmtMdl } from "@/lib/format/money"
import { cn } from "@/lib/utils"

const CASH_SESSIONS_PATH = "/admin/finance/cash-sessions"

type CashSessionsClientProps = {
  sessions: CashSessionListItem[]
  staff: Array<{ id: string; name: string }>
  initialFilters: CashSessionsFilters
}

function formatOpenedAt(iso: string): string {
  return format(parseISO(iso), "dd.MM HH:mm")
}

function formatDuration(minutes: number | null): string {
  if (minutes == null) return ""
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h > 0 && m > 0) return `${h}ч ${m}м`
  if (h > 0) return `${h}ч`
  return `${m}м`
}

function MdlCell({
  bani,
  className,
  showZero = false,
  sign = false,
}: {
  bani: number
  className?: string
  showZero?: boolean
  sign?: boolean
}) {
  if (bani === 0 && !showZero) {
    return <span className="text-muted-foreground">—</span>
  }
  return (
    <span className={cn("tabular-nums", className)}>
      {fmtMdl(bani, { sign })} MDL
    </span>
  )
}

function resolveDateInputValue(
  param: string | null,
  defaultYmd: string,
): string {
  if (param === null) return defaultYmd
  return param
}

function resolveStaffSelectValue(staffId: string | null): string {
  return staffId ?? "all"
}

function resolveStatusSelectValue(status: CashSessionsStatusFilter): string {
  return status
}

export function CashSessionsClient({
  sessions,
  staff,
  initialFilters,
}: CashSessionsClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const defaultDateFrom = utcDaysAgoYmd(30)
  const defaultDateTo = utcTodayYmd()

  const dateFromParam = searchParams.get("date_from")
  const dateToParam = searchParams.get("date_to")
  const staffParam = searchParams.get("staff_id")
  const statusParam = searchParams.get("status")

  const dateFromValue = resolveDateInputValue(dateFromParam, defaultDateFrom)
  const dateToValue = resolveDateInputValue(dateToParam, defaultDateTo)
  const staffValue =
    staffParam === null
      ? resolveStaffSelectValue(initialFilters.staffId)
      : staffParam === ""
        ? "all"
        : staffParam
  const statusValue =
    statusParam === null
      ? resolveStatusSelectValue(initialFilters.status)
      : statusParam === ""
        ? "all"
        : statusParam

  const pushFilters = useCallback(
    (updates: Record<string, string | null>) => {
      const next = new URLSearchParams(searchParams.toString())
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === "") next.delete(key)
        else next.set(key, value)
      }
      const qs = next.toString()
      router.push(qs ? `${CASH_SESSIONS_PATH}?${qs}` : CASH_SESSIONS_PATH)
      router.refresh()
    },
    [router, searchParams],
  )

  const openCount = sessions.filter((s) => s.status === "open").length
  const closedCount = sessions.filter((s) => s.status === "closed").length

  const turnoverBani = sessions.reduce(
    (sum, s) =>
      sum +
      s.own_cash_in_bani +
      s.own_card_in_bani +
      s.glovo_cash_in_bani,
    0,
  )

  const glovoCardBani = sessions.reduce((sum, s) => sum + s.glovo_card_bani, 0)

  const closedSessions = sessions.filter((s) => s.status === "closed")
  const discrepancyTotalBani = closedSessions.reduce(
    (sum, s) => sum + Math.abs(s.discrepancy_bani ?? 0),
    0,
  )
  const largeDiscrepancyCount = closedSessions.filter((s) => {
    const d = s.discrepancy_bani ?? 0
    return Math.abs(d) > 5000
  }).length
  const hasLargeDiscrepancy = largeDiscrepancyCount > 0

  const hasActiveFilters = cashSessionsHasActiveFilters(searchParams)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-[140px] flex-col gap-1.5">
          <Label className="text-muted-foreground text-xs" htmlFor="cs-date-from">
            С
          </Label>
          <Input
            id="cs-date-from"
            type="date"
            value={dateFromValue}
            onChange={(e) =>
              pushFilters({ date_from: e.target.value || null })
            }
          />
        </div>

        <div className="flex min-w-[140px] flex-col gap-1.5">
          <Label className="text-muted-foreground text-xs" htmlFor="cs-date-to">
            По
          </Label>
          <Input
            id="cs-date-to"
            type="date"
            value={dateToValue}
            onChange={(e) => pushFilters({ date_to: e.target.value || null })}
          />
        </div>

        <div className="flex min-w-[200px] flex-col gap-1.5">
          <Label className="text-muted-foreground text-xs">Оператор</Label>
          <Select
            value={staffValue}
            onValueChange={(value) =>
              pushFilters({ staff_id: value === "all" ? null : value })
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Все операторы" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все операторы</SelectItem>
              {staff.map((member) => (
                <SelectItem key={member.id} value={member.id}>
                  {member.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex min-w-[160px] flex-col gap-1.5">
          <Label className="text-muted-foreground text-xs">Статус</Label>
          <Select
            value={statusValue}
            onValueChange={(value) =>
              pushFilters({
                status: value === "all" ? null : value,
              })
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Все" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все</SelectItem>
              <SelectItem value="open">Открытые</SelectItem>
              <SelectItem value="closed">Закрытые</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {hasActiveFilters ? (
          <div className="ml-auto flex flex-col gap-1.5">
            <span className="text-muted-foreground invisible text-xs select-none">
              {"\u00a0"}
            </span>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                router.push(CASH_SESSIONS_PATH)
                router.refresh()
              }}
            >
              Сбросить
            </Button>
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <SummaryCard
          title="Смен"
          value={String(sessions.length)}
          subtitle={`${openCount} открытых · ${closedCount} закрытых`}
        />
        <SummaryCard
          title="Оборот через кассу"
          value={`${fmtMdl(turnoverBani)} MDL`}
          subtitle="Нал · карта · Glovo нал"
        />
        <SummaryCard
          title="Glovo карта"
          value={glovoCardBani === 0 ? "—" : `${fmtMdl(glovoCardBani)} MDL`}
          subtitle="Отдельный канал"
        />
        <SummaryCard
          title="Расхождения"
          value={
            discrepancyTotalBani === 0
              ? "—"
              : `${fmtMdl(discrepancyTotalBani)} MDL`
          }
          subtitle={`${largeDiscrepancyCount} смен с разрывом >50 MDL`}
          valueClassName={
            discrepancyTotalBani === 0
              ? undefined
              : hasLargeDiscrepancy
                ? "text-red-600"
                : "text-muted-foreground"
          }
        />
      </div>

      {sessions.length === 0 ? (
        <div className="rounded-lg border bg-card p-10 text-center text-sm text-muted-foreground">
          За выбранный период смен нет. Попробуй расширить диапазон дат.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow className="sticky top-0 z-10 bg-card hover:bg-card">
                <TableHead>Дата открытия</TableHead>
                <TableHead>Длительность</TableHead>
                <TableHead>Оператор</TableHead>
                <TableHead className="text-right">Оборот через кассу</TableHead>
                <TableHead className="border-l text-right">Glovo карта</TableHead>
                <TableHead className="text-right">Расхождение</TableHead>
                <TableHead>Статус</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessions.map((session) => {
                const detailHref = `${CASH_SESSIONS_PATH}/${session.id}`
                const discrepancy = session.discrepancy_bani ?? 0
                const absDiscrepancyMdl = Math.abs(discrepancy / 100)
                const turnoverBani =
                  session.own_cash_in_bani +
                  session.own_card_in_bani +
                  session.glovo_cash_in_bani
                const turnoverTitle = `Нал: ${fmtMdl(session.own_cash_in_bani)} · Карта: ${fmtMdl(session.own_card_in_bani)} · Glovo нал: ${fmtMdl(session.glovo_cash_in_bani)}`

                return (
                  <TableRow
                    key={session.id}
                    className="cursor-pointer"
                    onClick={() => router.push(detailHref)}
                  >
                    <TableCell>
                      <Link
                        href={detailHref}
                        className="font-medium text-primary hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {formatOpenedAt(session.opened_at)}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {session.duration_minutes == null ? (
                        <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                          Открыта
                        </span>
                      ) : (
                        formatDuration(session.duration_minutes)
                      )}
                    </TableCell>
                    <TableCell>{session.opened_by_name ?? "—"}</TableCell>
                    <TableCell className="text-right" title={turnoverTitle}>
                      <MdlCell bani={turnoverBani} />
                    </TableCell>
                    <TableCell className="border-l text-right">
                      <MdlCell bani={session.glovo_card_bani} />
                    </TableCell>
                    <TableCell className="text-right">
                      {session.status === "open" ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <span
                          className={cn(
                            "tabular-nums",
                            discrepancyTextClass(absDiscrepancyMdl),
                          )}
                          title={session.discrepancy_reason ?? undefined}
                        >
                          {fmtMdl(discrepancy, { sign: true })} MDL
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {session.status === "open" ? (
                        <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                          Открыта
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700">
                          Закрыта
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

function SummaryCard({
  title,
  value,
  subtitle,
  valueClassName,
}: {
  title: string
  value: string
  subtitle: string
  valueClassName?: string
}) {
  return (
    <Card size="sm" className="gap-1 py-3">
      <CardContent className="flex flex-col gap-1 px-3 py-0">
        <div className="text-sm text-muted-foreground">{title}</div>
        <div
          className={cn(
            "text-2xl font-bold tabular-nums",
            valueClassName ?? "text-foreground",
          )}
        >
          {value}
        </div>
        <div className="text-xs text-muted-foreground">{subtitle}</div>
      </CardContent>
    </Card>
  )
}
