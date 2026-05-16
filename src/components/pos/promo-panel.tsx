'use client'

import { getActiveDiscountRules, resolvePromoCode } from '@/lib/actions/discounts'
import { evaluateDiscounts, isRuleScheduleActive } from '@/lib/discount-engine'
import type {
  CartItemForEngine,
  DeliveryZoneForEngine,
  DiscountEngineOutput,
  DiscountRule,
} from '@/types/promotions'
import { Check, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

function matchesTargets(item: CartItemForEngine, rule: DiscountRule): boolean {
  const ti = rule.target_item_ids
  const tc = rule.target_category_ids
  const hasItems = ti != null && ti.length > 0
  const hasCats = tc != null && tc.length > 0
  if (!hasItems && !hasCats) return true
  if (hasItems && hasCats) {
    return ti!.includes(item.menu_item_id) || tc!.includes(item.category_id)
  }
  if (hasItems) return ti!.includes(item.menu_item_id)
  return tc!.includes(item.category_id)
}

function totalQualifyingForRule(items: CartItemForEngine[], rule: DiscountRule): number {
  let sum = 0
  for (const it of items) {
    if (matchesTargets(it, rule)) sum += it.quantity
  }
  return sum
}

export type PromoPanelProps = {
  brandId: string
  items: CartItemForEngine[]
  deliveryZone: DeliveryZoneForEngine | null
  onDiscountChange: (output: DiscountEngineOutput) => void
  /** Вызывается при применении/снятии промокода (код в верхнем регистре). */
  onAppliedPromoCodeChange?: (code: string | null) => void
}

export function PromoPanel({
  brandId,
  items,
  deliveryZone,
  onDiscountChange,
  onAppliedPromoCodeChange,
}: PromoPanelProps) {
  const [activeRules, setActiveRules] = useState<DiscountRule[]>([])
  const [promoCodeRule, setPromoCodeRule] = useState<DiscountRule | null>(null)
  const [promoInput, setPromoInput] = useState('')
  const [promoStatus, setPromoStatus] = useState<
    'idle' | 'loading' | 'applied' | 'error'
  >('idle')
  const [promoError, setPromoError] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const rules = await getActiveDiscountRules(brandId)
      if (!cancelled) setActiveRules(rules)
    })()
    return () => {
      cancelled = true
    }
  }, [brandId])

  const output = useMemo(
    () =>
      evaluateDiscounts({
        items,
        rules: activeRules,
        promoCodeRule: promoCodeRule ?? undefined,
        deliveryZone,
      }),
    [items, deliveryZone, activeRules, promoCodeRule],
  )

  useEffect(() => {
    onDiscountChange(output)
  }, [output, onDiscountChange])

  async function handleApplyPromo() {
    if (!promoInput.trim()) return
    setPromoStatus('loading')
    const result = await resolvePromoCode(brandId, promoInput)
    if ('error' in result) {
      setPromoStatus('error')
      setPromoError(result.error)
      setPromoCodeRule(null)
      onAppliedPromoCodeChange?.(null)
    } else {
      setPromoStatus('applied')
      setPromoError('')
      setPromoCodeRule(result.rule)
      onAppliedPromoCodeChange?.(promoInput.trim().toUpperCase())
    }
  }

  function handleRemovePromo() {
    setPromoCodeRule(null)
    setPromoStatus('idle')
    setPromoInput('')
    setPromoError('')
    onAppliedPromoCodeChange?.(null)
  }

  const now = new Date()
  const scheduleActiveRules = activeRules.filter((r) => isRuleScheduleActive(r, now))

  return (
    <section className="space-y-2">
      <h3 className="text-[10px] font-normal uppercase tracking-[0.08em] text-muted-foreground">
        Акции
      </h3>

      <div className="flex flex-wrap gap-1.5">
        {scheduleActiveRules.map((rule) => {
          if (rule.effect_type === 'cheapest_item_free') {
            const totalQualifying = totalQualifyingForRule(items, rule)
            const n = rule.free_every_n ?? 1
            const groupSize = n + 1
            const triggered = totalQualifying >= groupSize
            const baseLabel = rule.label_ru ?? rule.name

            if (triggered) {
              return (
                <span
                  key={rule.id}
                  className="inline-flex max-w-full items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-900"
                >
                  <span className="truncate">{baseLabel}</span>
                </span>
              )
            }

            let needed = groupSize - (totalQualifying % groupSize)
            if (needed === groupSize) {
              needed = groupSize
            }

            return (
              <span
                key={rule.id}
                className="inline-flex max-w-full items-center rounded-full border border-border bg-muted/50 px-2.5 py-1 text-xs text-muted-foreground"
              >
                <span className="truncate">
                  {baseLabel}: ещё {needed} шт.
                </span>
              </span>
            )
          }

          const triggered = output.appliedDiscounts.some((d) => d.rule_id === rule.id)
          if (!triggered) return null

          return (
            <span
              key={rule.id}
              className="inline-flex max-w-full items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-900"
            >
              <span className="truncate">{rule.label_ru ?? rule.name}</span>
            </span>
          )
        })}
      </div>

      <div className="space-y-1.5">
        {promoStatus !== 'applied' ? (
          <div className="flex gap-2">
            <input
              type="text"
              value={promoInput}
              onChange={(e) => setPromoInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleApplyPromo()
              }}
              placeholder="Промокод"
              disabled={promoStatus === 'loading'}
              className="h-9 min-w-0 flex-1 rounded-lg border border-border bg-white px-3 font-mono text-sm uppercase placeholder:normal-case placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            />
            <button
              type="button"
              onClick={() => void handleApplyPromo()}
              disabled={promoStatus === 'loading'}
              className="h-9 shrink-0 rounded-lg border border-border bg-white px-3 text-sm font-semibold text-[#242424] transition-colors hover:bg-[#f2f2f2] disabled:pointer-events-none disabled:opacity-50"
            >
              {promoStatus === 'loading' ? '…' : 'Применить'}
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2 rounded-lg border border-emerald-200 bg-emerald-50/80 px-3 py-2">
            <div className="flex min-w-0 items-center gap-2">
              <Check
                className="size-4 shrink-0 text-emerald-600"
                strokeWidth={2.5}
                aria-hidden
              />
              <span className="truncate text-sm font-medium text-emerald-900">
                {promoCodeRule?.label_ru ?? promoCodeRule?.name ?? ''}
              </span>
            </div>
            <button
              type="button"
              onClick={handleRemovePromo}
              className="flex size-8 shrink-0 items-center justify-center rounded-full text-emerald-800 hover:bg-emerald-100"
              aria-label="Убрать промокод"
            >
              <X className="size-4" />
            </button>
          </div>
        )}

        {promoStatus === 'error' ? (
          <p className="text-xs text-destructive">{promoError}</p>
        ) : null}
      </div>
    </section>
  )
}
