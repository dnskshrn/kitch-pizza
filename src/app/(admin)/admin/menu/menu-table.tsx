"use client"

import { useState, useTransition } from "react"
import type { MenuItem, ToppingGroup } from "@/types/database"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Pencil, Plus, Trash2 } from "lucide-react"
import { MenuItemDialog } from "./menu-item-dialog"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { deleteMenuItem } from "./actions"

type MenuItemRow = MenuItem & {
  category: { id: string; name_ru: string; name_ro: string } | null
}

function formatPrice(item: MenuItemRow) {
  if (item.has_sizes) {
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

export function MenuTable({
  items,
  categories,
  toppingGroups,
}: {
  items: MenuItemRow[]
  categories: { id: string; name_ru: string; name_ro: string }[]
  toppingGroups: ToppingGroup[]
}) {
  const [createOpen, setCreateOpen] = useState(false)
  const [editItem, setEditItem] = useState<MenuItemRow | null>(null)
  const [deleteItem, setDeleteItem] = useState<MenuItemRow | null>(null)
  const [pending, startTransition] = useTransition()

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
          {items.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="align-middle">
                {row.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={row.image_url}
                    alt=""
                    width={64}
                    height={48}
                    className="rounded-lg object-cover"
                  />
                ) : (
                  <div
                    className="text-muted-foreground flex items-center justify-center rounded-lg border border-dashed border-border text-xs"
                    style={{ width: 64, height: 48 }}
                  >
                    —
                  </div>
                )}
              </TableCell>
              <TableCell className="font-medium">{row.name_ru}</TableCell>
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
