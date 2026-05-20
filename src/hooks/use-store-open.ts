import { useState, useEffect } from 'react'

function getChisinauMinutes(): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Chisinau',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(new Date())
  const h = parseInt(parts.find(p => p.type === 'hour')!.value, 10)
  const m = parseInt(parts.find(p => p.type === 'minute')!.value, 10)
  return h * 60 + m
}

// Open 11:00–03:00, closed 03:00–11:00
function checkIsOpen(): boolean {
  const now = getChisinauMinutes()
  const open  = 11 * 60   // 660
  const close = 3  * 60   // 180  (next day)
  // crosses midnight: open if now >= 660 OR now < 180
  return now >= open || now < close
}

function getMinutesUntilOpen(): number {
  const now  = getChisinauMinutes()
  const open = 11 * 60 // 660
  if (now >= open) return 0
  return open - now
}

export function useStoreOpen() {
  const [isOpen, setIsOpen]             = useState(true)   // optimistic SSR
  const [minutesLeft, setMinutesLeft]   = useState(0)
  const [mounted, setMounted]           = useState(false)

  useEffect(() => {
    setMounted(true)
    const update = () => {
      const open = checkIsOpen()
      setIsOpen(open)
      setMinutesLeft(open ? 0 : getMinutesUntilOpen())
    }
    update()
    const interval = setInterval(update, 30_000) // re-check every 30s
    return () => clearInterval(interval)
  }, [])

  const hours   = Math.floor(minutesLeft / 60)
  const minutes = minutesLeft % 60

  return { isOpen, hours, minutes, mounted }
}
