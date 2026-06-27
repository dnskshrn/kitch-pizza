"use client"

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useLanguage } from "@/lib/store/language-store"
import { cn } from "@/lib/utils"

interface BonusRedeemBlockProps {
  balance: number
  value: number
  maxRedeemable: number
  disabled: boolean
  disabledTooltip: string
  onChange: (points: number) => void
}

export function BonusRedeemBlock({
  balance,
  value,
  maxRedeemable,
  disabled,
  disabledTooltip,
  onChange,
}: BonusRedeemBlockProps) {
  const { t } = useLanguage()

  if (balance <= 0) return null

  const input = (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3 text-[14px] text-[#242424]">
        <span>
          🎁 {t.bonus.balance}: <strong>{balance}</strong>
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="number"
          min={0}
          max={maxRedeemable}
          step={1}
          value={value}
          disabled={disabled || maxRedeemable <= 0}
          onChange={(e) => {
            const raw = e.target.value
            if (raw === "") {
              onChange(0)
              return
            }
            const n = Number.parseInt(raw, 10)
            if (!Number.isFinite(n) || n < 0) return
            onChange(Math.min(n, maxRedeemable))
          }}
          className={cn(
            "h-10 w-24 rounded-[12px] border border-[#e8e8e8] bg-white px-3 text-[14px] tabular-nums text-[#242424] outline-none focus:border-[#242424]",
            (disabled || maxRedeemable <= 0) && "cursor-not-allowed opacity-50",
          )}
          aria-label={t.bonus.redeem}
        />
        <span className="text-[13px] text-[#808080]">MDL</span>
      </div>
      <p className="text-[12px] text-[#808080]">
        {t.checkout.bonusesMaxRedeem(maxRedeemable)}
      </p>
      <p className="text-xs text-muted-foreground">{t.bonus.expiresIn30Days}</p>
    </div>
  )

  if (!disabled) return input

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="cursor-not-allowed">{input}</div>
        </TooltipTrigger>
        <TooltipContent side="top">{disabledTooltip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export default BonusRedeemBlock
