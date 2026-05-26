"use client"

import {
  endOfMonth,
  format,
  parseISO,
  startOfMonth,
  subDays,
  subMonths,
} from "date-fns"
import { CalendarDays, ChevronDown } from "lucide-react"
import {
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation"
import { type DateRange } from "react-day-picker"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Separator } from "@/components/ui/separator"

type PeriodPresetKind =
  | "seven-days"
  | "current-month"
  | "previous-month"
  | "three-months"

type PeriodPreset = {
  label: string
  kind: PeriodPresetKind
}

export interface PeriodFilterProps {
  dateFrom: string
  dateTo: string
  presets?: PeriodPreset[]
}

const DEFAULT_PRESETS: PeriodPreset[] = [
  { label: "7 дней", kind: "seven-days" },
  { label: "Этот месяц", kind: "current-month" },
  { label: "Прошлый месяц", kind: "previous-month" },
]

function toYmd(value: Date): string {
  return format(value, "yyyy-MM-dd")
}

function formatPeriodLabel(dateFrom: string, dateTo: string): string {
  return `${format(parseISO(dateFrom), "dd.MM.yyyy")} – ${format(parseISO(dateTo), "dd.MM.yyyy")}`
}

function resolvePresetDates(kind: PeriodPresetKind): {
  from: string
  to: string
} {
  const now = new Date()

  if (kind === "current-month") {
    return {
      from: toYmd(startOfMonth(now)),
      to: toYmd(endOfMonth(now)),
    }
  }

  if (kind === "previous-month") {
    const previousMonth = subMonths(now, 1)
    return {
      from: toYmd(startOfMonth(previousMonth)),
      to: toYmd(endOfMonth(previousMonth)),
    }
  }

  if (kind === "three-months") {
    return {
      from: toYmd(startOfMonth(subMonths(now, 3))),
      to: toYmd(endOfMonth(subMonths(now, 1))),
    }
  }

  return {
    from: toYmd(subDays(now, 6)),
    to: toYmd(now),
  }
}

function buildDateSearch(
  pathname: string,
  searchParams: ReturnType<typeof useSearchParams>,
  from: string,
  to: string,
): string {
  const params = new URLSearchParams(searchParams.toString())
  params.set("from", from)
  params.set("to", to)
  return `${pathname}?${params.toString()}`
}

export function PeriodFilter({
  dateFrom,
  dateTo,
  presets = DEFAULT_PRESETS,
}: PeriodFilterProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [open, setOpen] = useState(false)
  const [selectedRange, setSelectedRange] = useState<DateRange | undefined>(() => ({
    from: parseISO(dateFrom),
    to: parseISO(dateTo),
  }))

  useEffect(() => {
    setSelectedRange({
      from: parseISO(dateFrom),
      to: parseISO(dateTo),
    })
  }, [dateFrom, dateTo])

  const fromInput = selectedRange?.from
  const toInput = selectedRange?.to
  const canApply = Boolean(
    fromInput &&
      toInput &&
      fromInput.getTime() <= toInput.getTime()
  )

  function applyRange(): void {
    if (!fromInput || !toInput) {
      toast.error("Укажите обе даты периода")
      return
    }

    if (fromInput.getTime() > toInput.getTime()) {
      toast.error("Дата начала не может быть позже даты окончания")
      return
    }

    router.push(
      buildDateSearch(pathname, searchParams, toYmd(fromInput), toYmd(toInput))
    )
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <CalendarDays className="size-4" />
          <span>{formatPeriodLabel(dateFrom, dateTo)}</span>
          <ChevronDown className="size-4 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto p-3">
        <div className="flex flex-col gap-2">
          <Calendar
            mode="range"
            selected={selectedRange}
            onSelect={setSelectedRange}
            defaultMonth={selectedRange?.from}
            numberOfMonths={1}
            className="rounded-md border"
          />
          <Separator />
          <div className="flex flex-col gap-1">
            {presets.map((preset) => (
              <Button
                key={preset.label}
                type="button"
                variant="ghost"
                size="sm"
                className="justify-start"
                onClick={() => {
                  const { from, to } = resolvePresetDates(preset.kind)
                  setSelectedRange({
                    from: parseISO(from),
                    to: parseISO(to),
                  })
                }}
              >
                {preset.label}
              </Button>
            ))}
          </div>
          <Separator />
          <Button
            type="button"
            className="w-full bg-[#ccff00] text-[#242424] hover:bg-[#ccff00]/90"
            disabled={!canApply}
            onClick={applyRange}
          >
            Применить
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
