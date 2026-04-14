"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import type { Promotion } from "@/types/database"
import { createPromotion, updatePromotion } from "./actions"
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
import { Upload } from "lucide-react"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: "create" | "edit"
  promotion: Promotion | null
}

async function uploadFile(file: File): Promise<string> {
  const fd = new FormData()
  fd.append("file", file)
  const res = await fetch("/api/upload", { method: "POST", body: fd })
  const json = (await res.json().catch(() => ({}))) as {
    url?: string
    error?: string
  }
  if (!res.ok) throw new Error(json.error ?? res.statusText)
  if (!json.url) throw new Error("Нет URL в ответе")
  return json.url
}

export function PromotionDialog({
  open,
  onOpenChange,
  mode,
  promotion,
}: Props) {
  const fileInputRuRef = useRef<HTMLInputElement>(null)
  const fileInputRoRef = useRef<HTMLInputElement>(null)
  const [imageUrlRu, setImageUrlRu] = useState("")
  const [imageUrlRo, setImageUrlRo] = useState("")
  const [sortOrder, setSortOrder] = useState(0)
  const [isActive, setIsActive] = useState(true)
  const [uploadingRu, setUploadingRu] = useState(false)
  const [uploadingRo, setUploadingRo] = useState(false)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    if (!open) return
    if (mode === "edit" && promotion) {
      setImageUrlRu(promotion.image_url_ru ?? "")
      setImageUrlRo(promotion.image_url_ro ?? "")
      setSortOrder(promotion.sort_order)
      setIsActive(promotion.is_active)
    } else {
      setImageUrlRu("")
      setImageUrlRo("")
      setSortOrder(0)
      setIsActive(true)
    }
  }, [open, mode, promotion])

  async function handleImageUploadRu(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingRu(true)
    try {
      const url = await uploadFile(file)
      setImageUrlRu(url)
    } catch (err) {
      console.error(err)
      alert(err instanceof Error ? err.message : "Ошибка загрузки")
    } finally {
      setUploadingRu(false)
      e.target.value = ""
    }
  }

  async function handleImageUploadRo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingRo(true)
    try {
      const url = await uploadFile(file)
      setImageUrlRo(url)
    } catch (err) {
      console.error(err)
      alert(err instanceof Error ? err.message : "Ошибка загрузки")
    } finally {
      setUploadingRo(false)
      e.target.value = ""
    }
  }

  function handleSave() {
    const payload = {
      image_url_ru: imageUrlRu.trim() || null,
      image_url_ro: imageUrlRo.trim() || null,
      sort_order: sortOrder,
      is_active: isActive,
    }
    startTransition(async () => {
      try {
        if (mode === "create") {
          await createPromotion(payload)
        } else if (promotion) {
          await updatePromotion(promotion.id, payload)
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
      <DialogContent className="max-h-[90vh] overflow-y-auto shadow-none ring-0 sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Новая акция" : "Редактировать акцию"}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Фото (RU)</Label>
              <div
                className="relative w-full max-w-full overflow-hidden rounded-md bg-transparent"
                style={{ aspectRatio: "4 / 3" }}
              >
                {imageUrlRu ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={imageUrlRu}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-muted-foreground flex h-full min-h-[120px] items-center justify-center rounded-md border border-dashed border-border text-xs">
                    нет фото
                  </span>
                )}
              </div>
              <input
                ref={fileInputRuRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageUploadRu}
              />
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                disabled={uploadingRu}
                onClick={() => fileInputRuRef.current?.click()}
              >
                <Upload className="h-4 w-4" />
                {uploadingRu ? "Загрузка..." : "Загрузить"}
              </Button>
            </div>
            <div className="grid gap-2">
              <Label>Фото (RO)</Label>
              <div
                className="relative w-full max-w-full overflow-hidden rounded-md bg-transparent"
                style={{ aspectRatio: "4 / 3" }}
              >
                {imageUrlRo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={imageUrlRo}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-muted-foreground flex h-full min-h-[120px] items-center justify-center rounded-md border border-dashed border-border text-xs">
                    нет фото
                  </span>
                )}
              </div>
              <input
                ref={fileInputRoRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageUploadRo}
              />
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                disabled={uploadingRo}
                onClick={() => fileInputRoRef.current?.click()}
              >
                <Upload className="h-4 w-4" />
                {uploadingRo ? "Загрузка..." : "Загрузить"}
              </Button>
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="promo-sort">Порядок сортировки</Label>
            <Input
              id="promo-sort"
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(Number(e.target.value) || 0)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="promo-active"
              checked={isActive}
              onCheckedChange={setIsActive}
            />
            <Label htmlFor="promo-active">Активна</Label>
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button onClick={handleSave} disabled={pending}>
            {pending ? "Сохранение..." : "Сохранить"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
