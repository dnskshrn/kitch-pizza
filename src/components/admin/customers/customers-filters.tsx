"use client"

import { useMemo, useState } from "react"
import { SlidersHorizontal } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import {
  DEFAULT_CUSTOMER_FILTERS,
  type CustomerFilters,
} from "@/types/customers"

type CustomersFiltersProps = {
  filters: CustomerFilters
  onChange: (f: CustomerFilters) => void
}

const SORT_OPTIONS: { value: CustomerFilters["sortBy"]; label: string }[] = [
  { value: "created_at", label: "Дата регистрации" },
  { value: "last_order", label: "Последний заказ" },
  { value: "total_spend", label: "Сумма заказов" },
  { value: "orders_count", label: "Кол-во заказов" },
]

const SORT_DIR_OPTIONS: { value: CustomerFilters["sortDir"]; label: string }[] =
  [
    { value: "desc", label: "По убыванию" },
    { value: "asc", label: "По возрастанию" },
  ]

const ACTIVE_OPTIONS: { value: string; label: string; days: number | null }[] = [
  { value: "all", label: "Все клиенты", days: null },
  { value: "30", label: "За 30 дней", days: 30 },
  { value: "60", label: "За 60 дней", days: 60 },
  { value: "90", label: "За 90 дней", days: 90 },
  { value: "180", label: "За 180 дней", days: 180 },
]

function countActiveFilters(f: CustomerFilters): number {
  let n = 0
  if (f.sortBy !== DEFAULT_CUSTOMER_FILTERS.sortBy) n++
  if (f.sortDir !== DEFAULT_CUSTOMER_FILTERS.sortDir) n++
  if (f.minOrders > 0) n++
  if (f.hasBonus === true) n++
  if (f.regFrom !== "") n++
  if (f.regTo !== "") n++
  if (f.activeDays != null) n++
  return n
}

export function CustomersFilters({ filters, onChange }: CustomersFiltersProps) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<CustomerFilters>(filters)

  const activeCount = useMemo(() => countActiveFilters(filters), [filters])

  function openChange(next: boolean) {
    if (next) setDraft(filters)
    setOpen(next)
  }

  function apply() {
    onChange(draft)
    setOpen(false)
  }

  function reset() {
    setDraft({
      ...DEFAULT_CUSTOMER_FILTERS,
      search: filters.search,
    })
  }

  const activeDaysValue =
    draft.activeDays == null ? "all" : String(draft.activeDays)

  return (
    <Popover open={open} onOpenChange={openChange}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className="gap-2">
          <SlidersHorizontal className="size-4" />
          Фильтры
          {activeCount > 0 ? (
            <Badge
              variant="secondary"
              className="h-5 min-w-5 rounded-full px-1.5 tabular-nums"
            >
              {activeCount}
            </Badge>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[320px] gap-0 p-0">
        <div className="flex flex-col gap-4 p-4">
          <h2 className="text-sm font-semibold">Фильтры</h2>

          <div className="flex flex-col gap-2">
            <Label className="text-xs text-muted-foreground">Сортировка</Label>
            <Select
              value={draft.sortBy}
              onValueChange={(v) =>
                setDraft((d) => ({
                  ...d,
                  sortBy: v as CustomerFilters["sortBy"],
                }))
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={draft.sortDir}
              onValueChange={(v) =>
                setDraft((d) => ({
                  ...d,
                  sortDir: v as CustomerFilters["sortDir"],
                }))
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SORT_DIR_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="min-orders" className="text-xs">
              Минимум заказов (включая Poster)
            </Label>
            <Input
              id="min-orders"
              type="number"
              min={0}
              value={draft.minOrders}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  minOrders: Math.max(0, parseInt(e.target.value, 10) || 0),
                }))
              }
            />
          </div>

          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="has-bonus" className="text-sm">
              Только с бонусами
            </Label>
            <Switch
              id="has-bonus"
              checked={draft.hasBonus === true}
              onCheckedChange={(checked) =>
                setDraft((d) => ({
                  ...d,
                  hasBonus: checked ? true : null,
                }))
              }
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label className="text-xs">Дата регистрации</Label>
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="date"
                value={draft.regFrom}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, regFrom: e.target.value }))
                }
                aria-label="Регистрация от"
              />
              <Input
                type="date"
                value={draft.regTo}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, regTo: e.target.value }))
                }
                aria-label="Регистрация до"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label className="text-xs text-muted-foreground">Активность</Label>
            <Select
              value={activeDaysValue}
              onValueChange={(v) => {
                const opt = ACTIVE_OPTIONS.find((o) => o.value === v)
                setDraft((d) => ({ ...d, activeDays: opt?.days ?? null }))
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACTIVE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex gap-2 border-t p-4">
          <Button type="button" variant="ghost" className="flex-1" onClick={reset}>
            Сбросить
          </Button>
          <Button type="button" className="flex-1" onClick={apply}>
            Применить
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
