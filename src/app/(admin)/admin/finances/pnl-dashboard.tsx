"use client"

import Link from "next/link"
import {
  usePathname,
  useSearchParams,
} from "next/navigation"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatMdl } from "@/lib/format-mdl"
import type { PnLData } from "@/types/finance"

type PnLDashboardProps = {
  data: PnLData
}

type NavItem = {
  href: string
  label: string
}

type MetricCardProps = {
  label: string
  amountBani: number
  marginPct?: number | null
  amountClassName?: string
}

type ChannelRow = {
  label: string
  amountBani: number
}

type WaterfallRow = {
  label: string
  amountBani: number
  marginPct?: number | null
  tone?: "neutral" | "expense" | "profit"
  emphasized?: boolean
  nested?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { href: "/admin/finances", label: "P&L" },
  { href: "/admin/finances/expenses", label: "Расходы" },
  { href: "/admin/finances/glovo", label: "Glovo" },
]

function formatPct(value: number): string {
  return `${value.toFixed(1)}%`
}

function formatShare(amountBani: number, totalGrossBani: number): string {
  if (totalGrossBani <= 0) return "—"
  return `${((amountBani / totalGrossBani) * 100).toFixed(1)}%`
}

function formatExpenseAmount(amountBani: number): string {
  if (amountBani === 0) return formatMdl(0)
  return `-${formatMdl(amountBani)}`
}

function formatSignedProfit(amountBani: number): string {
  if (amountBani > 0) return formatMdl(amountBani)
  if (amountBani < 0) return `-${formatMdl(Math.abs(amountBani))}`
  return formatMdl(0)
}

function buildSectionHref(
  href: string,
  searchParams: ReturnType<typeof useSearchParams>,
): string {
  const from = searchParams.get("from")
  const to = searchParams.get("to")

  if (!from || !to) return href

  const params = new URLSearchParams()
  params.set("from", from)
  params.set("to", to)
  return `${href}?${params.toString()}`
}

function amountToneClass(amountBani: number): string {
  if (amountBani > 0) return "text-green-600"
  if (amountBani < 0) return "text-red-600"
  return "text-muted-foreground"
}

function MetricCard({
  label,
  amountBani,
  marginPct,
  amountClassName,
}: MetricCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
        <CardTitle className={amountClassName ?? "text-2xl"}>
          {formatMdl(amountBani)}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {marginPct == null ? (
          <p className="text-sm text-muted-foreground"> </p>
        ) : (
          <p className="text-sm text-muted-foreground">Маржа {formatPct(marginPct)}</p>
        )}
      </CardContent>
    </Card>
  )
}

export function PnLDashboard({
  data,
}: PnLDashboardProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const totalGross = data.revenue.totalGross
  const effectiveGlovo = data.commissions.glovoActual ?? data.commissions.glovoCalculated
  const effectiveBank = data.commissions.bankActual ?? data.commissions.bankCalculated
  const totalDeductions = effectiveGlovo + effectiveBank
  const glovoGross = data.revenue.glovoCashGross + data.revenue.glovoCardGross
  const glovoRatePct =
    glovoGross > 0 ? (data.commissions.glovoCalculated / glovoGross) * 100 : 0
  const bankRatePct =
    data.revenue.ownCard > 0
      ? (data.commissions.bankCalculated / data.revenue.ownCard) * 100
      : 0

  const channelRows: ChannelRow[] = [
    { label: "Собственный — нал", amountBani: data.revenue.ownCash },
    { label: "Собственный — карта", amountBani: data.revenue.ownCard },
    { label: "Glovo — нал", amountBani: data.revenue.glovoCashGross },
    { label: "Glovo — карта", amountBani: data.revenue.glovoCardGross },
  ]

  const waterfallRows: WaterfallRow[] = [
    {
      label: "Чистая выручка",
      amountBani: data.netRevenue,
      tone: "profit",
    },
    {
      label: "Переменные расходы",
      amountBani: data.expenses.variable,
      tone: "expense",
    },
    {
      label: "в т.ч. Поставки",
      amountBani: data.expenses.supplyOrders,
      tone: "expense",
      nested: true,
    },
    {
      label: "= Валовая прибыль",
      amountBani: data.grossProfit,
      marginPct: totalGross > 0 ? data.grossMarginPct : null,
      tone: "profit",
      emphasized: true,
    },
    {
      label: "Постоянные расходы",
      amountBani: data.expenses.fixed,
      tone: "expense",
    },
    {
      label: "Операционные расходы",
      amountBani: data.expenses.operational,
      tone: "expense",
    },
    {
      label: "= Операционная прибыль",
      amountBani: data.operatingProfit,
      marginPct: totalGross > 0 ? data.operatingMarginPct : null,
      tone: "profit",
      emphasized: true,
    },
    {
      label: "Комиссии (факт)",
      amountBani: data.expenses.commission,
      tone: "expense",
    },
    {
      label: "= Чистая прибыль",
      amountBani: data.netProfit,
      marginPct: totalGross > 0 ? data.netMarginPct : null,
      tone: "profit",
      emphasized: true,
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 rounded-xl border border-border bg-muted/30 p-1">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={buildSectionHref(item.href, searchParams)}
              className={
                isActive
                  ? "rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground shadow-sm"
                  : "rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-background/70 hover:text-foreground"
              }
            >
              {item.label}
            </Link>
          )
        })}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Выручка gross" amountBani={data.revenue.totalGross} />
        <MetricCard label="Чистая выручка" amountBani={data.netRevenue} />
        <MetricCard
          label="Валовая прибыль"
          amountBani={data.grossProfit}
          marginPct={totalGross > 0 ? data.grossMarginPct : null}
        />
        <MetricCard
          label="Чистая прибыль"
          amountBani={data.netProfit}
          marginPct={totalGross > 0 ? data.netMarginPct : null}
          amountClassName={`text-2xl ${amountToneClass(data.netProfit)}`}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[3fr_2fr]">
        <Card>
          <CardHeader>
            <CardTitle>Каналы выручки</CardTitle>
            <CardDescription>Структура gross-выручки по каналам оплаты</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Строка</TableHead>
                  <TableHead className="text-right">Сумма MDL</TableHead>
                  <TableHead className="text-right">Доля</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {channelRows.map((row) => (
                  <TableRow key={row.label}>
                    <TableCell>{row.label}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatMdl(row.amountBani)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {formatShare(row.amountBani, totalGross)}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/40 font-semibold">
                  <TableCell>Итого gross</TableCell>
                  <TableCell className="text-right">{formatMdl(totalGross)}</TableCell>
                  <TableCell className="text-right">
                    {totalGross > 0 ? "100%" : "—"}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Комиссии</CardTitle>
            <CardDescription>Расчётные и фактические удержания из gross-выручки</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm">Glovo (расчётная)</span>
                  {data.commissions.glovoActual == null ? (
                    <Badge variant="outline">~расчётная</Badge>
                  ) : null}
                </div>
                <span className="text-sm font-medium text-red-600">
                  {formatExpenseAmount(data.commissions.glovoCalculated)}
                </span>
              </div>

              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm">Glovo (факт)</span>
                  {data.commissions.glovoActual != null ? (
                    <Badge variant="outline">факт</Badge>
                  ) : null}
                </div>
                <span
                  className={
                    data.commissions.glovoActual != null
                      ? "text-sm font-medium text-red-600"
                      : "text-sm text-muted-foreground"
                  }
                >
                  {data.commissions.glovoActual != null
                    ? formatExpenseAmount(data.commissions.glovoActual)
                    : "не внесён"}
                </span>
              </div>

              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm">Банк (расчётная)</span>
                  {data.commissions.bankActual == null ? (
                    <Badge variant="outline">~расчётная</Badge>
                  ) : null}
                </div>
                <span className="text-sm font-medium text-red-600">
                  {formatExpenseAmount(data.commissions.bankCalculated)}
                </span>
              </div>

              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm">Банк (факт)</span>
                  {data.commissions.bankActual != null ? (
                    <Badge variant="outline">факт</Badge>
                  ) : null}
                </div>
                <span
                  className={
                    data.commissions.bankActual != null
                      ? "text-sm font-medium text-red-600"
                      : "text-sm text-muted-foreground"
                  }
                >
                  {data.commissions.bankActual != null
                    ? formatExpenseAmount(data.commissions.bankActual)
                    : "не внесён"}
                </span>
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-4 font-semibold">
                <span>Итого вычетов</span>
                <span className="text-red-600">
                  {formatExpenseAmount(totalDeductions)}
                </span>
              </div>

              <div className="flex items-center justify-between gap-4 font-semibold">
                <span>Чистая выручка</span>
                <span>{formatMdl(data.netRevenue)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>P&amp;L breakdown</CardTitle>
          <CardDescription>Переход от чистой выручки к чистой прибыли</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Строка</TableHead>
                <TableHead className="text-right">Сумма</TableHead>
                <TableHead className="text-right">Маржа от gross</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {waterfallRows.map((row) => {
                const amountText =
                  row.tone === "expense"
                    ? formatExpenseAmount(row.amountBani)
                    : formatSignedProfit(row.amountBani)

                const amountClassName =
                  row.tone === "expense"
                    ? "text-red-600"
                    : row.tone === "profit"
                      ? amountToneClass(row.amountBani)
                      : "text-foreground"

                return (
                  <TableRow
                    key={row.label}
                    className={row.emphasized ? "bg-muted/40 font-semibold" : ""}
                  >
                    <TableCell
                      className={
                        row.nested
                          ? "pl-8 text-xs text-muted-foreground"
                          : "text-sm"
                      }
                    >
                      {row.label}
                    </TableCell>
                    <TableCell className={`text-right font-medium ${amountClassName}`}>
                      {amountText}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {row.marginPct == null ? "—" : formatPct(row.marginPct)}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {data.commissions.glovoActual == null || data.commissions.bankActual == null ? (
        <div className="space-y-3">
          {data.commissions.glovoActual == null ? (
            <Alert>
              <AlertTitle>Фактические выплаты Glovo за период не внесены</AlertTitle>
              <AlertDescription className="space-y-2">
                <p>
                  Комиссия рассчитана по средней ставке ~{formatPct(glovoRatePct)} от
                  gross-выручки Glovo.
                </p>
                <p>
                  <Link
                    href={buildSectionHref("/admin/finances/glovo", searchParams)}
                    className="font-medium underline underline-offset-4"
                  >
                    Внести выплаты Glovo
                  </Link>
                </p>
              </AlertDescription>
            </Alert>
          ) : null}

          {data.commissions.bankActual == null ? (
            <Alert>
              <AlertTitle>Фактическая комиссия банка не внесена</AlertTitle>
              <AlertDescription className="space-y-2">
                <p>
                  Комиссия банка рассчитана по средней ставке{" "}
                  {formatPct(bankRatePct)}.
                </p>
                <p>
                  Для точных данных внесите факт из банковской выписки в расходы
                  с категорией «Комиссия банка (факт)».
                </p>
              </AlertDescription>
            </Alert>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
