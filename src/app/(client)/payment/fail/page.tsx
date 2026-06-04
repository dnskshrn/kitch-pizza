import { XCircle } from "lucide-react"
import Link from "next/link"

type PaymentFailPageProps = {
  searchParams: { orderId?: string; payId?: string }
}

export default function PaymentFailPage(_props: PaymentFailPageProps) {
  return (
    <main className="flex min-h-[calc(100vh-120px)] flex-1 items-center justify-center px-4 py-12">
      <div className="flex w-full max-w-md flex-col items-center text-center text-[var(--color-text)]">
        <XCircle
          className="mb-6 size-20 text-[#808080]"
          strokeWidth={1.5}
          aria-hidden
        />

        <h1 className="text-2xl font-semibold leading-tight">
          Plată eșuată / Оплата не прошла
        </h1>

        <p className="mt-4 text-base text-[#808080]">
          Încearcă din nou sau alege altă metodă de plată. / Попробуйте ещё раз
          или выберите другой способ оплаты.
        </p>

        <Link
          href="/"
          className="mt-10 inline-flex min-h-[48px] min-w-[220px] items-center justify-center rounded-[12px] bg-[var(--color-accent)] px-8 py-3 text-base font-semibold text-[var(--color-accent-text)] transition-all hover:brightness-95 active:scale-[0.98]"
        >
          Înapoi la meniu / Назад в меню
        </Link>
      </div>
    </main>
  )
}
