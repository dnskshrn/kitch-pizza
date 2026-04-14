"use client"

import { useTransition } from "react"
import type { DeliveryZone } from "@/types/database"
import { deleteDeliveryZone } from "./actions"
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
  zone: DeliveryZone | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function DeleteZoneDialog({ zone, open, onOpenChange }: Props) {
  const [pending, startTransition] = useTransition()

  function handleDelete() {
    if (!zone) return
    startTransition(async () => {
      try {
        await deleteDeliveryZone(zone.id)
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
          <DialogTitle>Удалить зону?</DialogTitle>
          <DialogDescription>
            {zone ? (
              <>
                Зона «{zone.name}» будет удалена безвозвратно.
                <br />
                <span className="text-foreground font-mono text-xs">{zone.id}</span>
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
            disabled={pending || !zone}
          >
            {pending ? "Удаление..." : "Удалить"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
