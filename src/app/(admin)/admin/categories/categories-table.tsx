"use client"

import { useState } from "react"
import type { Category } from "@/types/database"
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
import { CategoryDialog } from "./category-dialog"
import { DeleteCategoryDialog } from "./delete-category-dialog"

export function CategoriesTable({ categories }: { categories: Category[] }) {
  const [createOpen, setCreateOpen] = useState(false)
  const [editCategory, setEditCategory] = useState<Category | null>(null)
  const [deleteCategory, setDeleteCategory] = useState<Category | null>(null)

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Категории меню</h1>
        <Button className="gap-2" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          Добавить категорию
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Название</TableHead>
            <TableHead>Slug</TableHead>
            <TableHead className="w-24">Порядок</TableHead>
            <TableHead>Статус</TableHead>
            <TableHead className="w-28 text-right">Действия</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {categories.map((c) => (
            <TableRow key={c.id}>
              <TableCell className="font-medium">{c.name_ru}</TableCell>
              <TableCell className="text-muted-foreground">{c.slug}</TableCell>
              <TableCell>{c.sort_order}</TableCell>
              <TableCell>
                {c.is_active ? (
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
                  onClick={() => setEditCategory(c)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Удалить"
                  onClick={() => setDeleteCategory(c)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <CategoryDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        mode="create"
        category={null}
      />
      <CategoryDialog
        open={!!editCategory}
        onOpenChange={(o) => !o && setEditCategory(null)}
        mode="edit"
        category={editCategory}
      />
      <DeleteCategoryDialog
        category={deleteCategory}
        open={!!deleteCategory}
        onOpenChange={(o) => !o && setDeleteCategory(null)}
      />
    </>
  )
}
