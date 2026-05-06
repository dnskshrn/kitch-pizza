"use client"

import { useEffect, useState, useTransition } from "react"
import type { Ingredient } from "@/types/database"
import { createIngredient, updateIngredient } from "./actions"
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

const UNITS = [
  { value: "g" as const, label: "кг" },
  { value: "ml" as const, label: "л" },
  { value: "pcs" as const, label: "шт" },
]

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: "create" | "edit"
  ingredient: Ingredient | null
}

export function IngredientDialog({ open, onOpenChange, mode, ingredient }: Props) {
  const [name, setName] = useState("")
  const [unit, setUnit] = useState<"g" | "ml" | "pcs">("g")
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    if (!open) return
    if (mode === "edit" && ingredient) {
      setName(ingredient.name ?? "")
      setUnit(ingredient.unit)
    } else {
      setName("")
      setUnit("g")
    }
  }, [open, mode, ingredient])

  function handleSave() {
    const trimmed = (name ?? "").trim()
    if (!trimmed) {
      alert("Укажите название ингредиента")
      return
    }
    const payload = {
      name: trimmed,
      unit,
    }
    startTransition(async () => {
      try {
        if (mode === "create") {
          await createIngredient(payload)
        } else if (ingredient) {
          await updateIngredient(ingredient.id, payload)
        }
        onOpenChange(false)
      } catch (e) {
        console.error(e)
        alert(e instanceof Error ? e.message : "Ошибка сохранения")
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Новый ингредиент" : "Редактировать ингредиент"}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="ingredient-name">Название</Label>
            <Input
              id="ingredient-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Название"
            />
          </div>
          <div className="grid gap-2">
            <Label>Единица измерения</Label>
            <Select value={unit} onValueChange={(v) => setUnit(v as "g" | "ml" | "pcs")}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {UNITS.map((u) => (
                  <SelectItem key={u.value} value={u.value}>
                    {u.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button onClick={handleSave} disabled={pending || !(name ?? "").trim()}>
            {pending ? "Сохранение..." : "Сохранить"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
