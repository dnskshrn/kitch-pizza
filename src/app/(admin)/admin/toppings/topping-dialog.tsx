"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import type { Topping } from "@/types/database"
import { createTopping, updateTopping } from "./actions"
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

function leiToBani(lei: number) {
  return Math.round(lei * 100)
}

function baniToLei(bani: number | null | undefined) {
  if (bani === null || bani === undefined) return ""
  return String(bani / 100)
}

function parseLei(s: string): number | null {
  const t = s.trim().replace(",", ".")
  if (!t) return null
  const n = Number(t)
  if (Number.isNaN(n)) return null
  return n
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

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: "create" | "edit"
  groupId: string | null
  topping: Topping | null
}

export function ToppingDialog({
  open,
  onOpenChange,
  mode,
  groupId,
  topping,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [imageUrl, setImageUrl] = useState("")
  const [nameRu, setNameRu] = useState("")
  const [nameRo, setNameRo] = useState("")
  const [priceLei, setPriceLei] = useState("")
  const [sortOrder, setSortOrder] = useState(0)
  const [isActive, setIsActive] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    if (!open) return
    if (mode === "edit" && topping) {
      setImageUrl(topping.image_url ?? "")
      setNameRu(topping.name_ru ?? "")
      setNameRo(topping.name_ro ?? "")
      setPriceLei(baniToLei(topping.price))
      setSortOrder(topping.sort_order)
      setIsActive(topping.is_active)
    } else {
      setImageUrl("")
      setNameRu("")
      setNameRo("")
      setPriceLei("")
      setSortOrder(0)
      setIsActive(true)
    }
  }, [open, mode, topping])

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const url = await uploadFile(file)
      setImageUrl(url)
    } catch (err) {
      console.error(err)
      alert(err instanceof Error ? err.message : "Ошибка загрузки")
    } finally {
      setUploading(false)
      e.target.value = ""
    }
  }

  function handleSave() {
    const gid = groupId
    if (!gid) return
    const ru = (nameRu ?? "").trim()
    const ro = (nameRo ?? "").trim()
    if (!ru || !ro) return
    const lei = parseLei(priceLei)
    if (lei === null) {
      alert("Укажите цену в леях")
      return
    }
    const price = leiToBani(lei)
    const payload = {
      group_id: gid,
      name_ru: ru,
      name_ro: ro,
      price,
      sort_order: sortOrder,
      is_active: isActive,
      image_url: imageUrl.trim() || null,
    }
    startTransition(async () => {
      try {
        if (mode === "create") {
          await createTopping(payload)
        } else if (topping) {
          await updateTopping(topping.id, payload)
        }
        onOpenChange(false)
      } catch (e) {
        console.error(e)
        alert(e instanceof Error ? e.message : "Ошибка сохранения")
      }
    })
  }

  const canSave =
    !!groupId &&
    !!(nameRu ?? "").trim() &&
    !!(nameRo ?? "").trim() &&
    parseLei(priceLei) !== null &&
    !pending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Новый топпинг" : "Редактировать топпинг"}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label>Фото</Label>
            <div
              className="mx-auto w-full max-w-[200px] overflow-hidden rounded-md bg-transparent"
              style={{ aspectRatio: "1 / 1" }}
            >
              {imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imageUrl}
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
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageUpload}
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-4 w-4" />
                {uploading ? "Загрузка..." : "Загрузить фото"}
              </Button>
              {imageUrl ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setImageUrl("")}
                >
                  Удалить
                </Button>
              ) : null}
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="tp-name-ru">Название (RU)</Label>
            <Input
              id="tp-name-ru"
              value={nameRu}
              onChange={(e) => setNameRu(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="tp-name-ro">Название (RO)</Label>
            <Input
              id="tp-name-ro"
              value={nameRo}
              onChange={(e) => setNameRo(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="tp-price">Цена (лей)</Label>
            <Input
              id="tp-price"
              type="text"
              inputMode="decimal"
              value={priceLei}
              onChange={(e) => setPriceLei(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="tp-sort">Порядок</Label>
            <Input
              id="tp-sort"
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(Number(e.target.value) || 0)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="tp-active"
              checked={isActive}
              onCheckedChange={setIsActive}
            />
            <Label htmlFor="tp-active">Активен</Label>
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button onClick={handleSave} disabled={!canSave}>
            {pending ? "Сохранение..." : "Сохранить"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
