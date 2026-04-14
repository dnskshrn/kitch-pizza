"use client"

import { useEffect, useState, useTransition } from "react"
import type { Category } from "@/types/database"
import { createCategory, updateCategory } from "./actions"
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

function slugFromName(name: string | undefined) {
  return (name ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\p{L}\p{N}-]+/gu, "")
    .replace(/-+/g, "-")
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: "create" | "edit"
  category: Category | null
}

export function CategoryDialog({ open, onOpenChange, mode, category }: Props) {
  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [sortOrder, setSortOrder] = useState(0)
  const [isActive, setIsActive] = useState(true)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    if (!open) return
    if (mode === "edit" && category) {
      setName(category.name_ru ?? category.name_ro ?? "")
      setSlug(category.slug ?? "")
      setSortOrder(category.sort_order)
      setIsActive(category.is_active)
    } else {
      setName("")
      setSlug("")
      setSortOrder(0)
      setIsActive(true)
    }
  }, [open, mode, category])

  useEffect(() => {
    if (!open || mode === "edit") return
    setSlug(slugFromName(name))
  }, [name, open, mode])

  function handleSave() {
    const n = (name ?? "").trim()
    const payload = {
      name_ru: n,
      name_ro: n,
      slug: (slug ?? "").trim() || slugFromName(name),
      sort_order: sortOrder,
      is_active: isActive,
    }
    startTransition(async () => {
      try {
        if (mode === "create") {
          await createCategory(payload)
        } else if (category) {
          await updateCategory(category.id, payload)
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
            {mode === "create" ? "Новая категория" : "Редактировать категорию"}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="cat-name">Название</Label>
            <Input
              id="cat-name"
              value={name ?? ""}
              onChange={(e) => setName(e.target.value)}
              placeholder="Название"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="cat-slug">Slug</Label>
            <Input
              id="cat-slug"
              value={slug ?? ""}
              onChange={(e) =>
                setSlug(
                  e.target.value
                    .toLowerCase()
                    .replace(/\s+/g, "-")
                    .replace(/[^\p{L}\p{N}-]+/gu, "")
                )
              }
              placeholder="url-slug"
            />
            <p className="text-muted-foreground text-xs">
              Заполняется из названия; можно изменить вручную.
            </p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="cat-sort">Порядок сортировки</Label>
            <Input
              id="cat-sort"
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(Number(e.target.value) || 0)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="cat-active"
              checked={isActive}
              onCheckedChange={setIsActive}
            />
            <Label htmlFor="cat-active">Активна</Label>
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
