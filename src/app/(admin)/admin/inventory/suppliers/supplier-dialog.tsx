"use client"

import { useEffect, useState, useTransition } from "react"
import type { Supplier } from "@/types/database"
import { createSupplier, updateSupplier } from "./actions"
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
import { Textarea } from "@/components/ui/textarea"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: "create" | "edit"
  supplier: Supplier | null
}

export function SupplierDialog({ open, onOpenChange, mode, supplier }: Props) {
  const [name, setName] = useState("")
  const [contactPerson, setContactPerson] = useState("")
  const [phone, setPhone] = useState("")
  const [note, setNote] = useState("")
  const [isActive, setIsActive] = useState(true)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    if (!open) return
    if (mode === "edit" && supplier) {
      setName(supplier.name ?? "")
      setContactPerson(supplier.contact_person ?? "")
      setPhone(supplier.phone ?? "")
      setNote(supplier.note ?? "")
      setIsActive(supplier.is_active)
    } else {
      setName("")
      setContactPerson("")
      setPhone("")
      setNote("")
      setIsActive(true)
    }
  }, [open, mode, supplier])

  function handleSave() {
    const trimmedName = (name ?? "").trim()
    if (!trimmedName) {
      alert("Укажите название поставщика")
      return
    }
    const payload = {
      name: trimmedName,
      contact_person: (contactPerson ?? "").trim() || null,
      phone: (phone ?? "").trim() || null,
      note: (note ?? "").trim() || null,
      is_active: isActive,
    }
    startTransition(async () => {
      try {
        if (mode === "create") {
          await createSupplier(payload)
        } else if (supplier) {
          await updateSupplier(supplier.id, payload)
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
            {mode === "create" ? "Новый поставщик" : "Редактировать поставщика"}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="supplier-name">Название</Label>
            <Input
              id="supplier-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Название организации или контрагента"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="supplier-contact">Контактное лицо</Label>
            <Input
              id="supplier-contact"
              value={contactPerson}
              onChange={(e) => setContactPerson(e.target.value)}
              placeholder="Необязательно"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="supplier-phone">Телефон</Label>
            <Input
              id="supplier-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Необязательно"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="supplier-note">Примечание</Label>
            <Textarea
              id="supplier-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Необязательно"
              rows={3}
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="supplier-active"
              checked={isActive}
              onCheckedChange={setIsActive}
            />
            <Label htmlFor="supplier-active">Активен</Label>
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
