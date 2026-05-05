"use client"

import { useMemo, useState, useTransition } from "react"
import type { ToppingGroup } from "@/types/database"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Pencil, Plus, Search, Trash2, X } from "lucide-react"
import { CondimentItemDialog } from "./condiment-item-dialog"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { deleteCondimentMenuItem } from "./actions"
import type { CondimentMenuItemRow } from "./types"

function formatPrice(item: CondimentMenuItemRow) {
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

function searchableCondimentText(item: CondimentMenuItemRow): string {
  return [
    item.name_ru,
    item.name_ro,
    item.description_ru,
    item.description_ro,
  ]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase("ru")
}

export function CondimentsTable({
  items,
  condimentCategoryId,
  toppingGroups,
}: {
  items: CondimentMenuItemRow[]
  condimentCategoryId: string
  toppingGroups: ToppingGroup[]
}) {
  const [createOpen, setCreateOpen] = useState(false)
  const [editItem, setEditItem] = useState<CondimentMenuItemRow | null>(null)
  const [deleteItem, setDeleteItem] = useState<CondimentMenuItemRow | null>(
    null,
  )
  const [search, setSearch] = useState("")
  const [pending, startTransition] = useTransition()

  const filteredItems = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("ru")
    return items.filter((item) => {
      const matchesSearch =
        !query || searchableCondimentText(item).includes(query)
      return matchesSearch
    })
  }, [items, search])

  const hasActiveFilters = search.trim() !== ""

  function resetFilters() {
    setSearch("")
  }

  function handleDelete() {
    if (!deleteItem) return
    startTransition(async () => {
      try {
        await deleteCondimentMenuItem(deleteItem.id)
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
        <h1 className="text-2xl font-semibold">Кондименты</h1>
        <Button className="gap-2" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          Добавить позицию
        </Button>
      </div>

      <div className="mb-4 flex flex-col gap-3 rounded-xl border bg-card p-3 md:flex-row md:flex-wrap md:items-end">
        <div className="flex w-full min-w-0 flex-col gap-1.5 md:w-[320px]">
          <Label className="text-muted-foreground text-xs" htmlFor="cond-search">
            Поиск
          </Label>
          <div className="relative">
            <Search className="text-muted-foreground pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2" />
            <Input
              id="cond-search"
              className="pl-8"
              placeholder="Название или описание"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
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
            <TableHead>Тип</TableHead>
            <TableHead>Цена</TableHead>
            <TableHead>Авто в заказе</TableHead>
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
              <TableCell className="font-medium">{row.name_ru}</TableCell>
              <TableCell>
                {row.has_sizes ? (
                  <Badge>С размерами</Badge>
                ) : (
                  <Badge variant="secondary">Обычное</Badge>
                )}
              </TableCell>
              <TableCell>{formatPrice(row)}</TableCell>
              <TableCell>
                {(row.is_default_condiment ?? false) ? (
                  <Badge>Да</Badge>
                ) : (
                  <Badge variant="secondary">Нет</Badge>
                )}
              </TableCell>
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
                  ? "Ничего не найдено. Измените поиск или сбросьте."
                  : "Пока нет кондиментов."}
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>

      <CondimentItemDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        mode="create"
        item={null}
        condimentCategoryId={condimentCategoryId}
        toppingGroups={toppingGroups}
      />
      <CondimentItemDialog
        open={!!editItem}
        onOpenChange={(o) => !o && setEditItem(null)}
        mode="edit"
        item={editItem}
        condimentCategoryId={condimentCategoryId}
        toppingGroups={toppingGroups}
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
