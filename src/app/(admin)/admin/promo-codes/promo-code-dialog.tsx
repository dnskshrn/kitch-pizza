"use client"

import { useEffect, useState, useTransition } from "react"
import type { PromoCode } from "@/types/database"
import { createPromoCode, updatePromoCode, type PromoCodeFormInput } from "./actions"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { DatetimePicker } from "@/components/ui/datetime-picker"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: "create" | "edit"
  promo: PromoCode | null
}

function sanitizeCode(raw: string): string {
  return raw.replace(/\s+/g, "").toUpperCase()
}

export function PromoCodeDialog({ open, onOpenChange, mode, promo }: Props) {
  const [code, setCode] = useState("")
  const [discountType, setDiscountType] = useState<"percent" | "fixed">(
    "percent",
  )
  /** Проценты или леи в зависимости от типа (как в форме). */
  const [discountInput, setDiscountInput] = useState("")
  const [minOrderLei, setMinOrderLei] = useState("")
  const [maxUses, setMaxUses] = useState("")
  const [validFrom, setValidFrom] = useState<Date | undefined>(undefined)
  const [validUntil, setValidUntil] = useState<Date | undefined>(undefined)
  const [isActive, setIsActive] = useState(true)
  const [description, setDescription] = useState("")
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    if (!open) return
    if (mode === "edit" && promo) {
      setCode(promo.code)
      setDiscountType(promo.discount_type)
      if (promo.discount_type === "percent") {
        setDiscountInput(String(promo.discount_value))
      } else {
        setDiscountInput(String(promo.discount_value / 100))
      }
      setMinOrderLei(
        promo.min_order_bani != null ? String(promo.min_order_bani / 100) : "",
      )
      setMaxUses(promo.max_uses != null ? String(promo.max_uses) : "")
      setValidFrom(
        promo.valid_from && !Number.isNaN(new Date(promo.valid_from).getTime())
          ? new Date(promo.valid_from)
          : undefined,
      )
      setValidUntil(
        promo.valid_until && !Number.isNaN(new Date(promo.valid_until).getTime())
          ? new Date(promo.valid_until)
          : undefined,
      )
      setIsActive(promo.is_active)
      setDescription(promo.description ?? "")
    } else {
      setCode("")
      setDiscountType("percent")
      setDiscountInput("")
      setMinOrderLei("")
      setMaxUses("")
      setValidFrom(undefined)
      setValidUntil(undefined)
      setIsActive(true)
      setDescription("")
    }
  }, [open, mode, promo])

  function buildPayload(): PromoCodeFormInput | { error: string } {
    const normalizedCode = sanitizeCode(code)
    if (!normalizedCode) {
      return { error: "Укажите код" }
    }

    const dv = Number(discountInput.replace(",", "."))
    if (!Number.isFinite(dv) || dv <= 0) {
      return { error: "Размер скидки должен быть больше 0" }
    }

    if (discountType === "percent") {
      const p = Math.round(dv)
      if (p > 100) {
        return { error: "Процент не может быть больше 100" }
      }
    }

    const validFromIso = validFrom ? validFrom.toISOString() : null
    const validUntilIso = validUntil ? validUntil.toISOString() : null
    if (validFrom && validUntil && validFrom.getTime() >= validUntil.getTime()) {
      return { error: "«Действует с» должно быть раньше «Действует до»" }
    }

    let discount_value: number
    if (discountType === "percent") {
      discount_value = Math.round(dv)
    } else {
      discount_value = Math.round(dv * 100)
    }

    const minRaw = minOrderLei.trim()
    const min_order_bani =
      minRaw === ""
        ? null
        : Math.max(0, Math.round(Number(minRaw.replace(",", ".")) * 100))

    const maxRaw = maxUses.trim()
    let max_uses_parsed: number | null = null
    if (maxRaw !== "") {
      const n = parseInt(maxRaw, 10)
      if (Number.isNaN(n) || n < 0) {
        return { error: "Некорректное число использований" }
      }
      max_uses_parsed = n
    }

    return {
      code: normalizedCode,
      discount_type: discountType,
      discount_value,
      min_order_bani: min_order_bani === 0 ? null : min_order_bani,
      max_uses: max_uses_parsed,
      valid_from: validFromIso,
      valid_until: validUntilIso,
      is_active: isActive,
      description: description.trim() || null,
    }
  }

  function handleSave() {
    const built = buildPayload()
    if ("error" in built) {
      alert(built.error)
      return
    }
    startTransition(async () => {
      try {
        if (mode === "create") {
          await createPromoCode(built)
        } else if (promo) {
          await updatePromoCode(promo.id, built)
        }
        onOpenChange(false)
      } catch (e) {
        console.error(e)
        alert(e instanceof Error ? e.message : "Ошибка сохранения")
      }
    })
  }

  const discountLabel =
    discountType === "percent" ? "Размер скидки (%)" : "Размер скидки (лей)"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto shadow-none ring-0 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Новый промокод" : "Редактировать промокод"}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="promo-code">Код *</Label>
            <Input
              id="promo-code"
              value={code}
              onChange={(e) => setCode(sanitizeCode(e.target.value))}
              className="font-mono uppercase"
              autoComplete="off"
            />
          </div>
          <div className="grid gap-2">
            <Label>Тип скидки *</Label>
            <Select
              value={discountType}
              onValueChange={(v) => setDiscountType(v as "percent" | "fixed")}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="percent">Процент %</SelectItem>
                <SelectItem value="fixed">Фиксированная сумма</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="promo-discount">{discountLabel} *</Label>
            <Input
              id="promo-discount"
              type="number"
              min={0}
              step={discountType === "percent" ? 1 : 0.01}
              value={discountInput}
              onChange={(e) => setDiscountInput(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="promo-min">Мин. сумма заказа (лей)</Label>
            <Input
              id="promo-min"
              type="number"
              min={0}
              step={0.01}
              value={minOrderLei}
              onChange={(e) => setMinOrderLei(e.target.value)}
              placeholder="Не задано"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="promo-max">Макс. использований</Label>
            <Input
              id="promo-max"
              type="number"
              min={0}
              step={1}
              value={maxUses}
              onChange={(e) => setMaxUses(e.target.value)}
              placeholder="Безлимитно"
            />
          </div>
          <div className="grid gap-2 sm:grid-cols-2 sm:gap-4">
            <div className="grid gap-2">
              <Label htmlFor="promo-from">Действует с</Label>
              <DatetimePicker
                id="promo-from"
                value={validFrom}
                onChange={setValidFrom}
                placeholder="Не задано"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="promo-to">Действует до</Label>
              <DatetimePicker
                id="promo-to"
                value={validUntil}
                onChange={setValidUntil}
                placeholder="Не задано"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="promo-active"
              checked={isActive}
              onCheckedChange={setIsActive}
            />
            <Label htmlFor="promo-active">Активен</Label>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="promo-desc">Описание (заметка)</Label>
            <Textarea
              id="promo-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Внутренняя заметка"
            />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button onClick={handleSave} disabled={pending}>
            {pending ? "Сохранение..." : "Сохранить"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
