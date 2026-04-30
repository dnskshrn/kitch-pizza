"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import type { Topping } from "@/types/database"
import { copyToppingToGroup } from "./actions"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

function toppingLabel(topping: Topping) {
  return `${topping.name_ru} / ${topping.name_ro}`
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  groupId: string | null
  toppings: Topping[]
}

export function AddExistingToppingDialog({
  open,
  onOpenChange,
  groupId,
  toppings,
}: Props) {
  const [selectedToppingId, setSelectedToppingId] = useState("")
  const [pending, startTransition] = useTransition()

  const availableToppings = useMemo(() => {
    const currentGroupKeys = new Set(
      toppings
        .filter((t) => t.group_id === groupId)
        .map((t) => `${t.name_ru}::${t.name_ro}::${t.price}`),
    )

    return toppings.filter((t) => {
      if (t.group_id === groupId) return false
      return !currentGroupKeys.has(`${t.name_ru}::${t.name_ro}::${t.price}`)
    })
  }, [groupId, toppings])

  useEffect(() => {
    if (!open) return
    setSelectedToppingId(availableToppings[0]?.id ?? "")
  }, [availableToppings, open])

  function handleSave() {
    if (!groupId || !selectedToppingId) return

    startTransition(async () => {
      try {
        await copyToppingToGroup({
          group_id: groupId,
          topping_id: selectedToppingId,
        })
        onOpenChange(false)
      } catch (e) {
        console.error(e)
        alert(e instanceof Error ? e.message : "Ошибка добавления")
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Добавить существующий топпинг</DialogTitle>
        </DialogHeader>

        <div className="grid gap-2 py-2">
          <Label>Топпинг</Label>
          {availableToppings.length === 0 ? (
            <p className="text-muted-foreground rounded-lg border border-dashed border-border p-4 text-sm">
              Нет доступных топпингов из других групп.
            </p>
          ) : (
            <Select
              value={selectedToppingId}
              onValueChange={setSelectedToppingId}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Выберите топпинг" />
              </SelectTrigger>
              <SelectContent>
                {availableToppings.map((topping) => (
                  <SelectItem key={topping.id} value={topping.id}>
                    {toppingLabel(topping)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <p className="text-muted-foreground text-xs">
            Будет создана копия топпинга в выбранной группе. Оригинал останется
            в своей текущей группе.
          </p>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button
            onClick={handleSave}
            disabled={!groupId || !selectedToppingId || pending}
          >
            {pending ? "Добавление..." : "Добавить"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
