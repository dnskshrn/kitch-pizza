"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import type { FeaturedMenuItemWithItem, MenuItem } from "@/types/database"
import { GripVertical, Plus, Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useState, useTransition } from "react"
import {
  addFeaturedMenuItem,
  removeFeaturedMenuItem,
  updateFeaturedMenuItemsOrder,
} from "./actions"

type MenuItemWithCategory = MenuItem & {
  category: { id: string; name_ru: string; name_ro: string } | null
}

type FeaturedMenuTableProps = {
  featuredItems: FeaturedMenuItemWithItem[]
  menuItems: MenuItemWithCategory[]
}

function formatPrice(item: MenuItem) {
  if (item.has_sizes) {
    const prices = [item.price, item.size_s_price, item.size_l_price].filter(
      (value): value is number => typeof value === "number",
    )
    if (prices.length === 0) return "—"
    return `от ${Math.min(...prices) / 100} MDL`
  }

  return typeof item.price === "number" ? `${item.price / 100} MDL` : "—"
}

function reorder<T>(items: T[], fromIndex: number, toIndex: number): T[] {
  const next = [...items]
  const [moved] = next.splice(fromIndex, 1)
  if (!moved) return items
  next.splice(toIndex, 0, moved)
  return next
}

function MenuThumb({ item }: { item: MenuItem }) {
  if (!item.image_url) {
    return (
      <div className="flex size-14 shrink-0 items-center justify-center rounded-lg border border-dashed border-border text-xs text-muted-foreground">
        —
      </div>
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={item.image_url}
      alt=""
      width={56}
      height={56}
      className="size-14 shrink-0 rounded-lg object-cover"
    />
  )
}

export function FeaturedMenuTable({
  featuredItems,
  menuItems,
}: FeaturedMenuTableProps) {
  const router = useRouter()
  const [items, setItems] = useState(featuredItems)
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [selectedItemId, setSelectedItemId] = useState(menuItems[0]?.id ?? "")
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    setItems(featuredItems)
  }, [featuredItems])

  const featuredMenuItemIds = useMemo(
    () => new Set(items.map((item) => item.menu_item_id)),
    [items],
  )

  const availableItems = useMemo(
    () => menuItems.filter((item) => !featuredMenuItemIds.has(item.id)),
    [featuredMenuItemIds, menuItems],
  )

  const selectedAvailableItemId = availableItems.some(
    (item) => item.id === selectedItemId,
  )
    ? selectedItemId
    : availableItems[0]?.id ?? ""

  function refreshAdminPage() {
    router.refresh()
  }

  function handleAdd() {
    if (!selectedAvailableItemId) return

    startTransition(async () => {
      try {
        await addFeaturedMenuItem(selectedAvailableItemId)
        refreshAdminPage()
      } catch (error) {
        console.error(error)
        alert(error instanceof Error ? error.message : "Ошибка добавления")
      }
    })
  }

  function handleRemove(featuredItemId: string) {
    const previousItems = items
    setItems((current) => current.filter((item) => item.id !== featuredItemId))

    startTransition(async () => {
      try {
        await removeFeaturedMenuItem(featuredItemId)
        refreshAdminPage()
      } catch (error) {
        console.error(error)
        setItems(previousItems)
        alert(error instanceof Error ? error.message : "Ошибка удаления")
      }
    })
  }

  function handleDrop(targetId: string) {
    if (!draggedId || draggedId === targetId) {
      setDraggedId(null)
      return
    }

    const fromIndex = items.findIndex((item) => item.id === draggedId)
    const toIndex = items.findIndex((item) => item.id === targetId)
    if (fromIndex < 0 || toIndex < 0) {
      setDraggedId(null)
      return
    }

    const previousItems = items
    const nextItems = reorder(items, fromIndex, toIndex)
    setItems(nextItems)
    setDraggedId(null)

    startTransition(async () => {
      try {
        await updateFeaturedMenuItemsOrder(nextItems.map((item) => item.id))
        refreshAdminPage()
      } catch (error) {
        console.error(error)
        setItems(previousItems)
        alert(error instanceof Error ? error.message : "Ошибка сортировки")
      }
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Новое и популярное</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Выберите существующие позиции меню и перетащите карточки, чтобы
            настроить порядок в будущей витринной карусели.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Добавить позицию</CardTitle>
          <CardDescription>
            Список ниже показывает позиции текущего выбранного бренда.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Select
              value={selectedAvailableItemId || undefined}
              onValueChange={setSelectedItemId}
              disabled={availableItems.length === 0 || pending}
            >
              <SelectTrigger className="h-10 w-full sm:w-[420px]">
                <SelectValue
                  placeholder={
                    availableItems.length === 0
                      ? "Все позиции уже добавлены"
                      : "Выберите позицию"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {availableItems.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name_ru} · {item.category?.name_ru ?? "Без категории"} ·{" "}
                    {formatPrice(item)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              className="gap-2"
              onClick={handleAdd}
              disabled={!selectedAvailableItemId || pending}
            >
              <Plus className="h-4 w-4" />
              Добавить в блок
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Порядок в карусели</CardTitle>
          <CardDescription>
            Drag-and-drop меняет порядок для текущего бренда.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              Пока пусто. Добавьте первую позицию из списка выше.
            </div>
          ) : (
            <div className="space-y-2">
              {items.map((featuredItem, index) => {
                const item = featuredItem.menu_item
                return (
                  <div
                    key={featuredItem.id}
                    draggable={!pending}
                    onDragStart={() => setDraggedId(featuredItem.id)}
                    onDragOver={(event) => event.preventDefault()}
                    onDragEnd={() => setDraggedId(null)}
                    onDrop={() => handleDrop(featuredItem.id)}
                    className={cn(
                      "flex items-center gap-4 rounded-xl border bg-background p-3 transition-colors",
                      draggedId === featuredItem.id && "border-primary bg-primary/5",
                    )}
                  >
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <GripVertical className="h-5 w-5 cursor-grab active:cursor-grabbing" />
                      <span className="w-6 text-right text-xs tabular">
                        {index + 1}
                      </span>
                    </div>

                    <MenuThumb item={item} />

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-medium">{item.name_ru}</p>
                        {item.is_active ? (
                          <Badge>Активна</Badge>
                        ) : (
                          <Badge variant="secondary">Скрыта</Badge>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {item.category?.name_ru ?? "Без категории"} ·{" "}
                        {formatPrice(item)}
                      </p>
                    </div>

                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Удалить из блока"
                      onClick={() => handleRemove(featuredItem.id)}
                      disabled={pending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
