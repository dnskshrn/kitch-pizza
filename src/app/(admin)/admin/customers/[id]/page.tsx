import Link from "next/link"
import { notFound } from "next/navigation"
import { createServiceSupabaseClient } from "@/lib/supabase/server"
import { getActualBalance } from "@/lib/admin/get-actual-balance"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { BonusAdjustForm } from "./bonus-adjust-form"

export const dynamic = "force-dynamic"

function bonusTypeLabel(type: string): string {
  switch (type) {
    case "accrual":
      return "Начисление за заказ"
    case "redemption":
      return "Списание при заказе"
    case "manual_add":
      return "Ручное начисление"
    case "manual_deduct":
      return "Ручное списание"
    default:
      return type
  }
}

function orderStatusLabel(status: string): string {
  if (status === "cooking" || status === "confirmed" || status === "new") {
    return "В работе"
  }
  if (status === "ready") return "Готов"
  if (status === "delivery") return "В доставке"
  if (status === "done") return "Выдан"
  if (status === "cancelled" || status === "rejected") return "Отменён"
  if (status === "draft") return "Черновик"
  return status
}

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d)
}

function formatOrderDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d)
}

function formatOrderTotalMdl(totalBani: number): string {
  const lei = totalBani / 100
  return `${lei.toLocaleString("ro-MD", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MDL`
}

type BonusTxRow = {
  id: string
  type: string
  amount: number
  balance_after: number
  note: string | null
  order_id: string | null
  created_at: string
}

type OrderRow = {
  id: string
  order_number: number
  total: number
  status: string
  created_at: string
}

export default async function AdminCustomerDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const { id } = params

  let supabase: ReturnType<typeof createServiceSupabaseClient>
  try {
    supabase = createServiceSupabaseClient()
  } catch {
    notFound()
  }

  const [
    profileRes,
    bonusBalance,
    txRes,
    ordersRes,
    staffRes,
  ] = await Promise.all([
    supabase.from("profiles").select("id, phone, name").eq("id", id).maybeSingle(),
    getActualBalance(id),
    supabase
      .from("bonus_transactions")
      .select("id, type, amount, balance_after, note, order_id, created_at")
      .eq("profile_id", id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("orders")
      .select("id, order_number, total, status, created_at")
      .eq("profile_id", id)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("staff")
      .select("id")
      .eq("is_active", true)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
  ])

  if (profileRes.error || !profileRes.data?.id) {
    notFound()
  }

  const profile = profileRes.data
  const phoneDisplay = profile.phone?.trim() ? profile.phone : "—"
  const nameDisplay =
    profile.name != null && profile.name.trim() !== "" ? profile.name : "—"

  const bonusRows = (txRes.data ?? []) as BonusTxRow[]
  const ordersList = (ordersRes.data ?? []) as OrderRow[]

  const auditStaffId =
    staffRes.data != null && typeof staffRes.data.id === "string"
      ? staffRes.data.id
      : null

  return (
    <div className="space-y-8">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/admin/customers">Клиенты</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage className="font-mono">{phoneDisplay}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <header className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          {nameDisplay}
        </h1>
        <p className="text-xl text-muted-foreground">
          <span className="font-mono">{phoneDisplay}</span>
          {" · "}
          <span className="font-medium text-foreground">
            {Number.isFinite(bonusBalance) ? Math.round(bonusBalance) : 0} бонусов
          </span>
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Корректировка бонусов</h2>
        <BonusAdjustForm profileId={id} staffId={auditStaffId} />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">История бонусов</h2>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Дата</TableHead>
                <TableHead>Тип</TableHead>
                <TableHead className="text-right">Сумма</TableHead>
                <TableHead className="text-right">Баланс после</TableHead>
                <TableHead>Комментарий</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bonusRows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center text-muted-foreground"
                  >
                    Нет операций
                  </TableCell>
                </TableRow>
              ) : (
                bonusRows.map((row) => {
                  const amt = Number(row.amount)
                  const signLabel =
                    amt > 0
                      ? `+${amt}`
                      : amt < 0
                        ? `−${Math.abs(amt)}`
                        : String(amt)
                  return (
                    <TableRow key={row.id}>
                      <TableCell className="whitespace-nowrap">
                        {formatDateTime(row.created_at)}
                      </TableCell>
                      <TableCell>{bonusTypeLabel(row.type)}</TableCell>
                      <TableCell
                        className={`text-right tabular-nums font-medium ${
                          amt > 0
                            ? "text-green-600"
                            : amt < 0
                              ? "text-red-600"
                              : "text-foreground"
                        }`}
                      >
                        {signLabel}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {Number(row.balance_after)}
                      </TableCell>
                      <TableCell className="max-w-[320px] truncate text-muted-foreground">
                        {row.note?.trim() ? row.note : "—"}
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Последние заказы</h2>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>№ заказа</TableHead>
                <TableHead>Дата</TableHead>
                <TableHead className="text-right">Сумма</TableHead>
                <TableHead>Статус</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ordersList.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="text-center text-muted-foreground"
                  >
                    Нет заказов
                  </TableCell>
                </TableRow>
              ) : (
                ordersList.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-mono tabular-nums">
                      {o.order_number}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {formatOrderDate(o.created_at)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatOrderTotalMdl(Number(o.total))}
                    </TableCell>
                    <TableCell>{orderStatusLabel(o.status)}</TableCell>
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
