'use client'

import type { DeliveryZoneForEngine, DiscountEngineOutput } from '@/types/promotions'

function mdlFromBani(bani: number): number {
  return Math.round(bani) / 100
}

function formatMdl(bani: number): string {
  return mdlFromBani(bani).toLocaleString('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

type DiscountBreakdownProps = {
  output: DiscountEngineOutput | null
  deliveryZone: DeliveryZoneForEngine | null
}

export function DiscountBreakdown({ output, deliveryZone }: DiscountBreakdownProps) {
  if (output == null) return null

  const hasDiscountLines = output.appliedDiscounts.length > 0

  return (
    <div className="space-y-2 text-sm text-foreground">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[#242424]">Сумма товаров</span>
        <span className="font-mono tabular-nums text-[#242424]">
          {formatMdl(output.itemSubtotalBani)} MDL
        </span>
      </div>

      {output.appliedDiscounts.map((entry) => (
        <div
          key={`${entry.rule_id}-${entry.effect_type}-${entry.discount_bani}`}
          className="flex items-baseline justify-between gap-3"
        >
          <span className="min-w-0 truncate text-emerald-700">{entry.label_ru}</span>
          <span className="shrink-0 font-mono tabular-nums text-emerald-600">
            −{formatMdl(entry.discount_bani)} MDL
          </span>
        </div>
      ))}

      {hasDiscountLines ? (
        <>
          <div className="border-t border-border/80" />
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-xs text-muted-foreground">После скидок</span>
            <span className="font-mono text-xs tabular-nums text-muted-foreground">
              {formatMdl(output.discountedSubtotalBani)} MDL
            </span>
          </div>
        </>
      ) : null}

      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[#242424]">
          Доставка
          {deliveryZone &&
          output.deliveryFeeBani !== null &&
          output.deliveryFeeBani > 0 ? (
            <span className="text-xs font-normal text-muted-foreground">
              {' '}
              (от {formatMdl(deliveryZone.free_from_bani)} MDL)
            </span>
          ) : null}
        </span>
        {output.deliveryFeeBani === null ? (
          <span className="text-xs text-muted-foreground">Укажите адрес</span>
        ) : output.deliveryFeeBani === 0 ? (
          <span className="text-emerald-600">Бесплатно</span>
        ) : (
          <span className="font-mono tabular-nums text-[#242424]">
            {formatMdl(output.deliveryFeeBani)} MDL
          </span>
        )}
      </div>

      <div className="border-t-2 border-border" />

      <div className="flex items-baseline justify-between gap-3 pt-0.5">
        <span className="text-base font-bold text-[#242424]">Итого</span>
        <span className="font-mono text-lg font-bold tabular-nums text-[#242424]">
          {output.totalBani === null ? '—' : `${formatMdl(output.totalBani)} MDL`}
        </span>
      </div>
    </div>
  )
}
