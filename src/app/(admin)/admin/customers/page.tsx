import Link from "next/link"
import { createServiceSupabaseClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Search } from "lucide-react"

export const dynamic = "force-dynamic"

type PageProps = {
  searchParams: Record<string, string | string[] | undefined>
}

function parseQ(
  raw: string | string[] | undefined,
): { display: string; rpc: string | null } {
  if (raw == null) return { display: "", rpc: null }
  const s = Array.isArray(raw) ? raw[0] : raw
  const t = typeof s === "string" ? s.trim() : ""
  if (t === "") return { display: "", rpc: null }
  return { display: t, rpc: t }
}

function formatDateDdMmYyyy(raw: string | null): string {
  if (raw == null || raw === "") return "—"
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

function formatLtvMdlFromBani(bani: number): string {
  if (!Number.isFinite(bani)) return "—"
  const lei = bani / 100
  const formatted = lei.toLocaleString("ro-MD", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return `${formatted} MDL`
}

type ListRow = {
  id: string
  phone: string | null
  name: string | null
  order_count: number
  ltv: number
  bonus_balance: number
  first_order_at: string | null
  last_order_at: string | null
}

export default async function AdminCustomersPage({ searchParams }: PageProps) {
  const { display: qDisplay, rpc: qRpc } = parseQ(searchParams.q)

  let supabase: ReturnType<typeof createServiceSupabaseClient>
  try {
    supabase = createServiceSupabaseClient()
  } catch (e) {
    return (
      <p className="text-destructive">
        Не удалось подключиться к базе:{" "}
        {e instanceof Error ? e.message : "ошибка конфигурации"}
      </p>
    )
  }

  const { data, error } = await supabase.rpc("admin_customers_list", {
    search_q: qRpc,
  })

  if (error) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Клиенты</h1>
        <p className="text-destructive">
          Не удалось загрузить клиентов: {error.message}
        </p>
        <p className="text-muted-foreground text-sm">
          Убедитесь, что применена миграция с функцией{" "}
          <code className="font-mono text-xs">admin_customers_list</code>.
        </p>
      </div>
    )
  }

  const rows: ListRow[] = (data ?? []).map((r: Record<string, unknown>) => ({
    id: String(r.id),
    phone: r.phone != null ? String(r.phone) : null,
    name: r.name != null ? String(r.name) : null,
    order_count: Number(r.order_count ?? 0),
    ltv: Number(r.ltv ?? 0),
    bonus_balance: Number(r.bonus_balance ?? 0),
    first_order_at:
      r.first_order_at != null ? String(r.first_order_at) : null,
    last_order_at: r.last_order_at != null ? String(r.last_order_at) : null,
  }))

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold">Клиенты</h1>
        <form
          method="get"
          action="/admin/customers"
          className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center"
        >
          <Input
            name="q"
            type="search"
            placeholder="Поиск по телефону…"
            defaultValue={qDisplay}
            className="sm:w-64"
            autoComplete="off"
          />
          <Button type="submit" variant="secondary" className="gap-2 sm:shrink-0">
            <Search className="h-4 w-4" />
            Поиск
          </Button>
        </form>
      </div>

      {rows.length === 0 ? (
        <p className="text-muted-foreground py-12 text-center">
          Клиентов пока нет
        </p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Телефон</TableHead>
                <TableHead>Имя</TableHead>
                <TableHead className="text-right">Заказов</TableHead>
                <TableHead className="text-right">LTV (MDL)</TableHead>
                <TableHead className="text-right">Бонусов</TableHead>
                <TableHead>Первый заказ</TableHead>
                <TableHead>Последний заказ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-mono tabular-nums">
                    <Link
                      href={`/admin/customers/${row.id}`}
                      className="text-foreground underline-offset-4 hover:underline"
                    >
                      {row.phone ?? "—"}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {row.name != null && row.name.trim() !== ""
                      ? row.name
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.order_count}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatLtvMdlFromBani(row.ltv)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {Number.isFinite(row.bonus_balance)
                      ? Math.round(row.bonus_balance)
                      : "—"}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {formatDateDdMmYyyy(row.first_order_at)}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {formatDateDdMmYyyy(row.last_order_at)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  )
}
