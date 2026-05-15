"use client"

import { useEffect, useState, useTransition } from "react"
import type { Ingredient } from "@/types/database"
import {
  getIngredientCategories,
  type IngredientCategory,
} from "@/lib/actions/inventory/ingredient-categories"
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

const CATEGORY_NONE = "__none__"

function parseWastePercentInput(raw: string): number {
  const trimmed = raw.trim().replace(",", ".")
  if (trimmed === "") return 0
  const n = Number.parseFloat(trimmed)
  if (!Number.isFinite(n)) return 0
  const clamped = Math.min(100, Math.max(0, n))
  return Math.round(clamped * 10) / 10
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: "create" | "edit"
  ingredient: Ingredient | null
}

export function IngredientDialog({ open, onOpenChange, mode, ingredient }: Props) {
  const [name, setName] = useState("")
  const [unit, setUnit] = useState<"g" | "ml" | "pcs">("g")
  const [wastePercent, setWastePercent] = useState("0")
  const [categoryId, setCategoryId] = useState<string>(CATEGORY_NONE)
  const [categories, setCategories] = useState<IngredientCategory[]>([])
  const [categoriesLoading, setCategoriesLoading] = useState(false)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    if (!open) {
      setCategories([])
      setCategoriesLoading(false)
      return
    }
    let cancelled = false
    setCategoriesLoading(true)
    void (async () => {
      const res = await getIngredientCategories()
      if (cancelled) return
      setCategoriesLoading(false)
      if ("error" in res) {
        alert(res.error)
        setCategories([])
        return
      }
      setCategories(res.data)
    })()
    return () => {
      cancelled = true
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    if (mode === "edit" && ingredient) {
      setName(ingredient.name ?? "")
      setUnit(ingredient.unit)
      const w = Number(ingredient.waste_percent)
      setWastePercent(Number.isFinite(w) ? String(w) : "0")
      setCategoryId(ingredient.category_id ?? CATEGORY_NONE)
    } else {
      setName("")
      setUnit("g")
      setWastePercent("0")
      setCategoryId(CATEGORY_NONE)
    }
  }, [open, mode, ingredient])

  function handleSave() {
    const trimmed = (name ?? "").trim()
    if (!trimmed) {
      alert("Укажите название ингредиента")
      return
    }
    const waste_percent = parseWastePercentInput(wastePercent)
    const payload = {
      name: trimmed,
      unit,
      category_id:
        categoryId === CATEGORY_NONE || categoryId === "" ? null : categoryId,
      waste_percent,
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
            <Label>Категория</Label>
            <Select
              value={categoryId}
              onValueChange={setCategoryId}
              disabled={categoriesLoading}
            >
              <SelectTrigger className="w-full">
                <SelectValue
                  placeholder={
                    categoriesLoading ? "Загрузка…" : "Выберите категорию"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={CATEGORY_NONE}>Без категории</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
          <div className="grid gap-2">
            <Label htmlFor="ingredient-waste">% потерь при очистке</Label>
            <Input
              id="ingredient-waste"
              type="number"
              min={0}
              max={100}
              step={0.1}
              placeholder="0"
              value={wastePercent}
              onChange={(e) => setWastePercent(e.target.value)}
            />
            <p className="text-muted-foreground text-sm leading-snug">
              При вводе брутто в техкарте нетто = брутто × (1 − % / 100)
            </p>
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
