"use client"

import * as React from "react"
import { format } from "date-fns"
import { ru } from "date-fns/locale"
import { CalendarIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

function stripToDateOnly(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function mergeDateAndTime(date: Date, timeStr: string): Date {
  const [hRaw, mRaw] = timeStr.split(":")
  const h = Number.parseInt(hRaw ?? "0", 10)
  const m = Number.parseInt(mRaw ?? "0", 10)
  const out = new Date(date)
  out.setHours(Number.isFinite(h) ? h : 0, Number.isFinite(m) ? m : 0, 0, 0)
  return out
}

function timeValue(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
}

export type DatetimePickerProps = {
  id?: string
  value: Date | undefined
  onChange: (next: Date | undefined) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

export function DatetimePicker({
  id,
  value,
  onChange,
  placeholder = "Выберите дату и время",
  disabled,
  className,
}: DatetimePickerProps) {
  const [open, setOpen] = React.useState(false)

  const label = React.useMemo(() => {
    if (!value) return null
    return format(value, "dd.MM.yyyy, HH:mm", { locale: ru })
  }, [value])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            "h-10 w-full justify-start gap-2 px-2.5 font-normal",
            !value && "text-muted-foreground",
            className,
          )}
        >
          <CalendarIcon className="size-4 shrink-0 opacity-70" aria-hidden />
          <span className="truncate">{label ?? placeholder}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          locale={ru}
          selected={value}
          onSelect={(d) => {
            if (!d) {
              onChange(undefined)
              return
            }
            const next = value
              ? mergeDateAndTime(stripToDateOnly(d), timeValue(value))
              : mergeDateAndTime(stripToDateOnly(d), "12:00")
            onChange(next)
          }}
          initialFocus
        />
        <div className="flex flex-col gap-2 border-t p-3">
          <Label htmlFor={id ? `${id}-time` : undefined} className="text-xs">
            Время
          </Label>
          <Input
            id={id ? `${id}-time` : undefined}
            type="time"
            step={60}
            value={value ? timeValue(value) : "12:00"}
            onChange={(e) => {
              const t = e.target.value
              const base = value
                ? stripToDateOnly(value)
                : stripToDateOnly(new Date())
              onChange(mergeDateAndTime(base, t))
            }}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 text-xs"
            onClick={() => {
              onChange(undefined)
              setOpen(false)
            }}
          >
            Очистить
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
