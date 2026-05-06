"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import type { Ingredient } from "@/types/database"
import {
  confirmAudit,
  getAuditDetail,
  type AuditDetail,
  updateAuditItemActualQty,
} from "./actions"
import { displayUnit, toDisplayQty, toStorageQty } from "@/lib/inventory-units"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

function formatNum(n: number): string {
  if (!Number.isFinite(n)) return String(n)
  if (Number.isInteger(n)) return String(n)
  return String(Number.parseFloat(n.toFixed(6)))
}

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  } catch {
    return iso
  }
}

function DiffCell({
  diff,
  unit,
}: {
  diff: number | null
  unit: Ingredient["unit"]
}) {
  if (diff === null) {
    return <span className="text-muted-foreground">—</span>
  }
  const d = toDisplayQty(diff, unit)
  if (d === 0) {
    return <span className="text-muted-foreground">0</span>
  }
  if (d > 0) {
    return (
      <span className="font-medium text-green-600">+{formatNum(d)}</span>
    )
  }
  return <span className="font-medium text-red-600">{formatNum(d)}</span>
}

export type AuditDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  detail: AuditDetail | null
}

export function AuditDialog({ open, onOpenChange, detail }: AuditDialogProps) {
  const router = useRouter()
  const [snapshot, setSnapshot] = useState<AuditDetail | null>(null)
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [confirmPending, startConfirm] = useTransition()

  useEffect(() => {
    if (!open) {
      setSnapshot(null)
      setDrafts({})
      return
    }
    if (detail) {
      setSnapshot(detail)
      setDrafts({})
    }
  }, [open, detail])

  const sortedItems = useMemo(() => {
    const items = snapshot?.items ?? []
    return [...items].sort((a, b) =>
      a.ingredient.name.localeCompare(b.ingredient.name, "ru")
    )
  }, [snapshot])

  const isConfirmed = snapshot?.audit.confirmed_at != null

  const canConfirm = useMemo(() => {
    if (!snapshot || isConfirmed) return false
    if (snapshot.items.length === 0) return false
    return snapshot.items.every(
      (i) =>
        i.actual_qty !== null &&
        i.actual_qty !== undefined &&
        Number.isFinite(Number(i.actual_qty))
    )
  }, [snapshot, isConfirmed])

  function displayDraft(
    itemId: string,
    actualQty: number | null,
    unit: Ingredient["unit"]
  ): string {
    if (Object.prototype.hasOwnProperty.call(drafts, itemId)) {
      return drafts[itemId] ?? ""
    }
    if (actualQty === null || actualQty === undefined) return ""
    return String(toDisplayQty(Number(actualQty), unit))
  }

  async function handleBlur(itemId: string, raw: string) {
    if (isConfirmed || !snapshot) return
    const trimmed = raw.trim()
    const parsed =
      trimmed === ""
        ? null
        : Number(trimmed.replace(",", "."))

    if (parsed !== null && !Number.isFinite(parsed)) {
      alert("Введите корректное число")
      return
    }

    const unit = snapshot.items.find((i) => i.id === itemId)?.ingredient.unit
    if (!unit) return

    const storageVal = parsed === null ? null : toStorageQty(parsed, unit)

    try {
      const res = await updateAuditItemActualQty(itemId, storageVal)
      setSnapshot((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          items: prev.items.map((i) =>
            i.id === itemId
              ? {
                  ...i,
                  actual_qty: res.actual_qty,
                  diff: res.diff,
                }
              : i
          ),
        }
      })
      setDrafts((d) => {
        const next = { ...d }
        delete next[itemId]
        return next
      })
    } catch (e) {
      console.error(e)
      alert(e instanceof Error ? e.message : "Ошибка сохранения")
    }
  }

  function handleConfirm() {
    if (!snapshot || !canConfirm) return
    startConfirm(async () => {
      try {
        await confirmAudit(snapshot.audit.id)
        const fresh = await getAuditDetail(snapshot.audit.id)
        setSnapshot(fresh)
        setDrafts({})
        router.refresh()
      } catch (e) {
        console.error(e)
        alert(e instanceof Error ? e.message : "Ошибка подтверждения")
      }
    })
  }

  const title = snapshot
    ? `Инвентаризация от ${formatDateTime(snapshot.audit.created_at)}`
    : "Инвентаризация"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-4xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>{title}</DialogTitle>
          {snapshot && isConfirmed && (
            <p className="text-muted-foreground text-sm">
              Подтверждена{" "}
              {snapshot.audit.confirmed_at
                ? formatDateTime(snapshot.audit.confirmed_at)
                : ""}
            </p>
          )}
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          {!snapshot ? (
            <p className="text-muted-foreground text-sm">Загрузка…</p>
          ) : snapshot.items.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Нет ингредиентов для инвентаризации.
            </p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ингредиент</TableHead>
                    <TableHead className="w-24">Единица</TableHead>
                    <TableHead className="w-32 text-right">Ожидается</TableHead>
                    <TableHead className="w-36 text-right">Факт</TableHead>
                    <TableHead className="w-36 text-right">Расхождение</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedItems.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">
                        {row.ingredient.name}
                      </TableCell>
                      <TableCell>{displayUnit(row.ingredient.unit)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatNum(
                          toDisplayQty(row.expected_qty, row.ingredient.unit)
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {isConfirmed ? (
                          <span className="tabular-nums">
                            {row.actual_qty != null
                              ? formatNum(
                                  toDisplayQty(
                                    Number(row.actual_qty),
                                    row.ingredient.unit
                                  )
                                )
                              : "—"}
                          </span>
                        ) : (
                          <Input
                            className="text-right tabular-nums"
                            inputMode="decimal"
                            value={displayDraft(
                              row.id,
                              row.actual_qty,
                              row.ingredient.unit
                            )}
                            onChange={(e) =>
                              setDrafts((d) => ({
                                ...d,
                                [row.id]: e.target.value,
                              }))
                            }
                            onBlur={(e) => handleBlur(row.id, e.target.value)}
                          />
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <DiffCell
                          diff={row.diff}
                          unit={row.ingredient.unit}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        <DialogFooter className="border-t px-6 py-4 sm:justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Закрыть
          </Button>
          {snapshot && !isConfirmed && (
            <Button
              onClick={handleConfirm}
              disabled={!canConfirm || confirmPending}
            >
              {confirmPending ? "Подтверждение…" : "Подтвердить инвентаризацию"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
