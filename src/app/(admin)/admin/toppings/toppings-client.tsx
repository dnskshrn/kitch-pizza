"use client"

import { useEffect, useState, useTransition } from "react"
import type { Topping, ToppingGroup } from "@/types/database"
import {
  deleteTopping,
  deleteToppingGroup,
} from "./actions"
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
import { Plus, Pencil, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { ToppingGroupDialog } from "./topping-group-dialog"
import { ToppingDialog } from "./topping-dialog"
import { AddExistingToppingDialog } from "./add-existing-topping-dialog"

function leiFromBani(bani: number) {
  return (bani / 100).toLocaleString("ro-MD", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
}

type Props = {
  groups: ToppingGroup[]
  toppings: Topping[]
}

export function ToppingsClient({ groups, toppings }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [groupCreateOpen, setGroupCreateOpen] = useState(false)
  const [editGroup, setEditGroup] = useState<ToppingGroup | null>(null)
  const [toppingCreateOpen, setToppingCreateOpen] = useState(false)
  const [addExistingOpen, setAddExistingOpen] = useState(false)
  const [editTopping, setEditTopping] = useState<Topping | null>(null)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    if (groups.length === 0) {
      setSelectedId(null)
      return
    }
    setSelectedId((prev) => {
      if (prev && groups.some((g) => g.id === prev)) return prev
      return groups[0].id
    })
  }, [groups])

  const toppingsForGroup = toppings.filter((t) => t.group_id === selectedId)

  function handleDeleteGroup(g: ToppingGroup) {
    if (
      !confirm(
        "Удалить группу? Все топпинги внутри тоже удалятся."
      )
    )
      return
    startTransition(async () => {
      try {
        await deleteToppingGroup(g.id)
        if (selectedId === g.id) setSelectedId(null)
      } catch (e) {
        console.error(e)
        alert(e instanceof Error ? e.message : "Ошибка удаления")
      }
    })
  }

  function handleDeleteTopping(t: Topping) {
    if (!confirm("Удалить топпинг?")) return
    startTransition(async () => {
      try {
        await deleteTopping(t.id)
      } catch (e) {
        console.error(e)
        alert(e instanceof Error ? e.message : "Ошибка удаления")
      }
    })
  }

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Топпинги</h1>
      </div>

      <div className="flex gap-6">
        <div className="w-64 flex-shrink-0 space-y-3">
          <Button
            className="w-full gap-2"
            onClick={() => setGroupCreateOpen(true)}
          >
            <Plus className="h-4 w-4" />
            Группа
          </Button>
          <div className="rounded-md border">
            {groups.length === 0 ? (
              <p className="text-muted-foreground p-4 text-sm">
                Нет групп. Создайте первую.
              </p>
            ) : (
              <ul className="divide-y">
                {groups.map((g) => (
                  <li key={g.id}>
                    <div
                      className={cn(
                        "hover:bg-muted/80 px-3 py-2.5 text-sm transition-colors",
                        selectedId === g.id && "bg-muted"
                      )}
                    >
                      <button
                        type="button"
                        className="w-full text-left"
                        onClick={() => setSelectedId(g.id)}
                      >
                        <span className="font-medium leading-tight">{g.name_ru}</span>
                      </button>
                      <div className="mt-1.5 flex items-center gap-1.5">
                        {g.is_active ? (
                          <Badge className="text-xs">Вкл</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">
                            Выкл
                          </Badge>
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="h-7 w-7"
                          aria-label="Редактировать группу"
                          onClick={() => setEditGroup(g)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="text-destructive hover:text-destructive h-7 w-7"
                          aria-label="Удалить группу"
                          disabled={pending}
                          onClick={() => handleDeleteGroup(g)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button
              className="gap-2"
              disabled={!selectedId}
              onClick={() => setToppingCreateOpen(true)}
            >
              <Plus className="h-4 w-4" />
              Топпинг
            </Button>
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              disabled={!selectedId || toppings.length === toppingsForGroup.length}
              onClick={() => setAddExistingOpen(true)}
            >
              <Plus className="h-4 w-4" />
              Существующий
            </Button>
          </div>

          {!selectedId ? (
            <p className="text-muted-foreground text-sm">
              Выберите группу слева или создайте новую.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[72px]">Фото</TableHead>
                  <TableHead>RU</TableHead>
                  <TableHead>RO</TableHead>
                  <TableHead className="w-28">Цена (лей)</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead className="w-28 text-right">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {toppingsForGroup.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-muted-foreground py-8 text-center"
                    >
                      В этой группе пока нет топпингов.
                    </TableCell>
                  </TableRow>
                ) : (
                  toppingsForGroup.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="align-middle">
                        {t.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={t.image_url}
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
                      <TableCell className="font-medium">{t.name_ru}</TableCell>
                      <TableCell>{t.name_ro}</TableCell>
                      <TableCell>{leiFromBani(t.price)}</TableCell>
                      <TableCell>
                        {t.is_active ? (
                          <Badge>Активен</Badge>
                        ) : (
                          <Badge variant="secondary">Скрыт</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Редактировать"
                          onClick={() => setEditTopping(t)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Удалить"
                          disabled={pending}
                          onClick={() => handleDeleteTopping(t)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      <ToppingGroupDialog
        open={groupCreateOpen}
        onOpenChange={setGroupCreateOpen}
        mode="create"
        group={null}
      />
      <ToppingGroupDialog
        open={!!editGroup}
        onOpenChange={(o) => !o && setEditGroup(null)}
        mode="edit"
        group={editGroup}
      />
      <ToppingDialog
        open={toppingCreateOpen}
        onOpenChange={setToppingCreateOpen}
        mode="create"
        groupId={selectedId}
        topping={null}
      />
      <AddExistingToppingDialog
        open={addExistingOpen}
        onOpenChange={setAddExistingOpen}
        groupId={selectedId}
        toppings={toppings}
      />
      <ToppingDialog
        open={!!editTopping}
        onOpenChange={(o) => !o && setEditTopping(null)}
        mode="edit"
        groupId={editTopping?.group_id ?? selectedId}
        topping={editTopping}
      />
    </>
  )
}
