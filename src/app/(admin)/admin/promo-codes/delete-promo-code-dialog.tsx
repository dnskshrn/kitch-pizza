"use client"

import { useTransition } from "react"
import type { PromoCode } from "@/types/database"
import { deletePromoCode } from "./actions"
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
  promo: PromoCode | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function DeletePromoCodeDialog({
  promo,
  open,
  onOpenChange,
}: Props) {
  const [pending, startTransition] = useTransition()

  function handleDelete() {
    if (!promo) return
    startTransition(async () => {
      try {
        await deletePromoCode(promo.id)
        onOpenChange(false)
      } catch (e) {
        console.error(e)
        alert(e instanceof Error ? e.message : "Ошибка удаления")
      }
    })
  }

  const used = promo && promo.uses_count > 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="shadow-none ring-0 sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Удалить промокод?</DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-2 text-sm">
              <p>Вы уверены? Это действие нельзя отменить.</p>
              {promo ? (
                <p className="text-foreground font-mono text-sm uppercase">
                  {promo.code}
                </p>
              ) : null}
              {used ? (
                <p className="text-foreground">
                  Этот промокод уже был использован {promo!.uses_count} раз.
                  Удалить всё равно?
                </p>
              ) : null}
            </div>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={pending || !promo}
          >
            {pending ? "Удаление..." : "Удалить"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
