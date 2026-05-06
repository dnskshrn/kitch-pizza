"use client"

import { useMemo, useState } from "react"
import type { Supplier } from "@/types/database"
import { InventorySearch } from "@/components/admin/inventory-search"
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
import { Pencil, Plus } from "lucide-react"
import { SupplierDialog } from "./supplier-dialog"

export function SuppliersTable({ suppliers }: { suppliers: Supplier[] }) {
  const [createOpen, setCreateOpen] = useState(false)
  const [editSupplier, setEditSupplier] = useState<Supplier | null>(null)
  const [search, setSearch] = useState("")

  const filteredSuppliers = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return suppliers
    return suppliers.filter((s) => {
      const haystack = [
        s.name,
        s.contact_person ?? "",
        s.phone ?? "",
        s.note ?? "",
      ]
        .join(" ")
        .toLowerCase()
      return haystack.includes(q)
    })
  }, [suppliers, search])

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Поставщики</h1>
        <Button className="gap-2" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          Добавить поставщика
        </Button>
      </div>

      <div className="mb-4 max-w-md">
        <InventorySearch
          value={search}
          onChange={setSearch}
          placeholder="Search suppliers by name, contact, or phone…"
        />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Название</TableHead>
            <TableHead>Контакт</TableHead>
            <TableHead>Телефон</TableHead>
            <TableHead>Статус</TableHead>
            <TableHead className="w-28 text-right">Действия</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {suppliers.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={5}
                className="text-muted-foreground text-center"
              >
                Пока нет поставщиков
              </TableCell>
            </TableRow>
          ) : filteredSuppliers.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={5}
                className="text-muted-foreground text-center"
              >
                Ничего не найдено
              </TableCell>
            </TableRow>
          ) : (
            filteredSuppliers.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{s.name}</TableCell>
                <TableCell className="text-muted-foreground">
                  {s.contact_person ?? "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {s.phone ?? "—"}
                </TableCell>
                <TableCell>
                  {s.is_active ? (
                    <Badge>Активен</Badge>
                  ) : (
                    <Badge variant="secondary">Неактивен</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Редактировать"
                    onClick={() => setEditSupplier(s)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <SupplierDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        mode="create"
        supplier={null}
      />
      <SupplierDialog
        open={!!editSupplier}
        onOpenChange={(o) => !o && setEditSupplier(null)}
        mode="edit"
        supplier={editSupplier}
      />
    </>
  )
}
