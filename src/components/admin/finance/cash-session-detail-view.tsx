"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { format, parseISO } from "date-fns"
import { ChevronDown, ChevronRight, Pencil } from "lucide-react"
import { CashTransactionActions } from "@/components/admin/cash-sessions/cash-transaction-actions"
import type {
  CashSessionDetail,
  CashSessionDetailTransaction,
} from "@/lib/actions/admin/cash-sessions"
import {
  discrepancyTextClass,
  fmtMdl,
  fmtMdlWithUnit,
} from "@/lib/format/money"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

const CASH_SESSIONS_PATH = "/admin/finance/cash-sessions"

const ACTIONABLE_TX_TYPES = ["expense", "income", "encashment"] as const

const TYPE_FILTERS = [
  { id: "order_payment", label: "Оплаты заказов" },
  { id: "expense", label: "Расходы" },
  { id: "income", label: "Доходы" },
  { id: "encashment", label: "Инкассации" },
  { id: "opening", label: "Открытие" },
] as const

type TypeFilterId = (typeof TYPE_FILTERS)[number]["id"]

type CashSessionDetailViewProps = {
  detail: CashSessionDetail
  canEditTransactions: boolean
}

function formatDateTime(iso: string): string {
  return format(parseISO(iso), "dd.MM.yyyy HH:mm")
}

function formatShortDateTime(iso: string): string {
  return format(parseISO(iso), "dd.MM HH:mm")
}

function formatTime(iso: string): string {
  return format(parseISO(iso), "HH:mm")
}

function formatDurationMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h > 0 && m > 0) return `${h}ч ${m}м`
  if (h > 0) return `${h}ч`
  return `${m}м`
}

function computeDurationMinutes(
  openedAt: string,
  closedAt: string | null,
): number {
  const end = closedAt ? new Date(closedAt) : new Date()
  const ms = end.getTime() - new Date(openedAt).getTime()
  if (!Number.isFinite(ms) || ms < 0) return 0
  return Math.round(ms / 60000)
}

function StatusPill({ status }: { status: "open" | "closed" }) {
  if (status === "open") {
    return (
      <Badge className="border-transparent bg-amber-100 text-amber-800 hover:bg-amber-100">
        Открыта
      </Badge>
    )
  }
  return (
    <Badge className="border-transparent bg-zinc-100 text-zinc-700 hover:bg-zinc-100">
      Закрыта
    </Badge>
  )
}

function MdlAmount({
  bani,
  className,
  showZero = false,
  sign = false,
  suffix = true,
}: {
  bani: number
  className?: string
  showZero?: boolean
  sign?: boolean
  suffix?: boolean
}) {
  if (bani === 0 && !showZero) {
    return <span className="text-muted-foreground">—</span>
  }
  return (
    <span className={cn("tabular-nums", className)}>
      {fmtMdl(bani, { sign })}
      {suffix ? " MDL" : ""}
    </span>
  )
}

function WaterfallRow({
  label,
  bani,
  sign = false,
  valueClassName,
  showZero = false,
  prefix,
}: {
  label: string
  bani: number
  sign?: boolean
  valueClassName?: string
  showZero?: boolean
  prefix?: string
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5">
      <span className="text-sm">{label}</span>
      <span className={cn("text-sm tabular-nums", valueClassName)}>
        {bani === 0 && !showZero ? (
          <span className="text-muted-foreground">—</span>
        ) : prefix ? (
          <>
            {prefix}
            {fmtMdl(bani)} MDL
          </>
        ) : (
          <>
            {fmtMdl(bani, sign ? { sign: true } : undefined)} MDL
          </>
        )}
      </span>
    </div>
  )
}

function transactionTypeLabel(
  type: CashSessionDetailTransaction["type"],
): string {
  switch (type) {
    case "opening":
      return "Открытие"
    case "order_payment":
      return "Оплата заказа"
    case "expense":
      return "Расход"
    case "income":
      return "Доход"
    case "encashment":
      return "Инкассация"
    default:
      return type
  }
}

function channelLabel(
  mode: CashSessionDetailTransaction["order_delivery_mode"],
): string | null {
  switch (mode) {
    case "delivery":
      return "Доставка"
    case "pickup":
      return "Самовывоз"
    case "aggregator":
      return "Glovo"
    default:
      return null
  }
}

function truncateText(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text
  return `${text.slice(0, maxLen)}…`
}

function transactionDescription(tx: CashSessionDetailTransaction): string {
  return (
    tx.description?.trim() ||
    tx.category?.trim() ||
    tx.encashment_destination?.trim() ||
    ""
  )
}

export function CashSessionDetailView({
  detail,
  canEditTransactions,
}: CashSessionDetailViewProps) {
  const { session, totals, by_brand, transactions, glovo_card_orders } = detail

  const [glovoOrdersExpanded, setGlovoOrdersExpanded] = useState(false)
  const [activeTypes, setActiveTypes] = useState<Set<TypeFilterId>>(
    () => new Set(TYPE_FILTERS.map((f) => f.id)),
  )
  const [showVoided, setShowVoided] = useState(true)

  const durationMinutes = computeDurationMinutes(
    session.opened_at,
    session.closed_at,
  )

  const expectedBalanceBani =
    session.closing_balance_expected_bani ??
    session.opening_balance_bani +
      totals.own_cash_in_bani +
      totals.glovo_cash_in_bani +
      totals.income_bani -
      totals.expense_bani -
      totals.encashment_bani

  const sortedByBrand = useMemo(
    () =>
      [...by_brand].sort(
        (a, b) => b.gross_revenue_bani - a.gross_revenue_bani,
      ),
    [by_brand],
  )

  const brandTotals = useMemo(() => {
    return sortedByBrand.reduce(
      (acc, row) => ({
        orders_count: acc.orders_count + row.orders_count,
        own_cash_in_bani: acc.own_cash_in_bani + row.own_cash_in_bani,
        own_card_in_bani: acc.own_card_in_bani + row.own_card_in_bani,
        glovo_cash_in_bani: acc.glovo_cash_in_bani + row.glovo_cash_in_bani,
        glovo_card_bani: acc.glovo_card_bani + row.glovo_card_bani,
        gross_revenue_bani: acc.gross_revenue_bani + row.gross_revenue_bani,
      }),
      {
        orders_count: 0,
        own_cash_in_bani: 0,
        own_card_in_bani: 0,
        glovo_cash_in_bani: 0,
        glovo_card_bani: 0,
        gross_revenue_bani: 0,
      },
    )
  }, [sortedByBrand])

  const allTypesActive = activeTypes.size === TYPE_FILTERS.length

  const filteredTransactions = useMemo(() => {
    return [...transactions]
      .filter((tx) => {
        if (!showVoided && tx.voided_at) return false
        if (!activeTypes.has(tx.type as TypeFilterId)) return false
        return true
      })
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      )
  }, [transactions, activeTypes, showVoided])

  function toggleType(typeId: TypeFilterId) {
    setActiveTypes((prev) => {
      const next = new Set(prev)
      if (next.has(typeId)) next.delete(typeId)
      else next.add(typeId)
      return next
    })
  }

  function selectAllTypes() {
    setActiveTypes(new Set(TYPE_FILTERS.map((f) => f.id)))
  }

  const discrepancy = session.discrepancy_bani ?? 0
  const absDiscrepancyMdl = Math.abs(discrepancy / 100)

  return (
    <div className="space-y-6 p-6">
      <div>
        <Link
          href={CASH_SESSIONS_PATH}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Все смены
        </Link>

        <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-2xl font-medium">
            Смена {formatDateTime(session.opened_at)}
          </h1>
          <StatusPill status={session.status} />
        </div>

        <p className="mt-2 text-sm text-muted-foreground">
          Оператор: {session.opened_by?.name ?? "—"}
          {" · "}
          Длительность: {formatDurationMinutes(durationMinutes)}
          {session.status === "closed" ? (
            <>
              {" · "}
              Закрыл: {session.closed_by?.name ?? "—"}
              {session.closed_at
                ? ` в ${formatShortDateTime(session.closed_at)}`
                : ""}
            </>
          ) : null}
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Баланс кассы</h2>
        <Card className="p-6">
          <CardContent className="space-y-0 px-0 py-0">
            <WaterfallRow
              label="Стартовый баланс"
              bani={session.opening_balance_bani}
              showZero
            />
            <div className="my-2 border-t" />
            <WaterfallRow
              label="+ Наличные от заказов"
              bani={totals.own_cash_in_bani}
              prefix="+"
              valueClassName={
                totals.own_cash_in_bani > 0
                  ? "text-emerald-600"
                  : "text-muted-foreground"
              }
            />
            <WaterfallRow
              label="+ Glovo наличные"
              bani={totals.glovo_cash_in_bani}
              prefix="+"
              valueClassName={
                totals.glovo_cash_in_bani > 0
                  ? "text-emerald-600"
                  : "text-muted-foreground"
              }
            />
            <WaterfallRow
              label="+ Доходы (ручные)"
              bani={totals.income_bani}
              prefix="+"
              valueClassName={
                totals.income_bani > 0
                  ? "text-emerald-600"
                  : "text-muted-foreground"
              }
            />
            <WaterfallRow
              label="− Расходы (ручные)"
              bani={totals.expense_bani}
              prefix="−"
              valueClassName={
                totals.expense_bani > 0
                  ? "text-red-600"
                  : "text-muted-foreground"
              }
            />
            <WaterfallRow
              label="− Инкассации"
              bani={totals.encashment_bani}
              prefix="−"
              valueClassName={
                totals.encashment_bani > 0
                  ? "text-red-600"
                  : "text-muted-foreground"
              }
            />
            <div className="my-2 border-t" />
            <WaterfallRow
              label="= Ожидаемый баланс"
              bani={expectedBalanceBani}
              showZero
              valueClassName="font-semibold"
            />

            {session.status === "closed" ? (
              <>
                <WaterfallRow
                  label="Фактический баланс"
                  bani={session.closing_balance_actual_bani ?? 0}
                  showZero
                  valueClassName="font-semibold"
                />
                <WaterfallRow
                  label="Расхождение"
                  bani={discrepancy}
                  sign
                  showZero
                  valueClassName={cn(
                    "font-semibold",
                    discrepancyTextClass(absDiscrepancyMdl),
                  )}
                />
                {session.discrepancy_reason ? (
                  <p className="mt-3 text-sm text-muted-foreground italic">
                    Причина: &ldquo;{session.discrepancy_reason}&rdquo;
                  </p>
                ) : null}
              </>
            ) : null}
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Выручка по каналам</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Касса (свои)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tabular-nums">
                {fmtMdlWithUnit(
                  totals.own_cash_in_bani + totals.own_card_in_bani,
                )}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Нал {fmtMdl(totals.own_cash_in_bani)} · Карта{" "}
                {fmtMdl(totals.own_card_in_bani)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Glovo наличные
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tabular-nums">
                {fmtMdlWithUnit(totals.glovo_cash_in_bani)}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Через ящик</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-[#ccff00]">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Glovo карта
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tabular-nums">
                {fmtMdlWithUnit(totals.glovo_card_bani)}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Не в ящике · {glovo_card_orders.length} заказов
              </p>
            </CardContent>
          </Card>
        </div>

        <p className="text-center text-sm font-semibold tabular-nums">
          Итого оборот за смену: {fmtMdlWithUnit(totals.gross_revenue_bani)}
        </p>
      </section>

      {sortedByBrand.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-lg font-medium">По брендам</h2>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Бренд</TableHead>
                  <TableHead className="text-right">Заказов</TableHead>
                  <TableHead className="text-right">Нал свои</TableHead>
                  <TableHead className="text-right">Карта свои</TableHead>
                  <TableHead className="text-right">Glovo нал</TableHead>
                  <TableHead className="text-right">Glovo карта</TableHead>
                  <TableHead className="text-right font-semibold">
                    Оборот
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedByBrand.map((row) => (
                  <TableRow key={row.brand_id}>
                    <TableCell className="font-medium">
                      {row.brand_name}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.orders_count}
                    </TableCell>
                    <TableCell className="text-right">
                      <MdlAmount bani={row.own_cash_in_bani} suffix={false} />
                    </TableCell>
                    <TableCell className="text-right">
                      <MdlAmount bani={row.own_card_in_bani} suffix={false} />
                    </TableCell>
                    <TableCell className="text-right">
                      <MdlAmount bani={row.glovo_cash_in_bani} suffix={false} />
                    </TableCell>
                    <TableCell className="text-right">
                      <MdlAmount bani={row.glovo_card_bani} suffix={false} />
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      <MdlAmount
                        bani={row.gross_revenue_bani}
                        suffix={false}
                      />
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="border-t-2 font-semibold">
                  <TableCell>Итого</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {brandTotals.orders_count}
                  </TableCell>
                  <TableCell className="text-right">
                    <MdlAmount
                      bani={brandTotals.own_cash_in_bani}
                      suffix={false}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <MdlAmount
                      bani={brandTotals.own_card_in_bani}
                      suffix={false}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <MdlAmount
                      bani={brandTotals.glovo_cash_in_bani}
                      suffix={false}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <MdlAmount
                      bani={brandTotals.glovo_card_bani}
                      suffix={false}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <MdlAmount
                      bani={brandTotals.gross_revenue_bani}
                      suffix={false}
                    />
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </section>
      ) : null}

      {glovo_card_orders.length > 0 ? (
        <section className="space-y-3">
          <button
            type="button"
            className="flex w-full items-center gap-2 text-left text-lg font-medium"
            onClick={() => setGlovoOrdersExpanded((v) => !v)}
          >
            {glovoOrdersExpanded ? (
              <ChevronDown className="size-5 shrink-0" />
            ) : (
              <ChevronRight className="size-5 shrink-0" />
            )}
            Glovo заказы (карта) · {glovo_card_orders.length}
          </button>

          {glovoOrdersExpanded ? (
            <div className="max-h-[360px] overflow-y-auto rounded-lg border">
              <ul className="divide-y">
                {glovo_card_orders.map((order) => (
                  <li
                    key={order.id}
                    className="px-4 py-2.5 text-sm tabular-nums"
                  >
                    {formatTime(order.paid_at)}
                    {"  ·  "}
                    #{order.id.slice(0, 8)}
                    {"  ·  "}
                    {order.brand_slug}
                    {"  ·  "}
                    {fmtMdlWithUnit(order.total_bani)}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-lg font-medium">
          Транзакции · {transactions.length}
        </h2>

        <div className="flex flex-wrap gap-2">
          <FilterChip
            label="Все"
            active={allTypesActive}
            onClick={selectAllTypes}
          />
          {TYPE_FILTERS.map((filter) => (
            <FilterChip
              key={filter.id}
              label={filter.label}
              active={activeTypes.has(filter.id)}
              onClick={() => toggleType(filter.id)}
            />
          ))}
          <FilterChip
            label="Отменённые"
            active={showVoided}
            onClick={() => setShowVoided((v) => !v)}
          />
        </div>

        {filteredTransactions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            По выбранным фильтрам транзакций нет
          </p>
        ) : (
          <div className="max-h-[600px] overflow-y-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="sticky top-0 z-10 bg-card hover:bg-card">
                  <TableHead>Время</TableHead>
                  <TableHead>Тип</TableHead>
                  <TableHead>Способ</TableHead>
                  <TableHead>Канал</TableHead>
                  <TableHead>Бренд</TableHead>
                  <TableHead className="text-right">Сумма</TableHead>
                  <TableHead>Описание</TableHead>
                  <TableHead>Оператор</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead className="text-right">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransactions.map((tx) => (
                  <TransactionRow
                    key={tx.id}
                    tx={tx}
                    canEdit={canEditTransactions}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </div>
  )
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <Button
      type="button"
      variant={active ? "default" : "outline"}
      size="sm"
      className={cn(
        "h-8 rounded-full px-3",
        active &&
          "bg-[#242424] text-white hover:bg-[#242424]/90 dark:bg-[#242424]",
      )}
      onClick={onClick}
    >
      {label}
    </Button>
  )
}

function TransactionRow({
  tx,
  canEdit,
}: {
  tx: CashSessionDetailTransaction
  canEdit: boolean
}) {
  const isVoided = tx.voided_at != null
  const isEdited = tx.edited_at != null
  const description = transactionDescription(tx)
  const channel = channelLabel(tx.order_delivery_mode)
  const showActions = (ACTIONABLE_TX_TYPES as readonly string[]).includes(
    tx.type,
  )

  const voidTitle = isVoided
    ? `Причина: ${tx.void_reason ?? "—"} · ${tx.voided_by_name ?? "—"} · ${tx.voided_at ? formatTime(tx.voided_at) : "—"}`
    : undefined

  const showPaymentMethod =
    tx.type === "order_payment" ||
    (tx.type === "opening" && tx.payment_method != null)

  return (
    <TableRow className={isVoided ? "text-muted-foreground" : undefined}>
      <TableCell className="tabular-nums">{formatTime(tx.created_at)}</TableCell>
      <TableCell>{transactionTypeLabel(tx.type)}</TableCell>
      <TableCell>
        {showPaymentMethod && tx.payment_method ? (
          <Badge variant="outline">
            {tx.payment_method === "cash" ? "Нал" : "Карта"}
          </Badge>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell>
        {channel ? (
          <Badge variant="secondary" className="text-xs">
            {channel}
          </Badge>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell>{tx.order_brand_slug ?? "—"}</TableCell>
      <TableCell className="text-right">
        <div
          className={cn(
            "inline-flex flex-wrap items-center justify-end gap-1.5",
            isVoided && "opacity-50",
          )}
        >
          <span
            className={cn(
              "tabular-nums",
              isVoided && "line-through",
              !isVoided &&
                (tx.direction === "in"
                  ? "text-emerald-600"
                  : "text-red-600"),
            )}
          >
            {tx.direction === "in" ? "+" : "−"}
            {fmtMdl(tx.amount_bani)} MDL
          </span>
          {isEdited && !isVoided ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex shrink-0">
                  <Pencil className="size-3 text-muted-foreground" />
                </span>
              </TooltipTrigger>
              <TooltipContent>Отредактировано</TooltipContent>
            </Tooltip>
          ) : null}
          {isVoided ? (
            <Badge
              variant="destructive"
              className="text-xs"
              title={voidTitle}
            >
              Аннулировано
            </Badge>
          ) : null}
        </div>
      </TableCell>
      <TableCell
        className="max-w-[180px] truncate"
        title={description || undefined}
      >
        {description ? (
          truncateText(description, 40)
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell>{tx.created_by_name ?? "—"}</TableCell>
      <TableCell>
        {isVoided ? (
          <Badge
            variant="secondary"
            className="bg-zinc-100 text-zinc-700 hover:bg-zinc-100"
            title={voidTitle}
          >
            Отменено
          </Badge>
        ) : null}
      </TableCell>
      <TableCell className="text-right">
        {showActions ? (
          <CashTransactionActions
            transaction={{
              id: tx.id,
              type: tx.type,
              amount_bani: tx.amount_bani,
              description: tx.description,
              category: tx.category,
              voided_at: tx.voided_at,
            }}
            canEdit={canEdit}
          />
        ) : null}
      </TableCell>
    </TableRow>
  )
}
