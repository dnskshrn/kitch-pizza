"use client"

import { useState } from "react"
import { toast } from "sonner"
import { updateBonusSettings } from "@/lib/actions/admin/bonus-settings-action"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"

export type BonusSettingsFormInitial = {
  isEnabled: boolean
  accrualPercent: number
  maxRedemptionPercent: number
}

function parsePct(raw: string): number {
  return Number.parseFloat(raw.replace(",", "."))
}

export function BonusSettingsForm({
  initial,
}: {
  initial: BonusSettingsFormInitial
}) {
  const [enabled, setEnabled] = useState(initial.isEnabled)
  const [accrualPercent, setAccrualPercent] = useState(
    String(initial.accrualPercent),
  )
  const [maxRedemptionPercent, setMaxRedemptionPercent] = useState(
    String(initial.maxRedemptionPercent),
  )
  const [saving, setSaving] = useState(false)

  return (
    <form
      className="mx-auto max-w-lg space-y-6"
      onSubmit={async (e) => {
        e.preventDefault()
        const accN = parsePct(accrualPercent)
        const maxRN = parsePct(maxRedemptionPercent)
        if (!Number.isFinite(accN) || accN < 1 || accN > 100) {
          toast.error("Процент начисления: число от 1 до 100")
          return
        }
        if (!Number.isFinite(maxRN) || maxRN < 1 || maxRN > 100) {
          toast.error("Макс. % списания: число от 1 до 100")
          return
        }
        setSaving(true)
        try {
          const r = await updateBonusSettings({
            isEnabled: enabled,
            accrualPercent: accN,
            maxRedemptionPercent: maxRN,
          })
          if (r.error) {
            toast.error(r.error)
            return
          }
          toast.success("Настройки сохранены")
        } finally {
          setSaving(false)
        }
      }}
    >
      <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
        <Label htmlFor="loyalty-enabled" className="text-foreground">
          Программа лояльности включена
        </Label>
        <Switch
          id="loyalty-enabled"
          checked={enabled}
          onCheckedChange={setEnabled}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="accrual-pct">% начисления</Label>
        <Input
          id="accrual-pct"
          type="number"
          min={1}
          max={100}
          step={0.01}
          value={accrualPercent}
          onChange={(e) => setAccrualPercent(e.target.value)}
          required
        />
        <p className="text-muted-foreground text-sm">
          При % = 5 и заказе 300 MDL начислится 15 бонусов
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="max-red-pct">
          Макс. % списания от суммы заказа
        </Label>
        <Input
          id="max-red-pct"
          type="number"
          min={1}
          max={100}
          step={0.01}
          value={maxRedemptionPercent}
          onChange={(e) => setMaxRedemptionPercent(e.target.value)}
          required
        />
        <p className="text-muted-foreground text-sm">
          При % = 40 и заказе 300 MDL можно списать до 120 бонусов
        </p>
      </div>

      <Button type="submit" disabled={saving} variant="secondary">
        {saving ? "Сохранение…" : "Сохранить"}
      </Button>
    </form>
  )
}
