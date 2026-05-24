"use client"

import { useCallback, useEffect, useState, useTransition } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { getCustomersList } from "@/lib/actions/admin/customers-list"
import { CustomersFilters } from "@/components/admin/customers/customers-filters"
import { CustomersTable } from "@/components/admin/customers/customers-table"
import {
  CUSTOMERS_PAGE_SIZE,
  DEFAULT_CUSTOMER_FILTERS,
  type CustomerFilters,
  type CustomerRow,
} from "@/types/customers"

type CustomersPageClientProps = {
  initialSearch: string
  initialPage: number
}

export function CustomersPageClient({
  initialSearch,
  initialPage,
}: CustomersPageClientProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const [filters, setFilters] = useState<CustomerFilters>({
    ...DEFAULT_CUSTOMER_FILTERS,
    search: initialSearch,
  })
  const [page, setPage] = useState(initialPage)
  const [searchDraft, setSearchDraft] = useState(initialSearch)
  const [rows, setRows] = useState<CustomerRow[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const replaceUrl = useCallback(
    (updates: { search?: string; page?: number }) => {
      const next = new URLSearchParams(searchParams.toString())
      if (updates.search !== undefined) {
        const q = updates.search.trim()
        if (q) next.set("search", q)
        else next.delete("search")
        next.delete("page")
      }
      if (updates.page !== undefined) {
        if (updates.page <= 1) next.delete("page")
        else next.set("page", String(updates.page))
      }
      const qs = next.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [pathname, router, searchParams],
  )

  const load = useCallback(
    (f: CustomerFilters, p: number) => {
      startTransition(async () => {
        const result = await getCustomersList(f, p)
        if (result.error) {
          setError(result.error)
          setRows([])
          setTotalCount(0)
          return
        }
        setError(null)
        setRows(result.data)
        setTotalCount(result.totalCount)
      })
    },
    [],
  )

  useEffect(() => {
    load(filters, page)
  }, [filters, page, load])

  useEffect(() => {
    setSearchDraft(initialSearch)
    setFilters((prev) =>
      prev.search === initialSearch ? prev : { ...prev, search: initialSearch },
    )
  }, [initialSearch])

  useEffect(() => {
    setPage(initialPage)
  }, [initialPage])

  useEffect(() => {
    const t = setTimeout(() => {
      const trimmed = searchDraft.trim()
      if (trimmed === filters.search) return
      setFilters((prev) => ({ ...prev, search: trimmed }))
      setPage(1)
      replaceUrl({ search: trimmed, page: 1 })
    }, 300)
    return () => clearTimeout(t)
  }, [searchDraft, filters.search, replaceUrl])

  function handleFiltersChange(next: CustomerFilters) {
    setFilters(next)
    setPage(1)
    replaceUrl({ page: 1 })
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / CUSTOMERS_PAGE_SIZE))

  function goToPage(n: number) {
    if (n < 1 || n > totalPages) return
    setPage(n)
    replaceUrl({ page: n })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Клиенты</h1>
          <p className="text-muted-foreground mt-1 text-sm tabular-nums">
            {totalCount.toLocaleString("ru-RU")} клиентов
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1 sm:w-64 sm:flex-none">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              type="search"
              placeholder="Поиск по телефону или имени…"
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
              className="pl-9"
              autoComplete="off"
            />
          </div>
          <CustomersFilters filters={filters} onChange={handleFiltersChange} />
        </div>
      </div>

      {error ? (
        <p className="text-destructive text-sm">
          Не удалось загрузить клиентов: {error}. Убедитесь, что применена
          миграция{" "}
          <code className="font-mono text-xs">get_customers_list</code>.
        </p>
      ) : null}

      <CustomersTable rows={rows} loading={isPending} />

      {totalCount > 0 ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-muted-foreground text-sm tabular-nums">
            Страница {page} из {totalPages}
          </p>
          <div className="flex gap-1">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-8"
              disabled={page <= 1 || isPending}
              onClick={() => goToPage(1)}
              aria-label="Первая страница"
            >
              «
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-8"
              disabled={page <= 1 || isPending}
              onClick={() => goToPage(page - 1)}
              aria-label="Предыдущая страница"
            >
              ‹
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-8"
              disabled={page >= totalPages || isPending}
              onClick={() => goToPage(page + 1)}
              aria-label="Следующая страница"
            >
              ›
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-8"
              disabled={page >= totalPages || isPending}
              onClick={() => goToPage(totalPages)}
              aria-label="Последняя страница"
            >
              »
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
