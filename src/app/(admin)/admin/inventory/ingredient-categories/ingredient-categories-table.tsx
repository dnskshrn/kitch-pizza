"use client"

import { useMemo, useState, type MouseEvent } from "react"
import {
  deleteIngredientCategory,
  type IngredientCategory,
} from "@/lib/actions/inventory/ingredient-categories"
import { InventorySearch } from "@/components/admin/inventory-search"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Plus, Trash2 } from "lucide-react"
import { IngredientCategoryDialog } from "./ingredient-category-dialog"

export function IngredientCategoriesTable({
  categories,
}: {
  categories: IngredientCategory[]
}) {
  const [createOpen, setCreateOpen] = useState(false)
  const [editCategory, setEditCategory] = useState<IngredientCategory | null>(
    null
  )
  const [search, setSearch] = useState("")

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return categories
    return categories.filter((c) =>
      (c.name ?? "").toLowerCase().includes(q)
    )
  }, [categories, search])

  function handleDelete(e: MouseEvent, c: IngredientCategory) {
    e.stopPropagation()
    if (
      !confirm(
        "Удалить категорию «" +
          c.name +
          "»? Ингредиенты в этой категории останутся в системе, но у них будет сброшена привязка к категории."
      )
    ) {
      return
    }
    void (async () => {
      const { error } = await deleteIngredientCategory(c.id)
      if (error) alert(error)
    })()
  }

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Категории ингредиентов</h1>
        <Button className="gap-2" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          Добавить категорию
        </Button>
      </div>

      <div className="mb-4 max-w-md">
        <InventorySearch
          value={search}
          onChange={setSearch}
          placeholder="Поиск по названию…"
        />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Название</TableHead>
            <TableHead className="w-36">Порядок</TableHead>
            <TableHead className="w-28 text-right">Действия</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {categories.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={3}
                className="text-muted-foreground text-center"
              >
                Пока нет категорий
              </TableCell>
            </TableRow>
          ) : filtered.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={3}
                className="text-muted-foreground text-center"
              >
                Ничего не найдено
              </TableCell>
            </TableRow>
          ) : (
            filtered.map((c) => (
              <TableRow
                key={c.id}
                className="cursor-pointer"
                onClick={() => setEditCategory(c)}
              >
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell className="text-muted-foreground tabular-nums">
                  {c.sort_order}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Удалить"
                    onClick={(e) => handleDelete(e, c)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <IngredientCategoryDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        mode="create"
        category={null}
      />
      <IngredientCategoryDialog
        open={!!editCategory}
        onOpenChange={(o) => !o && setEditCategory(null)}
        mode="edit"
        category={editCategory}
      />
    </>
  )
}
