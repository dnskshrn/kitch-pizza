"use client"

import { useEffect, useState } from "react"

function pad(n: number) {
  return String(n).padStart(2, "0")
}

function formatElapsed(ms: number) {
  const totalSec = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  return `${h}:${pad(m)}:${pad(s)}`
}

export function PosShiftTimer({ shiftStart }: { shiftStart: string }) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    const start = new Date(shiftStart).getTime()
    if (!Number.isFinite(start)) return

    const tick = () => setElapsed(Date.now() - start)
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [shiftStart])

  return (
    <span className="text-muted-foreground text-sm tabular-nums">
      {formatElapsed(elapsed)}
    </span>
  )
}
