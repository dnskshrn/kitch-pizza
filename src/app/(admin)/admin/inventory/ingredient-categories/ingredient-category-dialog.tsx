"use client"

import { useEffect, useState, useTransition } from "react"
import {
  createIngredientCategory,
  updateIngredientCategory,
  type IngredientCategory,
} from "@/lib/actions/inventory/ingredient-categories"
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

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: "create" | "edit"
  category: IngredientCategory | null
}

export function IngredientCategoryDialog({
  open,
  onOpenChange,
  mode,
  category,
}: Props) {
  const [name, setName] = useState("")
  const [sortOrder, setSortOrder] = useState("0")
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    if (!open) return
    if (mode === "edit" && category) {
      setName(category.name ?? "")
      setSortOrder(String(category.sort_order ?? 0))
    } else {
      setName("")
      setSortOrder("0")
    }
  }, [open, mode, category])

  function handleSave() {
    const trimmedName = (name ?? "").trim()
    if (!trimmedName) {
      alert("Укажите название категории")
      return
    }
    const order = Number((sortOrder ?? "").trim())
    if (!Number.isFinite(order)) {
      alert("Укажите числовой порядок сортировки")
      return
    }

    startTransition(async () => {
      let err: string | undefined
      if (mode === "create") {
        const res = await createIngredientCategory(trimmedName, order)
        err = res.error
      } else if (category) {
        const res = await updateIngredientCategory(
          category.id,
          trimmedName,
          order
        )
        err = res.error
      }
      if (err) {
        alert(err)
        return
      }
      onOpenChange(false)
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === "create"
              ? "Новая категория"
              : "Редактировать категорию"}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="ingredient-category-name">Название</Label>
            <Input
              id="ingredient-category-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Например, Овощи"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="ingredient-category-sort">Порядок сортировки</Label>
            <Input
              id="ingredient-category-sort"
              type="number"
              inputMode="numeric"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button
            onClick={handleSave}
            disabled={pending || !(name ?? "").trim()}
          >
            {pending ? "Сохранение..." : "Сохранить"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
