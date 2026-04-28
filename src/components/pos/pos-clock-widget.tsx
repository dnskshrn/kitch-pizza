"use client"

import { cn } from "@/lib/utils"
import { useEffect, useState } from "react"

function pad(n: number) {
  return String(n).padStart(2, "0")
}

function formatClock(d: Date) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

export function PosClockWidget() {
  /** null до монтирования — иначе SSR и гидрация получают разные секунды и падают с mismatch */
  const [now, setNow] = useState<Date | null>(null)

  useEffect(() => {
    const tick = () => setNow(new Date())
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <span
      className={cn(
        "font-mono text-sm tabular-nums tracking-tight",
        !now && "text-muted-foreground"
      )}
    >
      {now ? formatClock(now) : "--:--:--"}
    </span>
  )
}
