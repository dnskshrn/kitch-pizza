import { Suspense } from "react"
import { CustomersPageClient } from "@/components/admin/customers/customers-page-client"

export const dynamic = "force-dynamic"

type PageProps = {
  searchParams: Record<string, string | string[] | undefined>
}

function parseSearch(raw: string | string[] | undefined): string {
  if (raw == null) return ""
  const s = Array.isArray(raw) ? raw[0] : raw
  return typeof s === "string" ? s.trim() : ""
}

function parsePage(raw: string | string[] | undefined): number {
  if (raw == null) return 1
  const s = Array.isArray(raw) ? raw[0] : raw
  const n = parseInt(typeof s === "string" ? s : "", 10)
  return Number.isFinite(n) && n >= 1 ? n : 1
}

export default function AdminCustomersPage({ searchParams }: PageProps) {
  const initialSearch = parseSearch(searchParams.search)
  const initialPage = parsePage(searchParams.page)

  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <div className="h-8 w-48 animate-pulse rounded bg-muted" />
          <div className="h-64 animate-pulse rounded-md bg-muted" />
        </div>
      }
    >
      <CustomersPageClient
        initialSearch={initialSearch}
        initialPage={initialPage}
      />
    </Suspense>
  )
}
