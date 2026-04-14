"use client"

import { useTransition } from "react"
import type { Promotion } from "@/types/database"
import { deletePromotion } from "./actions"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

type Props = {
  promotion: Promotion | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function DeletePromotionDialog({
  promotion,
  open,
  onOpenChange,
}: Props) {
  const [pending, startTransition] = useTransition()

  function handleDelete() {
    if (!promotion) return
    startTransition(async () => {
      try {
        await deletePromotion(promotion.id)
        onOpenChange(false)
      } catch (e) {
        console.error(e)
        alert(e instanceof Error ? e.message : "Ошибка удаления")
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="shadow-none ring-0 sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Удалить акцию?</DialogTitle>
          <DialogDescription>
            Вы уверены? Это действие нельзя отменить.
            {promotion ? (
              <>
                <br />
                <span className="text-foreground font-mono text-sm">
                  id: {promotion.id.slice(0, 8)}…
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
            disabled={pending || !promotion}
          >
            {pending ? "Удаление..." : "Удалить"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
