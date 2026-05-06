"use client"

import { useEffect, useMemo, useState } from "react"
import { endOfDay, isAfter, isBefore, parseISO, startOfDay } from "date-fns"
import { Badge } from "@/components/ui/badge"
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

export type ShiftTableRow = {
  id: string
  clock_in: string
  clock_out: string | null
  created_at: string
  staff: { id: string; name: string; role: string } | null
  orders_count: number
}

function formatDateTime(iso: string): string {
  const d = parseISO(iso)
  const dd = String(d.getDate()).padStart(2, "0")
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const yyyy = d.getFullYear()
  const hh = String(d.getHours()).padStart(2, "0")
  const min = String(d.getMinutes()).padStart(2, "0")
  return `${dd}.${mm}.${yyyy} ${hh}:${min}`
}

function durationMs(clockIn: string, clockOut: string | null, nowMs: number) {
  const start = parseISO(clockIn).getTime()
  const end = clockOut ? parseISO(clockOut).getTime() : nowMs
  return Math.max(0, end - start)
}

function formatDurationShort(ms: number): string {
  const totalMin = Math.floor(ms / 60000)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return `${h} ч ${m} мин`
}

function parseLocalYmd(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number)
  return new Date(y, m - 1, d)
}

function CourierFilter({
  value,
  onChange,
  couriers,
}: {
  value: string
  onChange: (v: string) => void
  couriers: { id: string; name: string }[]
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor="courier-filter" className="sr-only">
        Курьер
      </Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id="courier-filter" className="w-[220px]">
          <SelectValue placeholder="Курьер" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all">Все курьеры</SelectItem>
          {couriers.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

export function ShiftsClient({ shifts }: { shifts: ShiftTableRow[] }) {
  const [now, setNow] = useState(() => Date.now())
  const [courierId, setCourierId] = useState("__all")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(id)
  }, [])

  const courierOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const s of shifts) {
      if (s.staff?.role === "courier") {
        map.set(s.staff.id, s.staff.name)
      }
    }
    return [...map.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "ru"))
  }, [shifts])

  const filtered = useMemo(() => {
    return shifts.filter((s) => {
      if (courierId !== "__all" && s.staff?.id !== courierId) {
        return false
      }
      const t = parseISO(s.clock_in)
      if (dateFrom) {
        const fromStart = startOfDay(parseLocalYmd(dateFrom))
        if (isBefore(t, fromStart)) return false
      }
      if (dateTo) {
        const toEnd = endOfDay(parseLocalYmd(dateTo))
        if (isAfter(t, toEnd)) return false
      }
      return true
    })
  }, [shifts, courierId, dateFrom, dateTo])

  const summary = useMemo(() => {
    const total = filtered.length
    const active = filtered.filter((s) => s.clock_out == null).length
    let totalMs = 0
    for (const s of filtered) {
      if (s.clock_out) {
        totalMs += durationMs(s.clock_in, s.clock_out, now)
      }
    }
    const ordersSum = filtered.reduce((acc, s) => acc + s.orders_count, 0)
    return {
      total,
      active,
      totalMs,
      ordersSum,
    }
  }, [filtered, now])

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold">Смены</h1>
        <div className="flex flex-wrap items-end gap-4">
          <CourierFilter
            value={courierId}
            onChange={setCourierId}
            couriers={courierOptions}
          />
          <div className="grid gap-2">
            <Label htmlFor="date-from" className="text-muted-foreground text-xs">
              С
            </Label>
            <Input
              id="date-from"
              type="date"
              className="w-[160px]"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="date-to" className="text-muted-foreground text-xs">
              По
            </Label>
            <Input
              id="date-to"
              type="date"
              className="w-[160px]"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="bg-muted/40 mb-6 grid gap-2 rounded-lg border p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <span className="text-muted-foreground">Всего смен: </span>
          <span className="font-medium">{summary.total}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Активных: </span>
          <span className="font-medium">{summary.active}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Общее время: </span>
          <span className="font-medium">
            {formatDurationShort(summary.totalMs)}
          </span>
          <span className="text-muted-foreground ml-1">(завершённые)</span>
        </div>
        <div>
          <span className="text-muted-foreground">Доставлено заказов: </span>
          <span className="font-medium">{summary.ordersSum}</span>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Курьер</TableHead>
            <TableHead>Начало смены</TableHead>
            <TableHead>Конец смены</TableHead>
            <TableHead>Длительность</TableHead>
            <TableHead className="text-right">Заказов</TableHead>
            <TableHead>Статус</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={6}
                className="text-muted-foreground text-center"
              >
                Нет смен по выбранным фильтрам
              </TableCell>
            </TableRow>
          ) : (
            filtered.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">
                  {row.staff?.name ?? "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDateTime(row.clock_in)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {row.clock_out ? formatDateTime(row.clock_out) : "—"}
                </TableCell>
                <TableCell>
                  {row.clock_out ? (
                    formatDurationShort(
                      durationMs(row.clock_in, row.clock_out, now),
                    )
                  ) : (
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className="size-2 shrink-0 rounded-full bg-emerald-500"
                        aria-hidden
                      />
                      {formatDurationShort(
                        durationMs(row.clock_in, null, now),
                      )}{" "}
                      ▶
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.orders_count}
                </TableCell>
                <TableCell>
                  {row.clock_out == null ? (
                    <Badge className="bg-emerald-600 hover:bg-emerald-600">
                      Активна
                    </Badge>
                  ) : (
                    <Badge variant="secondary">Завершена</Badge>
                  )}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </>
  )
}
