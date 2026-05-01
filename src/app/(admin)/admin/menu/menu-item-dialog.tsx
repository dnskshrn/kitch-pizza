"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import type { Category, MenuItem, ToppingGroup } from "@/types/database"
import {
  createMenuItem,
  getMenuItemToppingGroups,
  setMenuItemToppingGroups,
  updateMenuItem,
} from "./actions"
import { calcCompareAt } from "@/lib/discount"
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
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Upload } from "lucide-react"

function leiToBani(lei: number) {
  return Math.round(lei * 100)
}

function baniToLei(bani: number | null) {
  if (bani === null || bani === undefined) return ""
  return String(bani / 100)
}

function formatPreviewLeiFromBani(bani: number): string {
  return (bani / 100).toLocaleString("ro-MD", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
}

const TAG_NONE = "__none__" as const

const TAG_OPTIONS: { value: string; label: string }[] = [
  { value: TAG_NONE, label: "Без тега" },
  { value: "выгодно", label: "Выгодно" },
  { value: "новинка", label: "Новинка" },
  { value: "хит", label: "Хит" },
  { value: "острое", label: "Острое" },
  { value: "веган", label: "Веган" },
  { value: "постное", label: "Постное" },
]

function DiscountPreview({
  addDiscount,
  discountPercentStr,
  hasSizes,
  priceLei,
  sizeSLei,
  sizeLLei,
  parseLei,
}: {
  addDiscount: boolean
  discountPercentStr: string
  hasSizes: boolean
  priceLei: string
  sizeSLei: string
  sizeLLei: string
  parseLei: (s: string) => number | null
}) {
  const discountD = Number.parseInt(discountPercentStr.trim(), 10)
  const show =
    addDiscount &&
    Number.isFinite(discountD) &&
    discountD >= 1 &&
    discountD <= 90

  if (!show) return null

  if (hasSizes) {
    const s = parseLei(sizeSLei)
    const l = parseLei(sizeLLei)
    return (
      <div className="text-muted-foreground space-y-1 text-xs">
        {s !== null ? (
          <div>
            30см: {formatPreviewLeiFromBani(leiToBani(s))} лей →{" "}
            <span className="line-through text-gray-400">
              {formatPreviewLeiFromBani(
                calcCompareAt(leiToBani(s), discountD),
              )}{" "}
              лей
            </span>
          </div>
        ) : null}
        {l !== null ? (
          <div>
            33см: {formatPreviewLeiFromBani(leiToBani(l))} лей →{" "}
            <span className="line-through text-gray-400">
              {formatPreviewLeiFromBani(
                calcCompareAt(leiToBani(l), discountD),
              )}{" "}
              лей
            </span>
          </div>
        ) : null}
      </div>
    )
  }

  const p = parseLei(priceLei)
  if (p === null) return null
  return (
    <div className="text-muted-foreground text-xs">
      {formatPreviewLeiFromBani(leiToBani(p))} лей →{" "}
      <span className="line-through text-gray-400">
        {formatPreviewLeiFromBani(calcCompareAt(leiToBani(p), discountD))} лей
      </span>
    </div>
  )
}

type MenuItemRow = MenuItem & {
  category: { id: string; name_ru: string; name_ro: string } | null
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: "create" | "edit"
  item: MenuItemRow | null
  categories: Pick<Category, "id" | "name_ru" | "name_ro">[]
  toppingGroups: ToppingGroup[]
}

export function MenuItemDialog({
  open,
  onOpenChange,
  mode,
  item,
  categories,
  toppingGroups,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [categoryId, setCategoryId] = useState("")
  const [nameRu, setNameRu] = useState("")
  const [nameRo, setNameRo] = useState("")
  const [descriptionRu, setDescriptionRu] = useState("")
  const [descriptionRo, setDescriptionRo] = useState("")
  const [imageUrl, setImageUrl] = useState("")
  const [hasSizes, setHasSizes] = useState(false)
  const [priceLei, setPriceLei] = useState("")
  const [sizeSLei, setSizeSLei] = useState("")
  const [sizeLLei, setSizeLLei] = useState("")
  const [weightGramsStr, setWeightGramsStr] = useState("")
  const [sizeSWeightStr, setSizeSWeightStr] = useState("")
  const [sizeLWeightStr, setSizeLWeightStr] = useState("")
  const [sizeSLabelStr, setSizeSLabelStr] = useState("")
  const [sizeLLabelStr, setSizeLLabelStr] = useState("")
  const [isActive, setIsActive] = useState(true)
  const [sortOrder, setSortOrder] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [pending, startTransition] = useTransition()
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([])
  const [addDiscount, setAddDiscount] = useState(false)
  const [discountPercentStr, setDiscountPercentStr] = useState("")
  const [tagValue, setTagValue] = useState<string>(TAG_NONE)
  const itemId = item?.id

  useEffect(() => {
    if (!open) return
    if (mode === "edit" && item) {
      setCategoryId(item.category_id)
      setNameRu(item.name_ru ?? "")
      setNameRo((item.name_ro && item.name_ro.trim()) ? item.name_ro : item.name_ru ?? "")
      setDescriptionRu(item.description_ru ?? "")
      setDescriptionRo(item.description_ro ?? "")
      setImageUrl(item.image_url ?? "")
      setHasSizes(item.has_sizes)
      setPriceLei(baniToLei(item.price))
      setSizeSLei(baniToLei(item.size_s_price))
      setSizeLLei(baniToLei(item.size_l_price))
      setWeightGramsStr(
        item.weight_grams != null ? String(item.weight_grams) : "",
      )
      setSizeSWeightStr(
        item.size_s_weight != null ? String(item.size_s_weight) : "",
      )
      setSizeLWeightStr(
        item.size_l_weight != null ? String(item.size_l_weight) : "",
      )
      setSizeSLabelStr(item.size_s_label ?? "")
      setSizeLLabelStr(item.size_l_label ?? "")
      setIsActive(item.is_active)
      setSortOrder(item.sort_order)
      setAddDiscount(
        item.discount_percent != null && item.discount_percent > 0,
      )
      setDiscountPercentStr(
        item.discount_percent != null && item.discount_percent > 0
          ? String(item.discount_percent)
          : "",
      )
      setTagValue(item.tag && TAG_OPTIONS.some((o) => o.value === item.tag) ? item.tag : TAG_NONE)
    } else {
      const first = categories[0]?.id ?? ""
      setCategoryId(first)
      setNameRu("")
      setNameRo("")
      setDescriptionRu("")
      setDescriptionRo("")
      setImageUrl("")
      setHasSizes(false)
      setPriceLei("")
      setSizeSLei("")
      setSizeLLei("")
      setWeightGramsStr("")
      setSizeSWeightStr("")
      setSizeLWeightStr("")
      setSizeSLabelStr("")
      setSizeLLabelStr("")
      setIsActive(true)
      setSortOrder(0)
      setSelectedGroupIds([])
      setAddDiscount(false)
      setDiscountPercentStr("")
      setTagValue(TAG_NONE)
    }
  }, [open, mode, item, categories])

  useEffect(() => {
    if (!open || mode !== "edit" || !itemId) return
    let cancelled = false
    getMenuItemToppingGroups(itemId)
      .then((ids) => {
        if (!cancelled) setSelectedGroupIds(ids)
      })
      .catch((e) => {
        console.error(e)
        if (!cancelled) {
          alert(e instanceof Error ? e.message : "Не удалось загрузить группы топпингов")
        }
      })
    return () => {
      cancelled = true
    }
  }, [open, mode, itemId])

  function toggleGroupId(groupId: string) {
    setSelectedGroupIds((prev) =>
      prev.includes(groupId)
        ? prev.filter((id) => id !== groupId)
        : [...prev, groupId]
    )
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const supabase = createClient()
      const safeName = file.name.replace(/[^\w.\-]+/g, "_")
      const path = `${Date.now()}-${safeName}`
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

function parseLei(s: string): number | null {
  const t = s.trim().replace(",", ".")
  if (!t) return null
  const n = Number(t)
  if (Number.isNaN(n)) return null
  return n
}

/** Пустая строка → null; только неотрицательные целые граммы. */
function parseGrams(s: string): number | null | "invalid" {
  const t = s.trim()
  if (!t) return null
  if (!/^\d+$/.test(t)) return "invalid"
  const n = Number.parseInt(t, 10)
  if (!Number.isFinite(n)) return "invalid"
  return n
}

  function handleSave() {
    const cat = categoryId
    if (!cat) return
    if (!nameRu.trim() || !nameRo.trim()) {
      alert("Укажите название на русском и румынском")
      return
    }

    let discount_percent: number | null = null
    if (addDiscount) {
      const d = Number.parseInt(discountPercentStr.trim(), 10)
      if (!Number.isFinite(d) || d < 1 || d > 90) {
        alert("Укажите скидку от 1 до 90%")
        return
      }
      discount_percent = d
    }
    const tag = tagValue === TAG_NONE ? null : tagValue

    let payload: Parameters<typeof createMenuItem>[0]

    if (hasSizes) {
      const s = parseLei(sizeSLei)
      const l = parseLei(sizeLLei)
      if (s === null || l === null) {
        alert("Укажите цены для 30см и 33см в леях")
        return
      }
      const wS = parseGrams(sizeSWeightStr)
      const wL = parseGrams(sizeLWeightStr)
      if (wS === "invalid" || wL === "invalid") {
        alert("Вес укажите целым числом граммов или оставьте поле пустым")
        return
      }
      payload = {
        category_id: cat,
        name_ru: nameRu.trim(),
        name_ro: nameRo.trim(),
        description_ru: descriptionRu,
        description_ro: descriptionRo,
        image_url: imageUrl,
        has_sizes: true,
        weight_grams: null,
        size_s_weight: wS,
        size_l_weight: wL,
        price: null,
        size_s_label: sizeSLabelStr.trim() || null,
        size_l_label: sizeLLabelStr.trim() || null,
        size_s_price: leiToBani(s),
        size_l_price: leiToBani(l),
        is_active: isActive,
        sort_order: sortOrder,
        discount_percent,
        tag,
      }
    } else {
      const p = parseLei(priceLei)
      if (p === null) {
        alert("Укажите цену в леях")
        return
      }
      const wG = parseGrams(weightGramsStr)
      if (wG === "invalid") {
        alert("Вес укажите целым числом граммов или оставьте поле пустым")
        return
      }
      payload = {
        category_id: cat,
        name_ru: nameRu.trim(),
        name_ro: nameRo.trim(),
        description_ru: descriptionRu,
        description_ro: descriptionRo,
        image_url: imageUrl,
        has_sizes: false,
        weight_grams: wG,
        size_s_weight: null,
        size_l_weight: null,
        price: leiToBani(p),
        size_s_label: null,
        size_l_label: sizeLLabelStr.trim() || null,
        size_s_price: null,
        size_l_price: null,
        is_active: isActive,
        sort_order: sortOrder,
        discount_percent,
        tag,
      }
    }

    startTransition(async () => {
      try {
        if (mode === "create") {
          const newId = await createMenuItem(payload)
          await setMenuItemToppingGroups(newId, selectedGroupIds)
        } else if (item) {
          await updateMenuItem(item.id, payload)
          await setMenuItemToppingGroups(item.id, selectedGroupIds)
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
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Новая позиция" : "Редактировать позицию"}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label>Категория</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Выберите категорию" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name_ru} · {c.name_ro}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="mi-name-ru">Название (RU)</Label>
            <Input
              id="mi-name-ru"
              value={nameRu}
              onChange={(e) => setNameRu(e.target.value)}
              placeholder="Например: 4 сыра"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="mi-name-ro">Название (RO)</Label>
            <Input
              id="mi-name-ro"
              value={nameRo}
              onChange={(e) => setNameRo(e.target.value)}
              placeholder="De ex.: 4 brânzeturi"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="mi-desc-ru">Описание (RU)</Label>
            <Textarea
              id="mi-desc-ru"
              value={descriptionRu}
              onChange={(e) => setDescriptionRu(e.target.value)}
              rows={3}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="mi-desc-ro">Описание (RO)</Label>
            <Textarea
              id="mi-desc-ro"
              value={descriptionRo}
              onChange={(e) => setDescriptionRo(e.target.value)}
              rows={3}
            />
          </div>
          <div className="grid gap-2">
            <Label>Фото</Label>
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
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="или вставьте URL"
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="mi-sizes"
              checked={hasSizes}
              onCheckedChange={setHasSizes}
            />
            <Label htmlFor="mi-sizes">Есть размеры?</Label>
          </div>
          {hasSizes ? (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="mi-s">Цена S (лей)</Label>
                  <Input
                    id="mi-s"
                    type="text"
                    inputMode="decimal"
                    value={sizeSLei}
                    onChange={(e) => setSizeSLei(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="mi-l">Цена L (лей)</Label>
                  <Input
                    id="mi-l"
                    type="text"
                    inputMode="decimal"
                    value={sizeLLei}
                    onChange={(e) => setSizeLLei(e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="mi-label-s">Название S</Label>
                  <Input
                    id="mi-label-s"
                    type="text"
                    value={sizeSLabelStr}
                    onChange={(e) => setSizeSLabelStr(e.target.value)}
                    placeholder="напр. 30см или 6шт."
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="mi-label-l">Название L</Label>
                  <Input
                    id="mi-label-l"
                    type="text"
                    value={sizeLLabelStr}
                    onChange={(e) => setSizeLLabelStr(e.target.value)}
                    placeholder="напр. 33см или 9шт."
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="mi-w-s">Вес S (гр)</Label>
                  <Input
                    id="mi-w-s"
                    type="text"
                    inputMode="numeric"
                    value={sizeSWeightStr}
                    onChange={(e) => setSizeSWeightStr(e.target.value)}
                    placeholder="Необязательно"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="mi-w-l">Вес L (гр)</Label>
                  <Input
                    id="mi-w-l"
                    type="text"
                    inputMode="numeric"
                    value={sizeLWeightStr}
                    onChange={(e) => setSizeLWeightStr(e.target.value)}
                    placeholder="Необязательно"
                  />
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="grid gap-2">
                <Label htmlFor="mi-price">Цена (лей)</Label>
                <Input
                  id="mi-price"
                  type="text"
                  inputMode="decimal"
                  value={priceLei}
                  onChange={(e) => setPriceLei(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="mi-weight-g">Вес (гр)</Label>
                <Input
                  id="mi-weight-g"
                  type="text"
                  inputMode="numeric"
                  value={weightGramsStr}
                  onChange={(e) => setWeightGramsStr(e.target.value)}
                  placeholder="Необязательно"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="mi-portion-label">Название порции (необяз.)</Label>
                <Input
                  id="mi-portion-label"
                  type="text"
                  value={sizeLLabelStr}
                  onChange={(e) => setSizeLLabelStr(e.target.value)}
                  placeholder="напр. стандарт"
                />
              </div>
            </>
          )}
          <div className="flex items-center gap-2">
            <Switch
              id="mi-active"
              checked={isActive}
              onCheckedChange={setIsActive}
            />
            <Label htmlFor="mi-active">Активна</Label>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="mi-sort">Порядок</Label>
            <Input
              id="mi-sort"
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(Number(e.target.value) || 0)}
            />
          </div>
          <div className="grid gap-2">
            <Label className="text-base font-medium">Группы топпингов</Label>
            {toppingGroups.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                Нет активных групп топпингов (настройте в разделе «Топпинги»).
              </p>
            ) : (
              <ul className="max-h-48 space-y-2 overflow-y-auto rounded-md border p-3">
                {toppingGroups.map((g) => (
                  <li key={g.id}>
                    <label className="flex cursor-pointer items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="border-input size-4 rounded"
                        checked={selectedGroupIds.includes(g.id)}
                        onChange={() => toggleGroupId(g.id)}
                      />
                      <span>{g.name_ru}</span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="grid gap-3 border-t pt-4">
            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                className="border-input size-4 rounded"
                checked={addDiscount}
                onChange={(e) => setAddDiscount(e.target.checked)}
              />
              Добавить скидку
            </label>
            {addDiscount ? (
              <div className="grid gap-2">
                <Label htmlFor="mi-discount">Скидка %</Label>
                <Input
                  id="mi-discount"
                  type="number"
                  min={1}
                  max={90}
                  placeholder="Скидка %"
                  value={discountPercentStr}
                  onChange={(e) => setDiscountPercentStr(e.target.value)}
                />
                <DiscountPreview
                  addDiscount={addDiscount}
                  discountPercentStr={discountPercentStr}
                  hasSizes={hasSizes}
                  priceLei={priceLei}
                  sizeSLei={sizeSLei}
                  sizeLLei={sizeLLei}
                  parseLei={parseLei}
                />
              </div>
            ) : null}
          </div>
          <div className="grid gap-2">
            <Label>Тег</Label>
            <Select value={tagValue} onValueChange={setTagValue}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Тег" />
              </SelectTrigger>
              <SelectContent>
                {TAG_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button
            onClick={handleSave}
            disabled={pending || !nameRu.trim() || !nameRo.trim()}
          >
            {pending ? "Сохранение..." : "Сохранить"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
