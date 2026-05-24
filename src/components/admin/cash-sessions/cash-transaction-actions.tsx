"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Ban, Pencil } from "lucide-react"
import { toast } from "sonner"
import {
  editCashTransaction,
  voidCashTransaction,
} from "@/lib/actions/admin/cash-sessions"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

const EDITABLE_TYPES = ["expense", "income", "encashment"] as const

const EXPENSE_CATEGORIES = [
  { value: "ingredients", label: "Продукты" },
  { value: "salary", label: "Зарплата" },
  { value: "other", label: "Другое" },
] as const

interface Props {
  transaction: {
    id: string
    type: string
    amount_bani: number
    description: string | null
    category: string | null
    voided_at: string | null
  }
  canEdit: boolean
}

function isEditableType(type: string): boolean {
  return (EDITABLE_TYPES as readonly string[]).includes(type)
}

export function CashTransactionActions({ transaction, canEdit }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const [editOpen, setEditOpen] = useState(false)
  const [voidOpen, setVoidOpen] = useState(false)
  const [amountMdl, setAmountMdl] = useState("")
  const [description, setDescription] = useState("")
  const [category, setCategory] = useState<string>("other")
  const [voidReason, setVoidReason] = useState("")

  const showActions =
    canEdit &&
    transaction.voided_at == null &&
    isEditableType(transaction.type)

  useEffect(() => {
    if (!editOpen) return
    setAmountMdl(String(transaction.amount_bani / 100))
    setDescription(transaction.description ?? "")
    setCategory(
      transaction.category &&
        EXPENSE_CATEGORIES.some((c) => c.value === transaction.category)
        ? transaction.category
        : "other",
    )
  }, [editOpen, transaction])

  useEffect(() => {
    if (!voidOpen) return
    setVoidReason("")
  }, [voidOpen])

  if (!showActions) return null

  function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault()
    const parsed = Number.parseFloat(amountMdl.replace(",", "."))
    if (!Number.isFinite(parsed) || parsed <= 0) {
      toast.error("Укажите корректную сумму")
      return
    }

    startTransition(async () => {
      const result = await editCashTransaction(transaction.id, {
        amount_bani: Math.round(parsed * 100),
        description,
        category: transaction.type === "expense" ? category : undefined,
      })
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success("Транзакция обновлена")
      setEditOpen(false)
      router.refresh()
    })
  }

  function handleVoidConfirm() {
    const reason = voidReason.trim()
    if (reason.length < 3) {
      toast.error("Укажите причину аннулирования (минимум 3 символа)")
      return
    }

    startTransition(async () => {
      const result = await voidCashTransaction(transaction.id, reason)
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success("Транзакция аннулирована")
      setVoidOpen(false)
      router.refresh()
    })
  }

  return (
    <div className="flex items-center justify-end gap-0.5">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="size-8 p-0"
        disabled={pending}
        onClick={() => setEditOpen(true)}
        aria-label="Редактировать"
      >
        <Pencil className="size-3.5" />
      </Button>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="size-8 p-0 text-destructive hover:text-destructive"
        disabled={pending}
        onClick={() => setVoidOpen(true)}
        aria-label="Аннулировать"
      >
        <Ban className="size-3.5" />
      </Button>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Редактировать транзакцию</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="tx-amount-mdl">Сумма (MDL)</Label>
              <Input
                id="tx-amount-mdl"
                type="number"
                min={0.01}
                step={0.01}
                value={amountMdl}
                onChange={(e) => setAmountMdl(e.target.value)}
                disabled={pending}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="tx-description">Описание</Label>
              <Input
                id="tx-description"
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={pending}
              />
            </div>
            {transaction.type === "expense" ? (
              <div className="grid gap-2">
                <Label>Категория</Label>
                <Select
                  value={category}
                  onValueChange={setCategory}
                  disabled={pending}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPENSE_CATEGORIES.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() => setEditOpen(false)}
              >
                Отмена
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "…" : "Сохранить"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={voidOpen} onOpenChange={setVoidOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Аннулировать транзакцию?</DialogTitle>
            <DialogDescription>
              Операция необратима. Укажите причину аннулирования (минимум 3
              символа).
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="tx-void-reason">Причина</Label>
            <Textarea
              id="tx-void-reason"
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              disabled={pending}
              rows={3}
              placeholder="Причина аннулирования"
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => setVoidOpen(false)}
            >
              Отмена
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={pending || voidReason.trim().length < 3}
              onClick={handleVoidConfirm}
            >
              {pending ? "…" : "Аннулировать"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
