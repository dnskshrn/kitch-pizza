"use client"

import { useEffect, useState, useTransition } from "react"
import type { ToppingGroup } from "@/types/database"
import { createToppingGroup, updateToppingGroup } from "./actions"
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

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: "create" | "edit"
  group: ToppingGroup | null
}

export function ToppingGroupDialog({ open, onOpenChange, mode, group }: Props) {
  const [nameRu, setNameRu] = useState("")
  const [nameRo, setNameRo] = useState("")
  const [sortOrder, setSortOrder] = useState(0)
  const [isActive, setIsActive] = useState(true)
  /** Включено = без лимита выбора (max_selections = null). */
  const [unlimited, setUnlimited] = useState(true)
  const [maxPick, setMaxPick] = useState(1)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    if (!open) return
    if (mode === "edit" && group) {
      setNameRu(group.name_ru ?? "")
      setNameRo(group.name_ro ?? "")
      setSortOrder(group.sort_order)
      setIsActive(group.is_active)
      const cap = group.max_selections ?? null
      setUnlimited(cap == null)
      setMaxPick(cap != null && cap >= 1 ? cap : 1)
    } else {
      setNameRu("")
      setNameRo("")
      setSortOrder(0)
      setIsActive(true)
      setUnlimited(true)
      setMaxPick(1)
    }
  }, [open, mode, group])

  function handleSave() {
    const ru = (nameRu ?? "").trim()
    const ro = (nameRo ?? "").trim()
    if (!ru || !ro) return
    const cap =
      unlimited || maxPick < 1 ? null : Math.min(500, Math.floor(maxPick))
    const payload = {
      name_ru: ru,
      name_ro: ro,
      sort_order: sortOrder,
      is_active: isActive,
      max_selections: cap,
    }
    startTransition(async () => {
      try {
        if (mode === "create") {
          await createToppingGroup(payload)
        } else if (group) {
          await updateToppingGroup(group.id, payload)
        }
        onOpenChange(false)
      } catch (e) {
        console.error(e)
        alert(e instanceof Error ? e.message : "Ошибка сохранения")
      }
    })
  }

  const maxPickValid = unlimited || (Number.isFinite(maxPick) && maxPick >= 1)
  const canSave =
    !!(nameRu ?? "").trim() &&
    !!(nameRo ?? "").trim() &&
    maxPickValid &&
    !pending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Новая группа топпингов" : "Редактировать группу"}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="tg-name-ru">Название (RU)</Label>
            <Input
              id="tg-name-ru"
              value={nameRu}
              onChange={(e) => setNameRu(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="tg-name-ro">Название (RO)</Label>
            <Input
              id="tg-name-ro"
              value={nameRo}
              onChange={(e) => setNameRo(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="tg-sort">Порядок</Label>
            <Input
              id="tg-sort"
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(Number(e.target.value) || 0)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="tg-unlimited"
              checked={unlimited}
              onCheckedChange={setUnlimited}
            />
            <Label htmlFor="tg-unlimited">Безлимит</Label>
          </div>
          {!unlimited ? (
            <div className="grid gap-2">
              <Label htmlFor="tg-max-pick">Сколько можно выбрать</Label>
              <Input
                id="tg-max-pick"
                type="number"
                min={1}
                max={500}
                value={maxPick}
                onChange={(e) =>
                  setMaxPick(Number.parseInt(e.target.value, 10) || 0)
                }
              />
            </div>
          ) : null}
          <div className="flex items-center gap-2">
            <Switch
              id="tg-active"
              checked={isActive}
              onCheckedChange={setIsActive}
            />
            <Label htmlFor="tg-active">Активна</Label>
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button onClick={handleSave} disabled={!canSave}>
            {pending ? "Сохранение..." : "Сохранить"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
