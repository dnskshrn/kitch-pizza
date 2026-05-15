import Link from "next/link"
import { notFound } from "next/navigation"
import { getUserBalance } from "@/lib/bonus"
import { createServiceSupabaseClient } from "@/lib/supabase/server"
import { cn } from "@/lib/utils"
import { BonusAdjustForm } from "./bonus-adjust-form"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export const dynamic = "force-dynamic"

const STATUS_LABEL_RU: Record<string, string> = {
  draft: "Черновик",
  new: "Новый",
  confirmed: "Принят",
  cooking: "Готовится",
  ready: "Готов",
  delivery: "Доставляется",
  done: "Доставлен",
  cancelled: "Отменён",
  rejected: "Отклонён",
}

function orderStatusLabel(status: string): string {
  return STATUS_LABEL_RU[status] ?? status
}

function formatCustomerDate(iso: string | null): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  return new Intl.DateTimeFormat("ro-MD", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d)
}

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat("ro-MD", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d)
}

function formatLtvMdl(bani: number): string {
  const lei = bani / 100
  const formatted = lei.toLocaleString("ro-MD", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
  return `${formatted} MDL`
}

function bonusTypeLabel(type: string): string {
  switch (type) {
    case "accrual":
      return "Начисление"
    case "redemption":
      return "Списание"
    case "manual_add":
      return "Ручное начисление"
    case "manual_deduct":
      return "Ручное списание"
    default:
      return type
  }
}

function BrandBadge({ slug }: { slug: string | null }) {
  const label = slug ?? "—"
  const losos = slug === "losos"
  const spot = slug === "the-spot"
  return (
    <span
      className={cn(
        "inline-flex shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide",
        losos && "bg-[#ffe8dc] text-[#242424]",
        spot && "bg-[#242424] text-[#ccff00]",
        !losos && !spot && "bg-[#f2f2f2] text-[#242424]",
      )}
    >
      {label}
    </span>
  )
}

type BonusTxRow = {
  created_at: string
  type: string
  amount: number
  balance_after: number
  note: string | null
}

export default async function AdminCustomerDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const { id } = params
  const supabase = createServiceSupabaseClient()

  const { data: profile, error: pe } = await supabase
    .from("profiles")
    .select("id, phone, name")
    .eq("id", id)
    .maybeSingle()

  if (pe || !profile || typeof profile.id !== "string") {
    notFound()
  }

  const { data: doneRows } = await supabase
    .from("orders")
    .select("total, created_at")
    .eq("profile_id", id)
    .eq("status", "done")

  let orderCount = 0
  let ltvBani = 0
  let firstOrder: string | null = null
  const doneList = doneRows ?? []
  if (doneList.length > 0) {
    orderCount = doneList.length
    let minT = Infinity
    for (const r of doneList) {
      ltvBani += Number(r.total) || 0
      const t = new Date(r.created_at).getTime()
      if (!Number.isNaN(t) && t < minT) minT = t
    }
    if (minT !== Infinity) firstOrder = new Date(minT).toISOString()
  }

  const bonusBalance = await getUserBalance(id)

  const { data: bonusTxData } = await (supabase.from("bonus_transactions") as any)
    .select("created_at, type, amount, balance_after, note")
    .eq("profile_id", id)
    .order("created_at", { ascending: false })

  const bonusRows = (bonusTxData ?? []) as BonusTxRow[]

  const { data: ordRows } = await supabase
    .from("orders")
    .select("id, order_number, created_at, total, status, brand_id")
    .eq("profile_id", id)
    .order("created_at", { ascending: false })
    .limit(10)

  type OrderRow = {
    id: string
    order_number: number
    created_at: string
    total: number
    status: string
    brand_id: string
  }

  const ordersList = (ordRows ?? []) as OrderRow[]
  const brandIds = [...new Set(ordersList.map((r) => r.brand_id).filter(Boolean))]
  let slugById: Record<string, string> = {}
  if (brandIds.length > 0) {
    const { data: brands } = await supabase
      .from("brands")
      .select("id, slug")
      .in("id", brandIds)
    for (const b of brands ?? []) {
      if (b && typeof b.id === "string" && typeof b.slug === "string") {
        slugById[b.id] = b.slug
      }
    }
  }

  const phone = profile.phone ?? "—"
  const name = profile.name?.trim() ? profile.name : "—"

  const { data: bonusStaffRow } = await supabase
    .from("staff")
    .select("id")
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()

  const bonusAdjustStaffId =
    bonusStaffRow != null &&
    typeof bonusStaffRow.id === "string"
      ? bonusStaffRow.id
      : ""

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link
          href="/admin/customers"
          className="text-sm text-[#808080] underline-offset-4 hover:text-[#242424] hover:underline"
        >
          ← Клиенты
        </Link>
      </div>

      <header className="space-y-2 text-[#242424]">
        <p className="text-lg font-semibold">
          {phone} · {name} · {bonusBalance} бонусов
        </p>
        <p className="text-sm text-[#808080]">
          {orderCount}{" "}
          {orderCount === 1
            ? "заказ"
            : orderCount >= 2 && orderCount <= 4
              ? "заказа"
              : "заказов"}{" "}
          · LTV {formatLtvMdl(ltvBani)}
          {firstOrder ? ` · с ${formatCustomerDate(firstOrder)}` : ""}
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-base font-bold text-[#242424]">
          История бонусов
        </h2>
        <div className="rounded-md border border-[#f2f2f2] bg-white">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Дата</TableHead>
                <TableHead>Тип</TableHead>
                <TableHead className="text-right">Сумма</TableHead>
                <TableHead className="text-right">Баланс после</TableHead>
                <TableHead>Примечание</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bonusRows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center text-[#808080]"
                  >
                    Нет операций
                  </TableCell>
                </TableRow>
              ) : (
                bonusRows.map((row, idx) => (
                  <TableRow key={`${row.created_at}-${idx}`}>
                    <TableCell className="whitespace-nowrap text-sm">
                      {formatDateTime(row.created_at)}
                    </TableCell>
                    <TableCell>{bonusTypeLabel(row.type)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {Number(row.amount)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {Number(row.balance_after)}
                    </TableCell>
                    <TableCell className="max-w-[280px] truncate text-sm text-[#808080]">
                      {row.note ?? "—"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-bold text-[#242424]">
          Ручная корректировка
        </h2>
        <BonusAdjustForm profileId={id} staffId={bonusAdjustStaffId} />
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-bold text-[#242424]">
          Последние заказы
        </h2>
        <div className="rounded-md border border-[#f2f2f2] bg-white">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>№</TableHead>
                <TableHead>Дата</TableHead>
                <TableHead className="text-right">Сумма</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead>Бренд</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ordersList.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center text-[#808080]"
                  >
                    Нет заказов
                  </TableCell>
                </TableRow>
              ) : (
                ordersList.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-mono">
                      #{o.order_number}
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatCustomerDate(o.created_at)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatLtvMdl(Number(o.total))}
                    </TableCell>
                    <TableCell className="text-sm">
                      {orderStatusLabel(o.status)}
                    </TableCell>
                    <TableCell>
                      <BrandBadge slug={slugById[o.brand_id] ?? null} />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  )
}
