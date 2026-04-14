"use client"

import { useTransition } from "react"
import type { Category } from "@/types/database"
import { deleteCategory } from "./actions"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"

type Props = {
  category: Category | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function DeleteCategoryDialog({ category, open, onOpenChange }: Props) {
  const [pending, startTransition] = useTransition()

  function handleDelete() {
    if (!category) return
    startTransition(async () => {
      try {
        await deleteCategory(category.id)
        onOpenChange(false)
      } catch (e) {
        console.error(e)
        alert(e instanceof Error ? e.message : "Ошибка удаления")
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Удалить категорию?</DialogTitle>
          <DialogDescription>
            Вы уверены? Это действие нельзя отменить.
            {category ? (
              <>
                <br />
                <span className="text-foreground font-medium">
                  {category.name_ru}
                </span>
              </>
            ) : null}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={pending || !category}
          >
            {pending ? "Удаление..." : "Удалить"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
