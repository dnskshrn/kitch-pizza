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
  bonusRedeemedBani?: number
  excludedCategories?: Array<{ id: string; name_ru: string; name_ro: string }>
  lang?: 'ru' | 'ro'
}

export function DiscountBreakdown({
  output,
  deliveryZone,
  bonusRedeemedBani = 0,
  excludedCategories,
}: DiscountBreakdownProps) {
  if (output == null) return null

  const hasDiscountLines = output.appliedDiscounts.length > 0
  const safeBonusBani = Math.max(0, Math.round(bonusRedeemedBani))
  const finalTotalBani =
    output.totalBani === null ? null : Math.max(0, output.totalBani - safeBonusBani)

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

      {(excludedCategories ?? []).length > 0 ? (
        <div className="flex flex-col gap-1 mt-1">
          {(excludedCategories ?? []).map((cat) => (
            <div
              key={cat.id}
              className="flex items-start gap-1.5 text-xs text-muted-foreground"
            >
              <span className="mt-0.5 shrink-0">ℹ️</span>
              <span>
                {`Скидка не применяется на «${cat.name_ru}»`}
                {cat.name_ro && cat.name_ro !== cat.name_ru ? (
                  <span className="ml-1 opacity-70">
                    {`/ Reducerea nu se aplică la «${cat.name_ro}»`}
                  </span>
                ) : null}
              </span>
            </div>
          ))}
        </div>
      ) : null}

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

      {safeBonusBani > 0 ? (
        <div className="flex items-baseline justify-between gap-3">
          <span className="min-w-0 truncate text-emerald-700">
            Списание бонусов
          </span>
          <span className="shrink-0 font-mono tabular-nums text-emerald-600">
            −{formatMdl(safeBonusBani)} MDL
          </span>
        </div>
      ) : null}

      <div className="border-t-2 border-border" />

      <div className="flex items-baseline justify-between gap-3 pt-0.5">
        <span className="text-base font-bold text-[#242424]">Итого</span>
        <span className="font-mono text-lg font-bold tabular-nums text-[#242424]">
          {finalTotalBani === null ? '—' : `${formatMdl(finalTotalBani)} MDL`}
        </span>
      </div>
    </div>
  )
}
