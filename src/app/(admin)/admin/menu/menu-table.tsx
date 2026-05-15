"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import type { LegacyMenuSizeColumns } from "../legacy-menu-sizes"
import type { MenuItem, ToppingGroup } from "@/types/database"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Pencil, Plus, Search, Trash2, X } from "lucide-react"
import { MenuItemDialog } from "./menu-item-dialog"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { RecipeEditorModal } from "@/components/admin/menu/RecipeEditorModal"
import { deleteMenuItem } from "./actions"

type MenuItemRow = MenuItem &
  LegacyMenuSizeColumns & {
    category: { id: string; name_ru: string; name_ro: string } | null
  }

type RecipeEditorTarget = {
  id: string
  name_ru: string
  variants: { id: string; name: string }[]
}

function recipeVariantsForEditor(row: MenuItemRow): { id: string; name: string }[] {
  return [...(row.variants ?? [])]
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((v) => ({
      id: v.id,
      name: v.name_ru || "—",
    }))
}

function formatPrice(item: MenuItemRow) {
  if (item.has_sizes) {
    const vv = item.variants
    if (vv?.length) {
      const cents = vv.map((v) => v.price)
      const min = Math.min(...cents)
      const max = Math.max(...cents)
      const fmt = (bani: number) => bani / 100
      return min === max ? `${fmt(min)} лей` : `${fmt(min)}–${fmt(max)} лей`
    }
    const s = item.size_s_price
    const l = item.size_l_price
    if (s === null || s === undefined || l === null || l === undefined)
      return "—"
    return `${s / 100} / ${l / 100} лей`
  }
  const p = item.price
  if (p === null || p === undefined) return "—"
  return `${p / 100} лей`
}

function searchableMenuText(item: MenuItemRow): string {
  return [
    item.name_ru,
    item.name_ro,
    item.description_ru,
    item.description_ro,
    item.category?.name_ru,
    item.category?.name_ro,
  ]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase("ru")
}

export function MenuTable({
  brandId,
  items,
  categories,
  toppingGroups,
  coveredItemIds,
  costMap = {},
}: {
  brandId: string
  items: MenuItemRow[]
  categories: { id: string; name_ru: string; name_ro: string }[]
  toppingGroups: ToppingGroup[]
  coveredItemIds: string[]
  costMap?: Record<string, number>
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [editingRecipe, setEditingRecipe] = useState<RecipeEditorTarget | null>(
    null,
  )
  const [createOpen, setCreateOpen] = useState(false)
  const [editItem, setEditItem] = useState<MenuItemRow | null>(null)
  const [deleteItem, setDeleteItem] = useState<MenuItemRow | null>(null)
  const [categoryId, setCategoryId] = useState("all")
  const [search, setSearch] = useState("")
  const [showOnlyWithoutRecipe, setShowOnlyWithoutRecipe] = useState(false)
  const [pending, startTransition] = useTransition()

  const coveredSet = useMemo(
    () => new Set(coveredItemIds),
    [coveredItemIds],
  )

  const itemCountByCategory = useMemo(() => {
    const counts = new Map<string, number>()
    for (const item of items) {
      counts.set(item.category_id, (counts.get(item.category_id) ?? 0) + 1)
    }
    return counts
  }, [items])

  useEffect(() => {
    const editId = searchParams.get("edit")?.trim()
    if (!editId) return

    const row = items.find((i) => i.id === editId)
    if (!row) {
      router.replace("/admin/menu")
      return
    }

    setEditingRecipe({
      id: row.id,
      name_ru: row.name_ru,
      variants: recipeVariantsForEditor(row),
    })
    router.replace("/admin/menu")
  }, [items, router, searchParams])

  const filteredItems = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("ru")
    return items.filter((item) => {
      const matchesCategory =
        categoryId === "all" || item.category_id === categoryId
      const matchesSearch = !query || searchableMenuText(item).includes(query)
      const matchesRecipeFilter =
        !showOnlyWithoutRecipe || !coveredSet.has(item.id)
      return matchesCategory && matchesSearch && matchesRecipeFilter
    })
  }, [categoryId, coveredSet, items, search, showOnlyWithoutRecipe])

  const hasActiveFilters =
    categoryId !== "all" ||
    search.trim() !== "" ||
    showOnlyWithoutRecipe

  function resetFilters() {
    setCategoryId("all")
    setSearch("")
    setShowOnlyWithoutRecipe(false)
  }

  function handleDelete() {
    if (!deleteItem) return
    startTransition(async () => {
      try {
        await deleteMenuItem(deleteItem.id)
        setDeleteItem(null)
      } catch (e) {
        console.error(e)
        alert(e instanceof Error ? e.message : "Ошибка удаления")
      }
    })
  }

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Позиции меню</h1>
        <Button
          className="gap-2"
          onClick={() => setCreateOpen(true)}
        >
          <Plus className="h-4 w-4" />
          Добавить позицию
        </Button>
      </div>

      <div className="mb-4 flex flex-col gap-3 rounded-xl border bg-card p-3 md:flex-row md:flex-wrap md:items-end">
        <div className="flex w-full min-w-0 flex-col gap-1.5 md:w-[320px]">
          <Label className="text-muted-foreground text-xs" htmlFor="menu-search">
            Поиск
          </Label>
          <div className="relative">
            <Search className="text-muted-foreground pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2" />
            <Input
              id="menu-search"
              className="pl-8"
              placeholder="Название, описание или категория"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="flex w-full min-w-0 flex-col gap-1.5 md:w-[260px]">
          <Label className="text-muted-foreground text-xs">Категория</Label>
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger size="sm" className="w-full">
              <SelectValue placeholder="Все категории" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все категории ({items.length})</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name_ru || category.name_ro} (
                  {itemCountByCategory.get(category.id) ?? 0})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex w-full min-w-0 flex-col gap-1.5 md:w-auto">
          <Label className="text-muted-foreground text-xs">Техкарта</Label>
          <button
            type="button"
            onClick={() => setShowOnlyWithoutRecipe((v) => !v)}
            className="h-9 shrink-0 rounded-md border bg-transparent px-3 text-sm transition-colors"
            style={{
              borderColor: showOnlyWithoutRecipe ? "#ccff00" : "#e0e0e0",
              color: showOnlyWithoutRecipe ? "#242424" : "#808080",
            }}
          >
            Без рецепта
          </button>
        </div>

        <div className="flex w-full items-center justify-between gap-3 md:w-auto md:flex-1 md:justify-end">
          <span className="text-muted-foreground text-sm">
            Показано {filteredItems.length} из {items.length}
          </span>
          {hasActiveFilters ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="h-8 gap-2"
              onClick={resetFilters}
            >
              <X className="size-4" />
              Сбросить
            </Button>
          ) : null}
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[72px]">Фото</TableHead>
            <TableHead>Название</TableHead>
            <TableHead>Категория</TableHead>
            <TableHead>Тип</TableHead>
            <TableHead>Цена</TableHead>
            <TableHead>Статус</TableHead>
            <TableHead className="w-28 text-right">Действия</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredItems.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="align-middle">
                {row.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={row.image_url}
                    alt=""
                    width={64}
                    height={64}
                    className="aspect-square rounded-lg object-cover"
                  />
                ) : (
                  <div
                    className="text-muted-foreground flex items-center justify-center rounded-lg border border-dashed border-border text-xs"
                    style={{ width: 64, height: 64 }}
                  >
                    —
                  </div>
                )}
              </TableCell>
              <TableCell className="font-medium">
                <span className="inline-flex max-w-full flex-wrap items-center gap-2 align-middle">
                  <span className="min-w-0">{row.name_ru}</span>
                  {coveredSet.has(row.id) ? (
                    <Badge
                      className="shrink-0 cursor-pointer whitespace-nowrap hover:opacity-80"
                      style={{
                        backgroundColor: "#ccff00",
                        color: "#242424",
                        fontSize: "11px",
                      }}
                      onClick={(e) => {
                        e.stopPropagation()
                        setEditingRecipe({
                          id: row.id,
                          name_ru: row.name_ru,
                          variants: recipeVariantsForEditor(row),
                        })
                      }}
                    >
                      ✓ Рецепт
                    </Badge>
                  ) : (
                    <Badge
                      className="shrink-0 cursor-pointer whitespace-nowrap hover:opacity-80"
                      style={{
                        backgroundColor: "#f2f2f2",
                        color: "#808080",
                        fontSize: "11px",
                        border: "1px solid #e0e0e0",
                      }}
                      onClick={(e) => {
                        e.stopPropagation()
                        setEditingRecipe({
                          id: row.id,
                          name_ru: row.name_ru,
                          variants: recipeVariantsForEditor(row),
                        })
                      }}
                    >
                      Нет рецепта
                    </Badge>
                  )}
                  {costMap[row.id] != null && costMap[row.id]! > 0 ? (
                    <span className="ml-2 text-xs text-[#808080]">
                      {costMap[row.id]!.toFixed(2)} MDL
                    </span>
                  ) : null}
                </span>
              </TableCell>
              <TableCell>
                {row.category?.name_ru ?? row.category?.name_ro ?? "—"}
              </TableCell>
              <TableCell>
                {row.has_sizes ? (
                  <Badge>С размерами</Badge>
                ) : (
                  <Badge variant="secondary">Обычное</Badge>
                )}
              </TableCell>
              <TableCell>{formatPrice(row)}</TableCell>
              <TableCell>
                {row.is_active ? (
                  <Badge>Активна</Badge>
                ) : (
                  <Badge variant="secondary">Скрыта</Badge>
                )}
              </TableCell>
              <TableCell className="text-right">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Редактировать"
                  onClick={() => setEditItem(row)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Удалить"
                  onClick={() => setDeleteItem(row)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
          {!filteredItems.length ? (
            <TableRow>
              <TableCell
                colSpan={7}
                className="text-muted-foreground h-28 text-center"
              >
                {hasActiveFilters
                  ? "Ничего не найдено. Измените фильтры или сбросьте поиск."
                  : "Пока нет позиций меню."}
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>

      <MenuItemDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        mode="create"
        item={null}
        categories={categories}
        toppingGroups={toppingGroups}
      />
      <MenuItemDialog
        open={!!editItem}
        onOpenChange={(o) => !o && setEditItem(null)}
        mode="edit"
        item={editItem}
        categories={categories}
        toppingGroups={toppingGroups}
      />

      <RecipeEditorModal
        open={!!editingRecipe}
        brandId={brandId}
        item={editingRecipe ?? { id: "", name_ru: "" }}
        variants={editingRecipe?.variants ?? []}
        onClose={() => setEditingRecipe(null)}
        onSaved={() => router.refresh()}
      />

      <Dialog
        open={!!deleteItem}
        onOpenChange={(o) => !o && setDeleteItem(null)}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Удалить позицию?</DialogTitle>
            <DialogDescription>
              Вы уверены? Это действие нельзя отменить.
              {deleteItem ? (
                <>
                  <br />
                  <span className="text-foreground font-medium">
                    {deleteItem.name_ru}
                  </span>
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeleteItem(null)}>
              Отмена
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={pending}
            >
              {pending ? "Удаление..." : "Удалить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
