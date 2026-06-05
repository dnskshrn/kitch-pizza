"use client"

import { useEffect, useMemo, useState } from "react"
import { CheckIcon, ChevronDownIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import {
  fetchCategoriesForDiscountRule,
  fetchGiftMenuItemForDiscountRule,
  fetchPromoCodeForDiscountRule,
  fetchTargetMenuItemsForDiscountRule,
  searchGiftMenuItemsForDiscountRule,
  searchPromoCodesForDiscountRule,
  type DiscountRuleCategoryPickRow,
  type DiscountRuleGiftMenuPickRow,
  type DiscountRulePromoPickRow,
  type DiscountRuleTargetMenuItemRow,
} from "./actions"

function useDebouncedValue<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return debounced
}

function giftPrimaryLabel(row: DiscountRuleGiftMenuPickRow): string {
  const ru = row.name_ru.trim()
  const ro = row.name_ro.trim()
  if (ru && ro && ru !== ro) return `${ru} (${ro})`
  return ru || ro || row.id
}

function variantLabel(v: DiscountRuleGiftMenuPickRow["variants"][number]): string {
  const ru = v.name_ru.trim()
  const ro = v.name_ro.trim()
  if (ru && ro && ru !== ro) return `${ru} (${ro})`
  return ru || ro || v.id
}

type GiftMenuItemPickerProps = {
  brandId: string
  selectedItemId: string
  selectedVariantId: string
  onPick: (itemId: string, variantId: string) => void
  disabled?: boolean
}

export function GiftMenuItemPicker({
  brandId,
  selectedItemId,
  selectedVariantId,
  onPick,
  disabled,
}: GiftMenuItemPickerProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const debouncedSearch = useDebouncedValue(search, 250)
  const [rows, setRows] = useState<DiscountRuleGiftMenuPickRow[]>([])
  const [loading, setLoading] = useState(false)
  const [pickedRow, setPickedRow] = useState<DiscountRuleGiftMenuPickRow | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  useEffect(() => {
    if (!brandId || !selectedItemId) {
      setPickedRow(null)
      setDetailLoading(false)
      return
    }
    let cancelled = false
    setDetailLoading(true)
    fetchGiftMenuItemForDiscountRule(brandId, selectedItemId)
      .then((row) => {
        if (!cancelled) setPickedRow(row)
      })
      .catch(() => {
        if (!cancelled) setPickedRow(null)
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [brandId, selectedItemId])

  useEffect(() => {
    if (!open || !brandId) return
    let cancelled = false
    setLoading(true)
    searchGiftMenuItemsForDiscountRule(brandId, debouncedSearch)
      .then((list) => {
        if (!cancelled) setRows(list)
      })
      .catch(() => {
        if (!cancelled) setRows([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, brandId, debouncedSearch])

  const triggerLabel = pickedRow
    ? giftPrimaryLabel(pickedRow)
    : selectedItemId
      ? detailLoading
        ? "Загрузка…"
        : "Товар не найден"
      : ""

  const variantSource = pickedRow
  const showVariantSelect =
    Boolean(variantSource) && variantSource!.variants.length > 1

  return (
    <div className="space-y-3">
      <Popover
        open={open}
        onOpenChange={(v) => {
          setOpen(v)
          if (v) setSearch("")
        }}
      >
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            disabled={disabled || !brandId}
            aria-expanded={open}
            className={cn(
              "h-9 w-full justify-between font-normal",
              !triggerLabel && "text-muted-foreground",
            )}
          >
            <span className="line-clamp-1 text-left">{triggerLabel || "Выберите товар…"}</span>
            <ChevronDownIcon className="size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[min(100vw-2rem,28rem)] overflow-hidden p-0"
          align="start"
        >
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Поиск по названию…"
              value={search}
              onValueChange={setSearch}
            />
            <CommandList>
              <CommandEmpty className="text-muted-foreground py-6 text-center text-sm">
                {loading ? "Загрузка…" : "Ничего не найдено"}
              </CommandEmpty>
              <CommandGroup heading="Меню">
                {rows.map((row) => (
                  <CommandItem
                    key={row.id}
                    value={`${row.id}-${row.name_ru}-${row.name_ro}`}
                    onSelect={() => {
                      setPickedRow(row)
                      const vs = row.variants
                      if (vs.length === 1) {
                        onPick(row.id, vs[0].id)
                      } else {
                        onPick(row.id, "")
                      }
                      setOpen(false)
                    }}
                  >
                    <CheckIcon
                      className={cn(
                        "size-4 shrink-0",
                        selectedItemId === row.id ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <span className="line-clamp-2">{giftPrimaryLabel(row)}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {showVariantSelect ? (
        <div className="space-y-2">
          <p className="text-muted-foreground text-xs">Вариант подарка</p>
          <Select
            value={selectedVariantId || undefined}
            onValueChange={(v) => onPick(selectedItemId, v)}
            disabled={disabled || !brandId}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Выберите размер / вариант" />
            </SelectTrigger>
            <SelectContent>
              {variantSource!.variants.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  {variantLabel(v)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}
    </div>
  )
}

type PromoCodePickerProps = {
  brandId: string
  selectedPromoId: string
  onPick: (promoId: string) => void
  disabled?: boolean
}

function formatPriceBani(price: number | null): string {
  if (price == null) return "—"
  return `${(price / 100).toFixed(2)} MDL`
}

function itemCountLabel(n: number): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return `${n} товар выбран`
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) {
    return `${n} товара выбрано`
  }
  return `${n} товаров выбрано`
}

type ItemPercentTargetPickerProps = {
  brandId: string
  selectedIds: string[]
  onChange: (ids: string[]) => void
  disabled?: boolean
}

export function ItemPercentTargetPicker({
  brandId,
  selectedIds,
  onChange,
  disabled,
}: ItemPercentTargetPickerProps) {
  const [search, setSearch] = useState("")
  const [rows, setRows] = useState<DiscountRuleTargetMenuItemRow[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!brandId) {
      setRows([])
      return
    }
    let cancelled = false
    setLoading(true)
    fetchTargetMenuItemsForDiscountRule(brandId)
      .then((list) => {
        if (!cancelled) setRows(list)
      })
      .catch(() => {
        if (!cancelled) setRows([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [brandId])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((row) => row.name_ru.toLowerCase().includes(q))
  }, [rows, search])

  const grouped = useMemo(() => {
    const map = new Map<string, DiscountRuleTargetMenuItemRow[]>()
    for (const row of filtered) {
      const key = row.category_id || "__none__"
      const list = map.get(key) ?? []
      list.push(row)
      map.set(key, list)
    }
    return [...map.entries()].map(([categoryId, items]) => ({
      categoryId,
      categoryName: items[0]?.category_name_ru ?? "Без категории",
      items,
    }))
  }, [filtered])

  function toggleItem(id: string, checked: boolean) {
    if (checked) {
      onChange([...new Set([...selectedIds, id])])
    } else {
      onChange(selectedIds.filter((x) => x !== id))
    }
  }

  function toggleCategory(items: DiscountRuleTargetMenuItemRow[], checked: boolean) {
    const ids = items.map((i) => i.id)
    if (checked) {
      onChange([...new Set([...selectedIds, ...ids])])
    } else {
      const remove = new Set(ids)
      onChange(selectedIds.filter((x) => !remove.has(x)))
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">{itemCountLabel(selectedIds.length)}</Badge>
      </div>
      <Input
        placeholder="Поиск по названию…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        disabled={disabled || !brandId}
        autoComplete="off"
      />
      <div className="max-h-64 overflow-y-auto rounded-md border">
        {loading ? (
          <p className="text-muted-foreground px-3 py-6 text-center text-sm">
            Загрузка…
          </p>
        ) : grouped.length === 0 ? (
          <p className="text-muted-foreground px-3 py-6 text-center text-sm">
            {brandId ? "Нет позиций" : "Выберите бренд"}
          </p>
        ) : (
          grouped.map((group) => {
            const groupIds = group.items.map((i) => i.id)
            const allSelected = groupIds.every((id) => selectedIds.includes(id))
            const someSelected =
              !allSelected && groupIds.some((id) => selectedIds.includes(id))
            return (
              <div key={group.categoryId} className="border-b last:border-b-0">
                <label className="bg-muted/40 flex cursor-pointer items-center gap-2 px-3 py-2 text-sm font-medium">
                  <Checkbox
                    checked={allSelected ? true : someSelected ? "indeterminate" : false}
                    disabled={disabled}
                    onCheckedChange={(c) =>
                      toggleCategory(group.items, c === true)
                    }
                  />
                  {group.categoryName}
                </label>
                <ul>
                  {group.items.map((item) => (
                    <li key={item.id}>
                      <label className="hover:bg-muted/50 flex cursor-pointer items-center gap-2 px-3 py-2 pl-8 text-sm">
                        <Checkbox
                          checked={selectedIds.includes(item.id)}
                          disabled={disabled}
                          onCheckedChange={(c) => toggleItem(item.id, c === true)}
                        />
                        <span className="min-w-0 flex-1 truncate">{item.name_ru}</span>
                        <span className="text-muted-foreground shrink-0 font-mono text-xs">
                          {formatPriceBani(item.price)}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

type CategoryTargetPickerProps = {
  brandId: string
  selectedIds: string[]
  onChange: (ids: string[]) => void
  disabled?: boolean
}

export function CategoryTargetPicker({
  brandId,
  selectedIds,
  onChange,
  disabled,
}: CategoryTargetPickerProps) {
  const [search, setSearch] = useState("")
  const [rows, setRows] = useState<DiscountRuleCategoryPickRow[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!brandId) {
      setRows([])
      return
    }
    let cancelled = false
    setLoading(true)
    fetchCategoriesForDiscountRule(brandId)
      .then((list) => {
        if (!cancelled) setRows(list)
      })
      .catch(() => {
        if (!cancelled) setRows([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [brandId])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((row) => row.name_ru.toLowerCase().includes(q))
  }, [rows, search])

  function toggleCategory(id: string, checked: boolean) {
    if (checked) {
      onChange([...new Set([...selectedIds, id])])
    } else {
      onChange(selectedIds.filter((x) => x !== id))
    }
  }

  return (
    <div className="space-y-3">
      <Input
        placeholder="Поиск категории…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        disabled={disabled || !brandId}
        autoComplete="off"
      />
      <div className="max-h-48 overflow-y-auto rounded-md border">
        {loading ? (
          <p className="text-muted-foreground px-3 py-6 text-center text-sm">
            Загрузка…
          </p>
        ) : filtered.length === 0 ? (
          <p className="text-muted-foreground px-3 py-6 text-center text-sm">
            {brandId ? "Нет категорий" : "Выберите бренд"}
          </p>
        ) : (
          <ul>
            {filtered.map((cat) => (
              <li key={cat.id}>
                <label className="hover:bg-muted/50 flex cursor-pointer items-center gap-2 px-3 py-2 text-sm">
                  <Checkbox
                    checked={selectedIds.includes(cat.id)}
                    disabled={disabled}
                    onCheckedChange={(c) => toggleCategory(cat.id, c === true)}
                  />
                  <span className="truncate">{cat.name_ru}</span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>
      {selectedIds.length > 0 ? (
        <p className="text-muted-foreground text-xs">
          Выбрано категорий: {selectedIds.length}
        </p>
      ) : (
        <p className="text-muted-foreground text-xs">
          Без выбора — правило действует на все категории
        </p>
      )}
    </div>
  )
}

export function PromoCodePicker({
  brandId,
  selectedPromoId,
  onPick,
  disabled,
}: PromoCodePickerProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const debouncedSearch = useDebouncedValue(search, 250)
  const [rows, setRows] = useState<DiscountRulePromoPickRow[]>([])
  const [loading, setLoading] = useState(false)
  const [picked, setPicked] = useState<DiscountRulePromoPickRow | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  useEffect(() => {
    if (!brandId || !selectedPromoId) {
      setPicked(null)
      setDetailLoading(false)
      return
    }
    let cancelled = false
    setDetailLoading(true)
    fetchPromoCodeForDiscountRule(brandId, selectedPromoId)
      .then((row) => {
        if (!cancelled) setPicked(row)
      })
      .catch(() => {
        if (!cancelled) setPicked(null)
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [brandId, selectedPromoId])

  useEffect(() => {
    if (!open || !brandId) return
    let cancelled = false
    setLoading(true)
    searchPromoCodesForDiscountRule(brandId, debouncedSearch)
      .then((list) => {
        if (!cancelled) setRows(list)
      })
      .catch(() => {
        if (!cancelled) setRows([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, brandId, debouncedSearch])

  const triggerLabel = picked
    ? picked.description
      ? `${picked.code} — ${picked.description}`
      : picked.code
    : selectedPromoId
      ? detailLoading
        ? "Загрузка…"
        : "Промокод не найден"
      : ""

  return (
    <Popover
      open={open}
      onOpenChange={(v) => {
        setOpen(v)
        if (v) setSearch("")
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          disabled={disabled || !brandId}
          aria-expanded={open}
          className={cn(
            "h-auto min-h-9 w-full justify-between py-2 font-normal",
            !triggerLabel && "text-muted-foreground",
          )}
        >
          <span className="line-clamp-2 text-left">{triggerLabel || "Выберите промокод…"}</span>
          <ChevronDownIcon className="size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[min(100vw-2rem,28rem)] overflow-hidden p-0"
        align="start"
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Поиск по коду или описанию…"
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty className="text-muted-foreground py-6 text-center text-sm">
              {loading ? "Загрузка…" : "Ничего не найдено"}
            </CommandEmpty>
            <CommandGroup heading="Промокоды">
              {rows.map((row) => (
                <CommandItem
                  key={row.id}
                  value={`${row.id}-${row.code}-${row.description ?? ""}`}
                  onSelect={() => {
                    setPicked(row)
                    onPick(row.id)
                    setOpen(false)
                  }}
                >
                  <CheckIcon
                    className={cn(
                      "size-4 shrink-0",
                      selectedPromoId === row.id ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="font-mono text-sm">{row.code}</span>
                    {row.description ? (
                      <span className="text-muted-foreground line-clamp-2 text-xs">
                        {row.description}
                      </span>
                    ) : null}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
