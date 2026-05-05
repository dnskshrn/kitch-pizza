"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import type { Category } from "@/types/database"
import { createCategory, updateCategory } from "./actions"
import { createClient } from "@/lib/supabase/client"
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
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [nameRu, setNameRu] = useState("")
  const [nameRo, setNameRo] = useState("")
  const [slug, setSlug] = useState("")
  const [sortOrder, setSortOrder] = useState(0)
  const [isActive, setIsActive] = useState(true)
  const [imageUrl, setImageUrl] = useState("")
  const [showInUpsell, setShowInUpsell] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    if (!open) return
    if (mode === "edit" && category) {
      setNameRu(category.name_ru ?? "")
      setNameRo(category.name_ro ?? "")
      setSlug(category.slug ?? "")
      setSortOrder(category.sort_order)
      setIsActive(category.is_active)
      setImageUrl(category.image_url ?? "")
      setShowInUpsell(category.show_in_upsell ?? false)
    } else {
      setNameRu("")
      setNameRo("")
      setSlug("")
      setSortOrder(0)
      setIsActive(true)
      setImageUrl("")
      setShowInUpsell(false)
    }
  }, [open, mode, category])

  useEffect(() => {
    if (!open || mode === "edit") return
    setSlug(slugFromName(nameRu))
  }, [nameRu, open, mode])

  function handleSave() {
    const ru = (nameRu ?? "").trim()
    const ro = (nameRo ?? "").trim()
    if (!ru || !ro) {
      alert("Укажите название на русском и румынском")
      return
    }
    const payload = {
      name_ru: ru,
      name_ro: ro,
      slug: (slug ?? "").trim() || slugFromName(nameRu),
      sort_order: sortOrder,
      is_active: isActive,
      image_url: (imageUrl ?? "").trim() || null,
      show_in_upsell: showInUpsell,
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

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const supabase = createClient()
      const safeName = file.name.replace(/[^\w.\-]+/g, "_")
      const path = `categories/${Date.now()}-${safeName}`
      const { error } = await supabase.storage.from("menu-images").upload(path, file, {
        cacheControl: "3600",
        upsert: false,
      })
      if (error) throw error
      const { data } = supabase.storage.from("menu-images").getPublicUrl(path)
      setImageUrl(data.publicUrl)
    } catch (err) {
      console.error(err)
      alert(err instanceof Error ? err.message : "Ошибка загрузки")
    } finally {
      setUploading(false)
      e.target.value = ""
    }
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
            <Label htmlFor="cat-name-ru">Название (RU)</Label>
            <Input
              id="cat-name-ru"
              value={nameRu ?? ""}
              onChange={(e) => setNameRu(e.target.value)}
              placeholder="Название на русском"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="cat-name-ro">Название (RO)</Label>
            <Input
              id="cat-name-ro"
              value={nameRo ?? ""}
              onChange={(e) => setNameRo(e.target.value)}
              placeholder="Denumire în română"
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
              Заполняется из названия (RU); можно изменить вручную.
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
          <div className="grid gap-2">
            <Label>Фото категории</Label>
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imageUrl}
                alt=""
                className="mb-2 aspect-square w-full max-w-[200px] rounded-md object-cover"
              />
            ) : null}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageUpload}
            />
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
            <p className="text-muted-foreground text-xs">
              или вставьте URL ниже
            </p>
            <Input
              value={imageUrl ?? ""}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="или вставьте URL"
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="cat-show-upsell"
              checked={showInUpsell}
              onCheckedChange={setShowInUpsell}
            />
            <Label htmlFor="cat-show-upsell">
              Показывать в апсейле корзины
            </Label>
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
            disabled={
              pending || !(nameRu ?? "").trim() || !(nameRo ?? "").trim()
            }
          >
            {pending ? "Сохранение..." : "Сохранить"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
