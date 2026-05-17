"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { generateScheduledSlots } from "@/lib/pos/scheduled-slots"
import { cn } from "@/lib/utils"
import { Clock, Zap } from "lucide-react"
import type { ChangeEvent } from "react"
import { useEffect, useState } from "react"

interface Props {
  /** brand open hour, e.g. 11 */
  openHour: number
  /** brand close hour (may be next-day), e.g. 3 */
  closeHour: number
  value: string // 'asap' or 'HH:MM'
  onChange: (v: string) => void
}

export function ScheduledTimePicker({
  openHour,
  closeHour,
  value,
  onChange,
}: Props) {
  const [mode, setMode] = useState<"asap" | "scheduled">(
    value === "asap" ? "asap" : "scheduled",
  )
  const [custom, setCustom] = useState("")

  useEffect(() => {
    setMode(value === "asap" ? "asap" : "scheduled")
  }, [value])

  const slots = generateScheduledSlots(openHour, closeHour)
  // Show first 5 slots as quick buttons; rest via custom input
  const quickSlots = slots.slice(0, 5)

  function handleModeAsap() {
    setMode("asap")
    setCustom("")
    onChange("asap")
  }

  function handleModeScheduled() {
    setMode("scheduled")
    // pre-select first available slot
    if (slots.length > 0 && value === "asap") {
      onChange(slots[0]!)
    }
  }

  function handleSlot(slot: string) {
    setCustom("")
    onChange(slot)
  }

  function handleCustomChange(e: ChangeEvent<HTMLInputElement>) {
    setCustom(e.target.value)
    // accept HH:MM pattern
    if (/^\d{2}:\d{2}$/.test(e.target.value)) {
      onChange(e.target.value)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Mode toggle */}
      <div className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          variant={mode === "asap" ? "default" : "outline"}
          size="sm"
          onClick={handleModeAsap}
          className="gap-2"
        >
          <Zap className="size-4" />
          Как можно скорее
        </Button>
        <Button
          type="button"
          variant={mode === "scheduled" ? "default" : "outline"}
          size="sm"
          onClick={handleModeScheduled}
          className="gap-2"
        >
          <Clock className="size-4" />
          Ко времени
        </Button>
      </div>

      {/* Slot grid */}
      {mode === "scheduled" && (
        <div className="flex flex-wrap gap-2">
          {quickSlots.map((slot) => (
            <Button
              key={slot}
              type="button"
              variant={value === slot ? "default" : "outline"}
              size="sm"
              onClick={() => handleSlot(slot)}
            >
              {slot}
            </Button>
          ))}
          {/* Custom time input */}
          <Input
            type="time"
            value={custom}
            onChange={handleCustomChange}
            className={cn(
              "h-9 w-28",
              custom &&
                value === custom &&
                "border-primary ring-1 ring-primary",
            )}
          />
        </div>
      )}
    </div>
  )
}
