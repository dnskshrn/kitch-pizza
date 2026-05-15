"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  displayUnit,
  toDisplayQty,
  toStorageQty,
  type StorageUnit,
} from "@/lib/inventory-units"
import { confirmAudit, updateAuditItem } from "./actions"

export type AuditItemsTableRowProps = {
  id: string
  expected_qty: number
  actual_qty: number | null
  diff: number | null
  diff_cost: number | null
  cost_per_unit: number | null
  ingredient: { name: string; unit: StorageUnit }
}

function formatNum(n: number): string {
  if (!Number.isFinite(n)) return String(n)
  if (Number.isInteger(n)) return String(n)
  return String(Number.parseFloat(n.toFixed(6)))
}

function DiffCell({ diff, unit }: { diff: number | null; unit: StorageUnit }) {
  if (diff === null) {
    return <span className="text-muted-foreground">—</span>
  }
  const magnitude = formatNum(toDisplayQty(Math.abs(diff), unit))
  if (diff === 0) {
    return <span className="text-muted-foreground">0</span>
  }
  if (diff > 0) {
    return (
      <span className="font-medium text-green-600">
        +{magnitude}
      </span>
    )
  }
  return (
    <span className="font-medium text-red-600">−{magnitude}</span>
  )
}

function DiffCostCell({
  diff_cost,
}: {
  diff_cost: number | null
}) {
  if (diff_cost === null) {
    return <span className="text-muted-foreground">—</span>
  }
  const n = Number(diff_cost)
  if (!Number.isFinite(n)) {
    return <span className="text-muted-foreground">—</span>
  }
  const value = Math.abs(n).toFixed(2)
  if (n === 0) {
    return <span className="text-muted-foreground tabular-nums">0 MDL</span>
  }
  if (n > 0) {
    return (
      <span className="font-medium text-green-600 tabular-nums">
        +{value} MDL
      </span>
    )
  }
  return (
    <span className="font-medium text-red-600 tabular-nums">{value} MDL</span>
  )
}

function TotalDiffCostCell({ total }: { total: number }) {
  const absFmt = Math.abs(total).toFixed(2)
  if (total === 0 || !Number.isFinite(total)) {
    return <span className="text-muted-foreground tabular-nums">0 MDL</span>
  }
  if (total > 0) {
    return (
      <span className="font-medium text-green-600 tabular-nums">
        +{absFmt} MDL
      </span>
    )
  }
  return (
    <span className="font-medium text-red-600 tabular-nums">
      -{absFmt} MDL
    </span>
  )
}

export function AuditItemsTable({
  items,
  auditId: _auditId,
  isConfirmed,
}: {
  items: AuditItemsTableRowProps[]
  auditId: string
  isConfirmed: boolean
}) {
  void _auditId
  const router = useRouter()
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [savingItemId, setSavingItemId] = useState<string | null>(null)

  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) =>
      a.ingredient.name.localeCompare(b.ingredient.name, "ru")
    )
  }, [items])

  const totalDiffCost = useMemo(() => {
    return sortedItems.reduce((acc, row) => {
      if (row.diff_cost === null || row.diff_cost === undefined) return acc
      const n = Number(row.diff_cost)
      if (!Number.isFinite(n)) return acc
      return acc + n
    }, 0)
  }, [sortedItems])

  function displayDraft(
    itemId: string,
    actualQty: number | null,
    unit: StorageUnit
  ): string {
    if (Object.prototype.hasOwnProperty.call(drafts, itemId)) {
      return drafts[itemId] ?? ""
    }
    if (actualQty === null || actualQty === undefined) return ""
    return String(toDisplayQty(Number(actualQty), unit))
  }

  async function handleBlur(itemId: string, raw: string) {
    if (isConfirmed) return
    const trimmed = raw.trim()
    const parsed =
      trimmed === "" ? null : Number(trimmed.replace(",", "."))

    if (parsed !== null && !Number.isFinite(parsed)) {
      alert("Введите корректное число")
      return
    }

    const row = sortedItems.find((i) => i.id === itemId)
    if (!row) return
    const storageVal =
      parsed === null ? null : toStorageQty(parsed, row.ingredient.unit)

    setSavingItemId(itemId)
    try {
      await updateAuditItem(itemId, storageVal)
      setDrafts((d) => {
        const next = { ...d }
        delete next[itemId]
        return next
      })
      router.refresh()
    } catch (e) {
      console.error(e)
      alert(e instanceof Error ? e.message : "Ошибка сохранения")
    } finally {
      setSavingItemId(null)
    }
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Ингредиент</TableHead>
            <TableHead className="w-24">Единица</TableHead>
            <TableHead className="w-32 text-right">Ожидается</TableHead>
            <TableHead className="w-36 text-right">Факт</TableHead>
            <TableHead className="w-40 text-right">Расхождение</TableHead>
            <TableHead className="min-w-[7rem] text-right font-medium">
              Стоимость
            </TableHead>
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
                    disabled={savingItemId === row.id}
                    className="text-right tabular-nums"
                    inputMode="decimal"
                    placeholder="введите..."
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
                <DiffCell diff={row.diff} unit={row.ingredient.unit} />
              </TableCell>
              <TableCell className="text-right">
                <DiffCostCell diff_cost={row.diff_cost} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell colSpan={5} className="text-right font-medium">
              Итого расхождение
            </TableCell>
            <TableCell className="text-right">
              <TotalDiffCostCell total={totalDiffCost} />
            </TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  )
}

export function AuditConfirmFooter({
  auditId,
  items,
}: {
  auditId: string
  items: Pick<AuditItemsTableRowProps, "actual_qty">[]
}) {
  const router = useRouter()
  const [confirmPending, startConfirm] = useTransition()

  const unfilledCount = items.filter((i) => i.actual_qty == null).length
  const canConfirm =
    items.length > 0 &&
    items.every((i) => i.actual_qty != null && Number.isFinite(Number(i.actual_qty)))

  async function handleConfirm() {
    if (!canConfirm) return
    startConfirm(async () => {
      try {
        await confirmAudit(auditId)
        router.refresh()
      } catch (e) {
        console.error(e)
        alert(e instanceof Error ? e.message : "Ошибка подтверждения")
      }
    })
  }

  const buttonLabel = confirmPending ? "Подтверждение…" : "Подтвердить инвентаризацию"
  const fillHint =
    unfilledCount > 0 ? `Заполните ${unfilledCount} позиций` : null

  return (
    <TooltipProvider delayDuration={0}>
      <div className="mt-8 flex flex-col gap-3 border-t pt-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          {fillHint ? (
            <p className="text-muted-foreground text-sm">{fillHint}</p>
          ) : (
            <span />
          )}
          {!canConfirm ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex">
                  <Button disabled={true} onClick={handleConfirm}>
                    {buttonLabel}
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>{fillHint ?? "Заполните позиции"}</TooltipContent>
            </Tooltip>
          ) : (
            <Button
              disabled={confirmPending}
              onClick={handleConfirm}
            >
              {buttonLabel}
            </Button>
          )}
        </div>
      </div>
    </TooltipProvider>
  )
}
