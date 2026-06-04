import { Suspense } from "react"
import { endOfMonth, format, startOfMonth } from "date-fns"
import { FeedbackPageClient } from "@/components/admin/feedback/feedback-page-client"
import { fetchFeedbackPageData } from "@/lib/actions/admin/feedback"

export const dynamic = "force-dynamic"

type PageProps = {
  searchParams?: {
    from?: string | string[]
    to?: string | string[]
    brand?: string | string[]
  }
}

function firstParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0]
  return value
}

function isValidYmd(value: string | undefined): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function toYmd(value: Date): string {
  return format(value, "yyyy-MM-dd")
}

function resolveDateRange(searchParams: PageProps["searchParams"]): {
  from: string
  to: string
} {
  const now = new Date()
  const defaultFrom = toYmd(startOfMonth(now))
  const defaultTo = toYmd(endOfMonth(now))

  const from = firstParam(searchParams?.from)
  const to = firstParam(searchParams?.to)

  if (!isValidYmd(from) || !isValidYmd(to) || from > to) {
    return { from: defaultFrom, to: defaultTo }
  }

  return { from, to }
}

export default async function AdminFeedbackPage({ searchParams }: PageProps) {
  const { from, to } = resolveDateRange(searchParams)
  const brand = firstParam(searchParams?.brand)?.trim() || undefined

  const data = await fetchFeedbackPageData(brand, from, to)

  return (
    <Suspense
      fallback={
        <div className="space-y-6 p-6">
          <div className="h-8 w-48 animate-pulse rounded bg-muted" />
          <div className="h-24 animate-pulse rounded-md bg-muted" />
          <div className="h-64 animate-pulse rounded-md bg-muted" />
        </div>
      }
    >
      <FeedbackPageClient
        initialData={data}
        dateFrom={from}
        dateTo={to}
        brandFilter={brand ?? ""}
      />
    </Suspense>
  )
}
