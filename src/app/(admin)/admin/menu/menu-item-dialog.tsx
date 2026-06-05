"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import type { Category, MenuItem, ToppingGroup } from "@/types/database"
import {
  createMenuItem,
  getMenuItemToppingGroups,
  setMenuItemToppingGroups,
  updateMenuItem,
  type MenuItemToppingGroupAttachment,
} from "./actions"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
import { Trash2, Upload } from "lucide-react"

function leiToBani(lei: number) {
  return Math.round(lei * 100)
}

function baniToLei(bani: number | null) {
  if (bani === null || bani === undefined) return ""
  return String(bani / 100)
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

type VariantDraft = {
  id?: string
  name_ru: string
  name_ro: string
  priceLei: string
  aggregatorPriceLei: string
  weightStr: string
}

function parseLei(s: string): number | null {
  const t = s.trim().replace(",", ".")
  if (!t) return null
  const n = Number(t)
  if (Number.isNaN(n)) return null
  return n
}

function optionalLeiToBani(s: string): number | null {
  const lei = parseLei(s)
  return lei === null ? null : leiToBani(lei)
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
  const [variants, setVariants] = useState<VariantDraft[]>([])
  const [priceLei, setPriceLei] = useState("")
  const [aggregatorPriceLei, setAggregatorPriceLei] = useState("")
  const [weightGramsStr, setWeightGramsStr] = useState("")
  const [portionLabelStr, setPortionLabelStr] = useState("")
  const [isActive, setIsActive] = useState(true)
  const [sortOrder, setSortOrder] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [pending, startTransition] = useTransition()
  const [groupAttachments, setGroupAttachments] = useState<
    Record<string, number>
  >({})
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
      setAggregatorPriceLei(baniToLei(item.aggregator_price_bani))
      setWeightGramsStr(
        item.weight_grams != null ? String(item.weight_grams) : "",
      )
      setPortionLabelStr("")
      setIsActive(item.is_active)
      setSortOrder(item.sort_order)
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
      setVariants([])
      setPriceLei("")
      setAggregatorPriceLei("")
      setWeightGramsStr("")
      setPortionLabelStr("")
      setIsActive(true)
      setSortOrder(0)
      setGroupAttachments({})
      setTagValue(TAG_NONE)
    }
  }, [open, mode, item, categories])

  useEffect(() => {
    if (!open || mode !== "edit" || !itemId) return
    let cancelled = false
    const supabase = createClient()
    void Promise.all([
      getMenuItemToppingGroups(itemId),
      supabase
        .from("menu_item_variants")
        .select("*")
        .eq("menu_item_id", itemId)
        .order("sort_order", { ascending: true }),
    ])
      .then(([attachments, variantsRes]) => {
        if (cancelled) return
        const { data, error } = variantsRes
        if (error) throw new Error(error.message)
        setGroupAttachments(
          Object.fromEntries(
            attachments.map((a) => [a.topping_group_id, a.free_count]),
          ),
        )
        setVariants(
          data?.map((v) => ({
            id: v.id as string,
            name_ru: v.name_ru as string,
            name_ro: (v.name_ro as string) ?? "",
            priceLei: String((v.price as number) / 100),
            aggregatorPriceLei: baniToLei(
              (v.aggregator_price_bani as number | null) ?? null,
            ),
            weightStr:
              v.weight_grams != null ? String(v.weight_grams as number) : "",
          })) ?? [],
        )
      })
      .catch((e) => {
        console.error(e)
        if (!cancelled) {
          alert(
            e instanceof Error
              ? e.message
              : "Не удалось загрузить данные топпингов или вариантов",
          )
        }
      })
    return () => {
      cancelled = true
    }
  }, [open, mode, itemId])

  function toggleGroupId(groupId: string) {
    setGroupAttachments((prev) => {
      if (groupId in prev) {
        const next = { ...prev }
        delete next[groupId]
        return next
      }
      return { ...prev, [groupId]: 0 }
    })
  }

  function setGroupFreeCount(groupId: string, raw: string) {
    const parsed = Number.parseInt(raw.trim(), 10)
    const freeCount =
      Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
    setGroupAttachments((prev) => ({ ...prev, [groupId]: freeCount }))
  }

  function toppingGroupAttachments(): MenuItemToppingGroupAttachment[] {
    return Object.entries(groupAttachments).map(
      ([topping_group_id, free_count]) => ({
        topping_group_id,
        free_count: Math.max(0, Math.floor(free_count)),
      }),
    )
  }

  function patchVariant(index: number, patch: Partial<VariantDraft>) {
    setVariants((prev) =>
      prev.map((v, i) => (i === index ? { ...v, ...patch } : v)),
    )
  }

  function appendVariant() {
    setVariants((prev) => [
      ...prev,
      {
        name_ru: "",
        name_ro: "",
        priceLei: "",
        aggregatorPriceLei: "",
        weightStr: "",
      },
    ])
  }

  function removeVariant(index: number) {
    setVariants((prev) => prev.filter((_, i) => i !== index))
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



  async function persistMenuItemVariants(menuItemId: string, drafts: VariantDraft[]) {
    const supabase = createClient()
    const parsed = drafts.map((v, idx) => {
      const price = parseLei(v.priceLei)
      if (price === null) throw new Error("invalid_price_row")
      const w = parseGrams(v.weightStr)
      if (w === "invalid") throw new Error("invalid_weight_row")
      return {
        id: v.id as string | undefined,
        name_ru: v.name_ru.trim(),
        name_ro: v.name_ro.trim(),
        price: leiToBani(price),
        aggregator_price_bani: optionalLeiToBani(v.aggregatorPriceLei),
        weight_grams: w === null ? null : w,
        sort_order: idx,
      }
    })

    const keepIds = new Set(
      parsed.map((r) => r.id).filter((id): id is string => Boolean(id)),
    )
    const { data: existingRows, error: selErr } = await supabase
      .from("menu_item_variants")
      .select("id")
      .eq("menu_item_id", menuItemId)
    if (selErr) throw new Error(selErr.message)
    const toDelete = (existingRows ?? [])
      .map((row) => row.id as string)
      .filter((id) => !keepIds.has(id))
    if (toDelete.length > 0) {
      const { error: delErr } = await supabase
        .from("menu_item_variants")
        .delete()
        .in("id", toDelete)
      if (delErr) throw new Error(delErr.message)
    }

    for (let i = 0; i < parsed.length; i++) {
      const row = parsed[i]
      const base = {
        name_ru: row.name_ru,
        name_ro: row.name_ro,
        price: row.price,
        aggregator_price_bani: row.aggregator_price_bani,
        weight_grams: row.weight_grams,
        sort_order: row.sort_order,
      }
      if (row.id) {
        const { error: upErr } = await supabase
          .from("menu_item_variants")
          .update(base)
          .eq("id", row.id)
        if (upErr) throw new Error(upErr.message)
      } else {
        const { error: insErr } = await supabase
          .from("menu_item_variants")
          .insert({ ...base, menu_item_id: menuItemId })
        if (insErr) throw new Error(insErr.message)
      }
    }
  }

  function handleSave() {
    const cat = categoryId
    if (!cat) return
    if (!nameRu.trim() || !nameRo.trim()) {
      alert("Укажите название на русском и румынском")
      return
    }

    const tag = tagValue === TAG_NONE ? null : tagValue

    let payload: Parameters<typeof createMenuItem>[0]

    if (hasSizes) {
      if (variants.length === 0) {
        alert("Добавьте хотя бы один вариант")
        return
      }
      for (const v of variants) {
        if (!v.name_ru.trim()) {
          alert("Укажите название (RU) для каждого варианта")
          return
        }
        const price = parseLei(v.priceLei)
        if (price === null) {
          alert("Укажите корректную цену в леях для каждого варианта")
          return
        }
        const w = parseGrams(v.weightStr)
        if (w === "invalid") {
          alert("Вес укажите целым числом граммов или оставьте поле пустым")
          return
        }
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
        price: null,
        aggregator_price_bani: null,
        is_active: isActive,
        sort_order: sortOrder,
        discount_percent: null,
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
        price: leiToBani(p),
        aggregator_price_bani: optionalLeiToBani(aggregatorPriceLei),
        is_active: isActive,
        sort_order: sortOrder,
        discount_percent: null,
        tag,
      }
    }

    startTransition(async () => {
      try {
        const supabase = createClient()
        let resolvedId: string | undefined
        if (mode === "create") {
          resolvedId = await createMenuItem(payload)
          await setMenuItemToppingGroups(resolvedId, toppingGroupAttachments())
        } else if (item) {
          await updateMenuItem(item.id, payload)
          resolvedId = item.id
          await setMenuItemToppingGroups(item.id, toppingGroupAttachments())
        }
        if (resolvedId) {
          if (hasSizes) {
            await persistMenuItemVariants(resolvedId, variants)
          } else {
            const { error: clearErr } = await supabase
              .from("menu_item_variants")
              .delete()
              .eq("menu_item_id", resolvedId)
            if (clearErr) throw new Error(clearErr.message)
          }
        }
        onOpenChange(false)
      } catch (e) {
        console.error(e)
        if (e instanceof Error && e.message === "invalid_price_row") {
          alert("Укажите корректную цену в леях для каждого варианта")
        } else if (e instanceof Error && e.message === "invalid_weight_row") {
          alert("Вес укажите целым числом граммов или оставьте поле пустым")
        } else {
          alert(e instanceof Error ? e.message : "Ошибка сохранения")
        }
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
              onCheckedChange={(v) => {
                setHasSizes(v)
                if (!v) setVariants([])
              }}
            />
            <Label htmlFor="mi-sizes">Есть размеры?</Label>
          </div>
          {hasSizes ? (
            <div className="space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <Label className="font-medium">Варианты</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => appendVariant()}
                >
                  Добавить вариант
                </Button>
              </div>
              {variants.map((v, i) => (
                <div
                  key={v.id ?? `new-${i}`}
                  className="space-y-2 rounded-lg border bg-muted/30 p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-muted-foreground text-xs">
                      Вариант {i + 1}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8 shrink-0 text-destructive"
                      onClick={() => removeVariant(i)}
                      aria-label="Удалить вариант"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="grid gap-1.5">
                      <Label htmlFor={`mi-var-ru-${i}`}>Название (RU)</Label>
                      <Input
                        id={`mi-var-ru-${i}`}
                        value={v.name_ru}
                        onChange={(e) =>
                          patchVariant(i, { name_ru: e.target.value })
                        }
                        placeholder="напр. 30 см"
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label htmlFor={`mi-var-ro-${i}`}>Название (RO)</Label>
                      <Input
                        id={`mi-var-ro-${i}`}
                        value={v.name_ro}
                        onChange={(e) =>
                          patchVariant(i, { name_ro: e.target.value })
                        }
                        placeholder="ex. 30 cm"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <div className="grid gap-1.5">
                      <Label htmlFor={`mi-var-price-${i}`}>Цена (лей)</Label>
                      <Input
                        id={`mi-var-price-${i}`}
                        type="text"
                        inputMode="decimal"
                        value={v.priceLei}
                        onChange={(e) =>
                          patchVariant(i, { priceLei: e.target.value })
                        }
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label htmlFor={`mi-var-aggregator-${i}`}>Glovo</Label>
                      <Input
                        id={`mi-var-aggregator-${i}`}
                        type="text"
                        inputMode="decimal"
                        value={v.aggregatorPriceLei}
                        onChange={(e) =>
                          patchVariant(i, {
                            aggregatorPriceLei: e.target.value,
                          })
                        }
                        placeholder="Необязательно"
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label htmlFor={`mi-var-w-${i}`}>Вес (гр)</Label>
                      <Input
                        id={`mi-var-w-${i}`}
                        type="text"
                        inputMode="numeric"
                        value={v.weightStr}
                        onChange={(e) =>
                          patchVariant(i, { weightStr: e.target.value })
                        }
                        placeholder="Необязательно"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
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
                  <Label htmlFor="mi-aggregator-price">Glovo</Label>
                  <Input
                    id="mi-aggregator-price"
                    type="text"
                    inputMode="decimal"
                    value={aggregatorPriceLei}
                    onChange={(e) => setAggregatorPriceLei(e.target.value)}
                    placeholder="Необязательно"
                  />
                </div>
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
                  value={portionLabelStr}
                  onChange={(e) => setPortionLabelStr(e.target.value)}
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
              <ul className="max-h-64 space-y-3 overflow-y-auto rounded-md border p-3">
                {toppingGroups.map((g) => {
                  const attached = g.id in groupAttachments
                  const freeCount = groupAttachments[g.id] ?? 0

                  return (
                    <li key={g.id} className="space-y-2">
                      <label className="flex cursor-pointer items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          className="border-input size-4 rounded"
                          checked={attached}
                          onChange={() => toggleGroupId(g.id)}
                        />
                        <span>{g.name_ru}</span>
                        {attached && freeCount > 0 ? (
                          <Badge className="border-transparent bg-[#4CAF50]/15 text-[#2E7D32] hover:bg-[#4CAF50]/15">
                            {freeCount} бесплатно
                          </Badge>
                        ) : null}
                      </label>
                      {attached ? (
                        <div className="ml-6 grid gap-1">
                          <Label htmlFor={`mi-free-count-${g.id}`}>
                            Бесплатных единиц
                          </Label>
                          <Input
                            id={`mi-free-count-${g.id}`}
                            type="number"
                            min={0}
                            placeholder="0"
                            value={freeCount}
                            onChange={(e) =>
                              setGroupFreeCount(g.id, e.target.value)
                            }
                          />
                          <p className="text-muted-foreground text-xs">
                            Сколько топпингов из этой группы клиент получает
                            бесплатно. 0 = все платные.
                          </p>
                        </div>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            )}
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
