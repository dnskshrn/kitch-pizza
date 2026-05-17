"use client"

import { PosBrandMark } from "@/components/pos/pos-brand-mark"
import {
  aggregateToppingsForDisplay,
  formatElapsedMmSs,
  formatScheduledTimeLabel,
  isKdsScheduledOrder,
  kdsTimerPalette,
  parseOrderItemToppings,
  type KdsOrderRow,
} from "@/components/pos/kds/types"
import { isKdsCardActive } from "@/lib/pos/kds-wakeup"
import { cn } from "@/lib/utils"
import { Clock, Timer } from "lucide-react"
import { motion } from "motion/react"
import { useEffect, useRef, useState } from "react"

type KdsOrderCardProps = {
  order: KdsOrderRow
  brandSlug: string
  onMarkReady: (orderId: string) => void
  onCommitReady: (orderId: string) => void
  onCancelReady: (orderId: string) => void
  undoExpiresAt: number | null
  removing: boolean
}

function useCookingElapsedSeconds(
  cookingStartedAt: string | null,
  updatedAt: string,
  active: boolean,
): number {
  const anchorIso = cookingStartedAt ?? updatedAt

  const [elapsed, setElapsed] = useState(() => {
    if (!active) return 0
    return Math.floor((Date.now() - new Date(anchorIso).getTime()) / 1000)
  })

  useEffect(() => {
    if (!active) {
      setElapsed(0)
      return
    }
    const tick = () => {
      setElapsed(
        Math.floor((Date.now() - new Date(anchorIso).getTime()) / 1000),
      )
    }
    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [active, anchorIso])

  return elapsed
}

function kdsScheduledTimeDisplay(raw: string): string {
  const t = raw.trim()
  if (/^\d{2}:\d{2}$/.test(t)) return t
  return formatScheduledTimeLabel(raw)
}

function ReadySwipeButton({
  onActivate,
  disabled,
}: {
  onActivate: () => void
  disabled?: boolean
}) {
  const suppressClickRef = useRef(false)
  const startXRef = useRef<number | null>(null)

  const onPointerDown = (e: React.PointerEvent) => {
    startXRef.current = e.clientX
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const onPointerUp = (e: React.PointerEvent) => {
    const start = startXRef.current
    startXRef.current = null
    if (start == null || disabled) return
    const dx = e.clientX - start
    if (dx < -56) {
      suppressClickRef.current = true
      onActivate()
    }
  }

  const onClick = () => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false
      return
    }
    if (!disabled) onActivate()
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onClick={onClick}
      className={cn(
        "flex w-full touch-none select-none items-center justify-center gap-3 rounded-[100px] bg-[#111] py-4 text-[24px] font-bold leading-none text-white",
        disabled && "pointer-events-none opacity-40",
      )}
    >
      <span className="text-[28px] leading-none tracking-tighter" aria-hidden>
        «««
      </span>
      Готово
    </button>
  )
}

function UndoOverlay({
  expiresAt,
  onCancel,
}: {
  expiresAt: number
  onCancel: () => void
}) {
  const totalMs = 5000
  const [remain, setRemain] = useState(() =>
    Math.max(0, expiresAt - Date.now()),
  )

  useEffect(() => {
    const id = window.setInterval(() => {
      setRemain(Math.max(0, expiresAt - Date.now()))
    }, 50)
    return () => window.clearInterval(id)
  }, [expiresAt])

  const progress = Math.min(1, remain / totalMs)

  return (
    <div className="absolute inset-0 z-10 flex flex-col justify-between rounded-[8px] bg-black/78 p-4 text-white">
      <p className="text-center text-[18px] font-bold leading-tight">
        Отмечено как готово
      </p>
      <div className="flex flex-col gap-3">
        <div className="h-2 w-full overflow-hidden rounded-full bg-white/20">
          <div
            className="h-full rounded-full bg-white transition-[width] duration-75 ease-linear"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-[100px] bg-white py-3 text-[18px] font-bold text-[#111]"
        >
          Отменить
        </button>
      </div>
    </div>
  )
}

export function KdsOrderCard({
  order,
  brandSlug,
  onMarkReady,
  onCommitReady,
  onCancelReady,
  undoExpiresAt,
  removing,
}: KdsOrderCardProps) {
  const isScheduledSlot = isKdsScheduledOrder(order.scheduled_time)
  const isWakeActive = isKdsCardActive(
    order.scheduled_time,
    order.delivery_mode,
  )
  const showCookingFlow = !isScheduledSlot || isWakeActive
  const sleepingScheduled = isScheduledSlot && !isWakeActive

  const elapsedSec = useCookingElapsedSeconds(
    order.cooking_started_at,
    order.updated_at,
    showCookingFlow,
  )
  const palette = showCookingFlow
    ? kdsTimerPalette(elapsedSec)
    : { bg: "#e5e5e5", fg: "#111111" }

  const items = order.order_items ?? []

  const undoActive = undoExpiresAt != null && Date.now() < undoExpiresAt

  const commitOnceRef = useRef(false)
  useEffect(() => {
    commitOnceRef.current = false
  }, [undoExpiresAt])

  useEffect(() => {
    if (undoExpiresAt == null) return
    const msLeft = undoExpiresAt - Date.now()
    if (msLeft <= 0) {
      if (!commitOnceRef.current) {
        commitOnceRef.current = true
        onCommitReady(order.id)
      }
      return
    }
    const t = window.setTimeout(() => {
      if (!commitOnceRef.current) {
        commitOnceRef.current = true
        onCommitReady(order.id)
      }
    }, msLeft)
    return () => window.clearTimeout(t)
  }, [undoExpiresAt, order.id, onCommitReady])

  const borderColor = sleepingScheduled ? "#e5e5e5" : palette.bg

  const scheduledBanner =
    isScheduledSlot &&
    order.scheduled_time &&
    order.scheduled_time.trim().toLowerCase() !== "asap"

  return (
    <motion.article
      layout
      initial={false}
      animate={
        removing
          ? { x: -48, opacity: 0, transition: { duration: 0.35 } }
          : { x: 0 }
      }
      className={cn(
        "flex h-full min-h-0 w-[min(360px,85vw)] shrink-0 flex-col overflow-hidden rounded-[12px] bg-white transition-[opacity,filter]",
        sleepingScheduled && "opacity-50 saturate-0",
      )}
      style={{ borderWidth: 5, borderStyle: "solid", borderColor }}
    >
      <header className="flex shrink-0 items-center justify-between gap-2 px-4 pt-4">
        <PosBrandMark brandSlug={brandSlug} size="md" />
        <div className="flex min-w-0 flex-1 justify-center px-1">
          {scheduledBanner ? (
            <div
              className={cn(
                "flex w-full max-w-[min(280px,100%)] items-center justify-between rounded-lg px-3 py-2 text-sm font-semibold",
                isWakeActive
                  ? "bg-lime-400 text-black"
                  : "bg-muted text-muted-foreground",
              )}
            >
              <span className="flex min-w-0 items-center gap-2">
                <Clock className="size-4 shrink-0" strokeWidth={2.5} />
                <span className="truncate">Заказ на время</span>
              </span>
              <span className="shrink-0 font-mono text-sm font-bold tabular-nums">
                {kdsScheduledTimeDisplay(order.scheduled_time!)}
              </span>
            </div>
          ) : (
            <div
              className="inline-flex items-center gap-2 rounded-full px-3 py-1.5"
              style={{ backgroundColor: palette.bg, color: palette.fg }}
            >
              <Timer className="size-4 shrink-0 opacity-70" strokeWidth={2.5} />
              <span className="font-mono text-[18px] font-bold tabular-nums">
                {formatElapsedMmSs(elapsedSec)}
              </span>
            </div>
          )}
        </div>
        <span className="shrink-0 font-mono text-[18px] font-bold tabular-nums text-[#111]/60">
          #{order.order_number}
        </span>
      </header>

      <div
        className="relative min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-4"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        {undoActive && undoExpiresAt ? (
          <UndoOverlay
            expiresAt={undoExpiresAt}
            onCancel={() => onCancelReady(order.id)}
          />
        ) : null}

        <div className="flex min-h-[72px] flex-col gap-2 pb-2 pt-3">
          {items.map((line) => (
            <KdsLineItem key={line.id} line={line} />
          ))}
        </div>
      </div>

      <div className="shrink-0 px-4 pb-4 pt-2">
        {showCookingFlow ? (
          <ReadySwipeButton
            disabled={undoActive}
            onActivate={() => onMarkReady(order.id)}
          />
        ) : (
          <div className="flex items-center justify-between gap-3 rounded-[100px] bg-muted/80 px-5 py-4 text-muted-foreground">
            <span className="text-[20px] font-bold leading-none sm:text-[22px]">
              Заказ на время
            </span>
            <span className="flex items-center gap-2 text-[18px] font-bold tabular-nums sm:text-[20px]">
              <Clock className="size-6 shrink-0" strokeWidth={2.5} />
              {order.scheduled_time
                ? kdsScheduledTimeDisplay(order.scheduled_time)
                : "—"}
            </span>
          </div>
        )}
      </div>
    </motion.article>
  )
}

function KdsLineItem({
  line,
}: {
  line: KdsOrderRow["order_items"][number]
}) {
  const toppingsRaw = parseOrderItemToppings(line.toppings)
  const toppings = aggregateToppingsForDisplay(toppingsRaw)
  const extras = toppings.filter((t) => t.price > 0)
  const standard = toppings.filter((t) => t.price <= 0)

  const title = line.item_name

  return (
    <div className="rounded-[8px] bg-[#f2f2f2] p-3">
      <div className="flex flex-wrap items-start gap-2">
        <span className="inline-flex shrink-0 rounded-[8px] bg-[#111] px-2 py-1 text-[14px] font-bold leading-none text-white">
          {line.quantity}×
        </span>
        <div className="min-w-0 flex-1">
          <span className="text-[20px] font-bold leading-snug text-[#111]">
            {title}
          </span>
          {line.size?.trim() ? (
            <span className="mt-0.5 block text-[16px] font-medium text-[#111]/70">
              {line.size.trim()}
            </span>
          ) : null}
        </div>
      </div>

      {extras.length > 0 || standard.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {extras.map((t) => (
            <span
              key={`e-${t.name}-${t.price}-${t.qty}`}
              className="inline-flex items-center gap-1 rounded-[8px] border border-[#111] bg-[#fffc9e] px-2 py-1 text-[16px] font-bold leading-none text-[#111]"
            >
              <span className="rounded-[6px] bg-[#111] px-1.5 py-0.5 text-[14px] font-bold text-white">
                {t.qty}×
              </span>
              {t.name}
            </span>
          ))}
          {standard.map((t) => (
            <span
              key={`s-${t.name}-${t.price}-${t.qty}`}
              className="inline-flex items-center gap-1 rounded-[8px] bg-white px-2 py-1 text-[16px] font-medium leading-none text-[#111]"
            >
              <span className="rounded-[6px] bg-[#f2f2f2] px-1.5 py-0.5 text-[14px] font-medium text-[#111]">
                {t.qty}×
              </span>
              {t.name}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  )
}
