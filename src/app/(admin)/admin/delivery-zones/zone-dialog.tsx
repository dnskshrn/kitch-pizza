"use client"

import { useEffect, useState, useTransition } from "react"
import type { DeliveryZone } from "@/types/database"
import {
  createDeliveryZone,
  updateDeliveryZone,
  type DeliveryZoneInput,
} from "./actions"
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
import { Switch } from "@/components/ui/switch"
import dynamic from "next/dynamic"

const AdminDeliveryMap = dynamic(() => import("./admin-delivery-map"), {
  ssr: false,
  loading: () => (
    <div className="bg-muted h-[420px] w-full animate-pulse rounded-md border border-border" />
  ),
})

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: "create" | "edit"
  zone: DeliveryZone | null
  allZones: DeliveryZone[]
}

export function ZoneDialog({ open, onOpenChange, mode, zone, allZones }: Props) {
  const [name, setName] = useState("")
  const [polygon, setPolygon] = useState<[number, number][]>([])
  const [priceLei, setPriceLei] = useState("")
  const [minOrderLei, setMinOrderLei] = useState("")
  const [freeFromLei, setFreeFromLei] = useState("")
  const [timeMin, setTimeMin] = useState("45")
  const [isActive, setIsActive] = useState(true)
  const [sortOrder, setSortOrder] = useState("0")
  const [mapNonce, setMapNonce] = useState(0)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    if (!open) return
    if (mode === "edit" && zone) {
      setName(zone.name)
      setPolygon(
        Array.isArray(zone.polygon) ? (zone.polygon as [number, number][]) : [],
      )
      setPriceLei(String(zone.delivery_price_bani / 100))
      setMinOrderLei(String(zone.min_order_bani / 100))
      setFreeFromLei(
        zone.free_delivery_from_bani != null
          ? String(zone.free_delivery_from_bani / 100)
          : "",
      )
      setTimeMin(String(zone.delivery_time_min))
      setIsActive(zone.is_active)
      setSortOrder(String(zone.sort_order))
    } else {
      setName("")
      setPolygon([])
      setPriceLei("")
      setMinOrderLei("")
      setFreeFromLei("")
      setTimeMin("45")
      setIsActive(true)
      setSortOrder("0")
    }
    setMapNonce((n) => n + 1)
  }, [open, mode, zone])

  function handleSave() {
    const pLei = Number(priceLei.replace(",", "."))
    const mLei = Number(minOrderLei.replace(",", "."))
    const fRaw = freeFromLei.trim()
    const t = Number(timeMin)
    const so = Number(sortOrder)

    if (!name.trim()) {
      alert("Укажите название")
      return
    }
    if (!Number.isFinite(pLei) || pLei < 0) {
      alert("Укажите цену доставки")
      return
    }
    if (!Number.isFinite(mLei) || mLei < 0) {
      alert("Укажите минимальный заказ")
      return
    }
    if (!Number.isFinite(t) || t <= 0) {
      alert("Укажите время доставки")
      return
    }
    if (polygon.length < 3) {
      alert("Нарисуйте полигон (минимум 3 точки)")
      return
    }

    const payload: DeliveryZoneInput = {
      name: name.trim(),
      polygon,
      delivery_price_bani: Math.round(pLei * 100),
      min_order_bani: Math.round(mLei * 100),
      free_delivery_from_bani:
        fRaw === "" ? null : Math.max(0, Math.round(Number(fRaw.replace(",", ".")) * 100)),
      delivery_time_min: Math.round(t),
      is_active: isActive,
      sort_order: Number.isFinite(so) ? Math.round(so) : 0,
    }

    startTransition(async () => {
      try {
        if (mode === "create") {
          await createDeliveryZone(payload)
        } else if (zone) {
          await updateDeliveryZone(zone.id, payload)
        }
        onOpenChange(false)
      } catch (e) {
        console.error(e)
        alert(e instanceof Error ? e.message : "Ошибка сохранения")
      }
    })
  }

  const editingId = mode === "edit" && zone ? zone.id : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[95vh] overflow-y-auto shadow-none ring-0 sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Новая зона доставки" : "Редактировать зону"}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="dz-name">Название *</Label>
            <Input
              id="dz-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <div className="flex items-center justify-between gap-2">
              <Label>Зона на карте *</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setPolygon([])
                  setMapNonce((n) => n + 1)
                }}
              >
                Очистить полигон
              </Button>
            </div>
            <AdminDeliveryMap
              key={`${editingId ?? "new"}-${mapNonce}`}
              zones={allZones}
              editingId={editingId}
              polygon={polygon}
              onPolygonChange={setPolygon}
            />
            <p className="text-muted-foreground text-xs">
              {polygon.length} точек
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="dz-price">Цена доставки (лей) *</Label>
              <Input
                id="dz-price"
                type="number"
                min={0}
                step={0.01}
                value={priceLei}
                onChange={(e) => setPriceLei(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="dz-min">Мин. заказ (лей) *</Label>
              <Input
                id="dz-min"
                type="number"
                min={0}
                step={0.01}
                value={minOrderLei}
                onChange={(e) => setMinOrderLei(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="dz-free">Бесплатно от (лей)</Label>
              <Input
                id="dz-free"
                type="number"
                min={0}
                step={0.01}
                value={freeFromLei}
                onChange={(e) => setFreeFromLei(e.target.value)}
                placeholder="Не задано"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="dz-time">Время доставки (мин) *</Label>
              <Input
                id="dz-time"
                type="number"
                min={1}
                step={1}
                value={timeMin}
                onChange={(e) => setTimeMin(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <div className="flex items-center gap-2">
              <Switch
                id="dz-active"
                checked={isActive}
                onCheckedChange={setIsActive}
              />
              <Label htmlFor="dz-active">Активна</Label>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="dz-sort">Порядок</Label>
              <Input
                id="dz-sort"
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
              />
            </div>
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
