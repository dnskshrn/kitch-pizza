import { CheckCircle2 } from "lucide-react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

type PaymentSuccessPageProps = {
  searchParams: { orderId?: string; payId?: string }
}

type OrderSuccessRow = {
  id: string
  order_number: number
  status: string
  paid_at: string | null
}

function pickSearchParam(
  value: string | string[] | undefined,
): string | undefined {
  if (typeof value === "string") return value.trim() || undefined
  if (Array.isArray(value) && typeof value[0] === "string") {
    const trimmed = value[0].trim()
    return trimmed || undefined
  }
  return undefined
}

async function loadOrder(
  orderId: string | undefined,
): Promise<OrderSuccessRow | null> {
  if (!orderId) return null

  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("orders")
      .select("id, order_number, status, paid_at")
      .eq("id", orderId)
      .maybeSingle()

    if (error || !data) return null
    return data as OrderSuccessRow
  } catch {
    return null
  }
}

export default async function PaymentSuccessPage({
  searchParams,
}: PaymentSuccessPageProps) {
  const orderId = pickSearchParam(searchParams.orderId)
  const order = await loadOrder(orderId)
  const orderNumber =
    order?.order_number != null && Number.isFinite(order.order_number)
      ? order.order_number
      : null

  return (
    <main className="flex min-h-[calc(100vh-120px)] flex-1 items-center justify-center px-4 py-12">
      <div className="flex w-full max-w-md flex-col items-center text-center text-[var(--color-text)]">
        <CheckCircle2
          className="mb-6 size-20 text-emerald-600"
          strokeWidth={1.5}
          aria-hidden
        />

        <h1 className="text-2xl font-semibold leading-tight">
          Plată reușită! / Оплата прошла!
        </h1>

        {orderNumber != null ? (
          <p className="mt-3 text-lg font-medium">
            Comanda #{orderNumber} / Заказ #{orderNumber}
          </p>
        ) : null}

        <p className="mt-4 text-base text-[#808080]">
          Bucătăria a primit comanda ta. / Кухня получила ваш заказ.
        </p>

        <div className="mt-10 flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/account"
            className="inline-flex min-h-[48px] flex-1 items-center justify-center rounded-[12px] bg-[var(--color-accent)] px-6 py-3 text-base font-semibold text-[var(--color-accent-text)] transition-all hover:brightness-95 active:scale-[0.98] sm:flex-initial sm:min-w-[180px]"
          >
            Contul meu / Мой аккаунт
          </Link>
          <Link
            href="/"
            className="inline-flex min-h-[48px] flex-1 items-center justify-center rounded-[12px] border border-[#e0e0e0] bg-[var(--color-bg)] px-6 py-3 text-base font-semibold text-[var(--color-text)] transition-all hover:bg-[#f2f2f2] active:scale-[0.98] sm:flex-initial sm:min-w-[180px]"
          >
            Meniu / Меню
          </Link>
        </div>
      </div>
    </main>
  )
}
