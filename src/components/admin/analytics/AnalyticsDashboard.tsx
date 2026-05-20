"use client"

import React, { useState, useCallback, useMemo } from "react"
import {
  type AnalyticsResult,
  type AnalyticsFilters,
  type DayStats,
  getAnalyticsData,
} from "@/lib/actions/admin/analytics"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
import { Badge } from "@/components/ui/badge"
import {
  ChartContainer,
  ChartTooltip,
  type ChartConfig,
} from "@/components/ui/chart"
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  XAxis,
  YAxis,
} from "recharts"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface AnalyticsDashboardProps {
  initialData: AnalyticsResult
  brands: { id: string; name: string; slug: string }[]
}

const chartConfig = {
  revenue: {
    label: "Выручка",
    color: "hsl(var(--primary))",
  },
  orders: {
    label: "Заказы",
    color: "hsl(var(--muted-foreground))",
  },
  newCustomers: {
    label: "Новые клиенты",
    color: "hsl(var(--primary))",
  },
} satisfies ChartConfig

function formatMDL(n: number): string {
  return `${n.toLocaleString("ru", { maximumFractionDigits: 0 })} MDL`
}

function calcDelta(current: number, prev: number): number {
  if (prev === 0) return 0
  return ((current - prev) / prev) * 100
}

function DeltaBadge({ current, prev }: { current: number; prev: number }) {
  const delta = calcDelta(current, prev)
  const rounded = Math.round(delta)
  const text =
    delta > 0 ? `+${rounded}%` : delta < 0 ? `${rounded}%` : "0%"

  return (
    <Badge
      variant="outline"
      className={cn(
        "tabular-nums",
        delta > 0 &&
          "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
        delta < 0 &&
          "border-destructive/30 bg-destructive/10 text-destructive",
        delta === 0 && "text-muted-foreground"
      )}
    >
      {text}
    </Badge>
  )
}

function MainChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ payload: DayStats }>
  label?: string
}) {
  if (!active || !payload?.length) return null

  const row = payload[0].payload

  return (
    <div className="grid min-w-36 gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
      <p className="font-medium">{label}</p>
      <p>
        <span className="text-muted-foreground">Выручка: </span>
        {formatMDL(row.revenue)}
      </p>
      <p>
        <span className="text-muted-foreground">Заказы: </span>
        {row.orders}
      </p>
      <p>
        <span className="text-muted-foreground">Средний чек: </span>
        {formatMDL(row.avgCheck)}
      </p>
    </div>
  )
}

export default function AnalyticsDashboard({
  initialData,
  brands,
}: AnalyticsDashboardProps) {
  const [data, setData] = useState<AnalyticsResult>(initialData)
  const [filters, setFilters] = useState<AnalyticsFilters>({
    days: 30,
    brandId: undefined,
  })
  const [loading, setLoading] = useState(false)

  const brandById = useMemo(
    () => new Map(brands.map((b) => [b.id, b])),
    [brands]
  )

  const applyFilters = useCallback(async (newFilters: AnalyticsFilters) => {
    setLoading(true)
    try {
      const result = await getAnalyticsData(newFilters)
      setData(result)
      setFilters(newFilters)
    } finally {
      setLoading(false)
    }
  }, [])

  const { summary } = data
  const hasNewCustomers = data.dayStats.some((d) => d.newCustomers > 0)

  return (
    <div className="relative space-y-6">
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      )}

      <div
        className={cn(
          "space-y-6 transition-opacity",
          loading && "pointer-events-none opacity-60"
        )}
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-2xl font-bold">Аналитика</h1>
          <div className="flex flex-wrap items-center gap-3">
            <Select
              value={filters.brandId ?? "all"}
              onValueChange={(value) => {
                void applyFilters({
                  ...filters,
                  brandId: value === "all" ? undefined : value,
                })
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Бренд" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все бренды</SelectItem>
                {brands.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Tabs
              value={String(filters.days)}
              onValueChange={(value) => {
                void applyFilters({
                  ...filters,
                  days: Number(value) as AnalyticsFilters["days"],
                })
              }}
            >
              <TabsList>
                <TabsTrigger value="7">7 дней</TabsTrigger>
                <TabsTrigger value="14">14 дней</TabsTrigger>
                <TabsTrigger value="30">30 дней</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Card>
            <CardHeader>
              <CardDescription>Выручка</CardDescription>
              <CardTitle className="flex flex-wrap items-center gap-2 text-2xl">
                {formatMDL(summary.totalRevenue)}
                <DeltaBadge
                  current={summary.totalRevenue}
                  prev={summary.prevTotalRevenue}
                />
              </CardTitle>
              <CardDescription>{summary.totalOrders} заказов</CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <CardDescription>Заказы</CardDescription>
              <CardTitle className="flex flex-wrap items-center gap-2 text-2xl">
                {summary.totalOrders}
                <DeltaBadge
                  current={summary.totalOrders}
                  prev={summary.prevTotalOrders}
                />
              </CardTitle>
              <CardDescription>
                Средний чек: {formatMDL(summary.avgCheck)}
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <CardDescription>Новые клиенты</CardDescription>
              <CardTitle className="flex flex-wrap items-center gap-2 text-2xl">
                {summary.newCustomers}
                <DeltaBadge
                  current={summary.newCustomers}
                  prev={summary.prevNewCustomers}
                />
              </CardTitle>
              <CardDescription>за выбранный период</CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <CardDescription>Средний чек</CardDescription>
              <CardTitle className="text-2xl">
                {formatMDL(summary.avgCheck)}
              </CardTitle>
              <CardDescription>на один заказ</CardDescription>
            </CardHeader>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Выручка и заказы по дням</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[320px] w-full">
              <ComposedChart data={data.dayStats}>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 12 }}
                />
                <YAxis
                  yAxisId="revenue"
                  orientation="left"
                  tickFormatter={(v) => `${v} ₼`}
                  width={80}
                />
                <YAxis
                  yAxisId="orders"
                  orientation="right"
                  width={40}
                />
                <ChartTooltip content={<MainChartTooltip />} />
                <Area
                  yAxisId="revenue"
                  type="monotone"
                  dataKey="revenue"
                  fill="hsl(var(--primary) / 0.15)"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                />
                <Bar
                  yAxisId="orders"
                  dataKey="orders"
                  fill="hsl(var(--muted-foreground) / 0.3)"
                  radius={[4, 4, 0, 0]}
                />
              </ComposedChart>
            </ChartContainer>
            <div className="mt-4 flex items-center justify-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <span
                  className="size-2.5 rounded-full"
                  style={{ backgroundColor: "hsl(var(--primary))" }}
                />
                Выручка
              </div>
              <div className="flex items-center gap-2">
                <span
                  className="size-2.5 rounded-full"
                  style={{
                    backgroundColor: "hsl(var(--muted-foreground) / 0.5)",
                  }}
                />
                Заказы
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-5">
          {hasNewCustomers && (
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Новые клиенты по дням</CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig} className="h-[240px] w-full">
                  <BarChart data={data.dayStats}>
                    <CartesianGrid vertical={false} />
                    <XAxis
                      dataKey="date"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 11 }}
                    />
                    <YAxis width={32} allowDecimals={false} />
                    <ChartTooltip />
                    <Bar
                      dataKey="newCustomers"
                      fill="hsl(var(--primary))"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>
          )}

          <Card className={cn(hasNewCustomers ? "md:col-span-3" : "md:col-span-5")}>
            <CardHeader>
              <CardTitle>Популярные позиции</CardTitle>
            </CardHeader>
            <CardContent>
              {data.popularItems.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Нет данных
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">#</TableHead>
                      <TableHead>Название</TableHead>
                      <TableHead>Бренд</TableHead>
                      <TableHead className="text-right">Кол-во</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.popularItems.map((item, index) => {
                      const brand = brandById.get(item.brand_id)
                      return (
                        <TableRow key={item.menu_item_id}>
                          <TableCell className="text-muted-foreground">
                            {index + 1}
                          </TableCell>
                          <TableCell className="font-medium">
                            {item.name}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {brand?.slug ?? item.brand_id}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {item.totalQty}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
