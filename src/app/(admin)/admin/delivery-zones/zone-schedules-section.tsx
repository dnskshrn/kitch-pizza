"use client"

import {
  createSchedule,
  deleteSchedule,
} from "@/lib/actions/admin/delivery-zone-schedules"
import type { DeliveryZoneSchedule } from "@/types/database"
import { useRouter } from "next/navigation"
import { useEffect, useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Trash2 } from "lucide-react"
import {
  formatLei,
  formatScheduleWindow,
  sortSchedules,
} from "./zone-schedule-utils"

type Props = {
  zoneId: string
  schedules: DeliveryZoneSchedule[]
}

const emptyForm = {
  fromTime: "",
  toTime: "",
  deliveryTimeMin: "",
  priceLei: "",
  minOrderLei: "",
  freeFromLei: "",
}

export function ZoneSchedulesSection({ zoneId, schedules: initial }: Props) {
  const router = useRouter()
  const [schedules, setSchedules] = useState(() => sortSchedules(initial))
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    setSchedules(sortSchedules(initial))
  }, [initial])

  function resetForm() {
    setForm(emptyForm)
    setFormError(null)
    setShowForm(false)
  }

  function validateForm(): {
    from_time: string
    to_time: string
    delivery_time_min: number
    delivery_price_bani: number
    min_order_bani: number
    free_delivery_from_bani: number | null
  } | null {
    const from = form.fromTime.trim()
    const to = form.toTime.trim()
    if (!from || !to) {
      setFormError("Укажите время «с» и «до»")
      return null
    }
    if (from === to) {
      setFormError("Время «с» и «до» не должны совпадать")
      return null
    }

    const deliveryTimeMin = Number(form.deliveryTimeMin)
    const priceLei = Number(form.priceLei.replace(",", "."))
    const minOrderLei = Number(form.minOrderLei.replace(",", "."))
    const freeRaw = form.freeFromLei.trim()

    if (!Number.isFinite(deliveryTimeMin) || deliveryTimeMin < 0) {
      setFormError("Укажите время доставки (мин)")
      return null
    }
    if (!Number.isFinite(priceLei) || priceLei < 0) {
      setFormError("Укажите стоимость доставки")
      return null
    }
    if (!Number.isFinite(minOrderLei) || minOrderLei < 0) {
      setFormError("Укажите минимальную сумму заказа")
      return null
    }
    if (freeRaw !== "") {
      const freeLei = Number(freeRaw.replace(",", "."))
      if (!Number.isFinite(freeLei) || freeLei < 0) {
        setFormError("Укажите корректную сумму для бесплатной доставки")
        return null
      }
    }

    setFormError(null)
    return {
      from_time: from,
      to_time: to,
      delivery_time_min: Math.round(deliveryTimeMin),
      delivery_price_bani: Math.round(priceLei * 100),
      min_order_bani: Math.round(minOrderLei * 100),
      free_delivery_from_bani:
        freeRaw === ""
          ? null
          : Math.round(Number(freeRaw.replace(",", ".")) * 100),
    }
  }

  function handleAddSlot() {
    const payload = validateForm()
    if (!payload) return

    startTransition(async () => {
      try {
        await createSchedule(zoneId, payload)
        resetForm()
        router.refresh()
      } catch (e) {
        setFormError(e instanceof Error ? e.message : "Ошибка сохранения")
      }
    })
  }

  function handleDelete(id: string) {
    if (!confirm("Удалить слот расписания?")) return
    startTransition(async () => {
      try {
        await deleteSchedule(id)
        router.refresh()
      } catch (e) {
        alert(e instanceof Error ? e.message : "Ошибка удаления")
      }
    })
  }

  return (
    <div className="border-border grid gap-4 border-t pt-4">
      <div>
        <h3 className="text-base font-semibold">Расписание работы зоны</h3>
        <p className="text-muted-foreground mt-1 text-sm">
          Нет слотов — зона работает круглосуточно по базовым параметрам выше.
          Добавьте слоты чтобы параметры менялись по времени.
        </p>
      </div>

      {schedules.length > 0 ? (
        <ul className="grid gap-2">
          {schedules.map((slot) => (
            <li
              key={slot.id}
              className="bg-muted/40 flex flex-wrap items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-sm"
            >
              <div className="grid min-w-0 flex-1 gap-0.5 sm:grid-cols-2 lg:grid-cols-4">
                <span className="font-medium">
                  {formatScheduleWindow(slot.from_time, slot.to_time)}
                </span>
                <span className="text-muted-foreground">
                  Доставка: {slot.delivery_time_min} мин ·{" "}
                  {formatLei(slot.delivery_price_bani)} MDL
                </span>
                <span className="text-muted-foreground">
                  Мин. заказ: {formatLei(slot.min_order_bani)} MDL
                </span>
                <span className="text-muted-foreground">
                  Бесплатно от:{" "}
                  {slot.free_delivery_from_bani != null
                    ? `${formatLei(slot.free_delivery_from_bani)} MDL`
                    : "—"}
                </span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Удалить слот"
                disabled={pending}
                onClick={() => handleDelete(slot.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground text-sm">Слотов пока нет.</p>
      )}

      {showForm ? (
        <div className="border-border grid gap-3 rounded-md border p-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="slot-from">Время с *</Label>
              <Input
                id="slot-from"
                type="time"
                required
                value={form.fromTime}
                onChange={(e) => {
                  setForm((f) => ({ ...f, fromTime: e.target.value }))
                  if (formError) setFormError(null)
                }}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="slot-to">Время до *</Label>
              <Input
                id="slot-to"
                type="time"
                required
                value={form.toTime}
                onChange={(e) => {
                  setForm((f) => ({ ...f, toTime: e.target.value }))
                  if (formError) setFormError(null)
                }}
              />
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="slot-delivery-min">Время доставки (мин) *</Label>
              <Input
                id="slot-delivery-min"
                type="number"
                min={0}
                step={1}
                value={form.deliveryTimeMin}
                onChange={(e) =>
                  setForm((f) => ({ ...f, deliveryTimeMin: e.target.value }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="slot-price">Стоимость доставки (MDL) *</Label>
              <Input
                id="slot-price"
                type="number"
                min={0}
                step={0.01}
                value={form.priceLei}
                onChange={(e) =>
                  setForm((f) => ({ ...f, priceLei: e.target.value }))
                }
              />
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="slot-min-order">Мин. сумма заказа (MDL) *</Label>
              <Input
                id="slot-min-order"
                type="number"
                min={0}
                step={0.01}
                value={form.minOrderLei}
                onChange={(e) =>
                  setForm((f) => ({ ...f, minOrderLei: e.target.value }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="slot-free-from">Бесплатная доставка от (MDL)</Label>
              <Input
                id="slot-free-from"
                type="number"
                min={0}
                step={0.01}
                value={form.freeFromLei}
                onChange={(e) =>
                  setForm((f) => ({ ...f, freeFromLei: e.target.value }))
                }
                placeholder="Не задано"
              />
            </div>
          </div>
          {formError ? (
            <p className="text-destructive text-sm" role="alert">
              {formError}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              onClick={handleAddSlot}
              disabled={pending}
            >
              {pending ? "Сохранение..." : "Сохранить слот"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={resetForm}
              disabled={pending}
            >
              Отмена
            </Button>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setShowForm(true)}
          disabled={pending}
        >
          Добавить слот
        </Button>
      )}
    </div>
  )
}
