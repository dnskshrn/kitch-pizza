"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export function BonusAdjustForm({
  profileId,
  staffId,
}: {
  profileId: string
  staffId: string
}) {
  const router = useRouter()
  const [kind, setKind] = useState<"manual_add" | "manual_deduct">("manual_add")
  const [amount, setAmount] = useState("")
  const [reason, setReason] = useState("")
  const [pending, setPending] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!staffId) {
      toast.error("Нет staff_id для аудита (добавьте сотрудника в staff)")
      return
    }
    const n = Number.parseInt(amount, 10)
    if (!Number.isFinite(n) || n < 1) {
      toast.error("Укажите целое число от 1")
      return
    }
    const note = reason.trim()
    if (note.length < 3) {
      toast.error("Причина не короче 3 символов")
      return
    }

    const delta = kind === "manual_add" ? n : -n

    setPending(true)
    try {
      const res = await fetch("/api/admin/bonus/adjust", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile_id: profileId,
          amount: delta,
          note,
          staff_id: staffId,
        }),
      })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) {
        toast.error(data.error ?? "Ошибка")
        return
      }
      toast.success("Применено")
      setAmount("")
      setReason("")
      router.refresh()
    } catch {
      toast.error("Сеть недоступна")
    } finally {
      setPending(false)
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-wrap items-end gap-3 rounded-lg border border-[#f2f2f2] bg-white p-4"
    >
      <div className="space-y-1.5">
        <Label className="text-xs text-[#808080]">Операция</Label>
        <Select
          value={kind}
          onValueChange={(v) =>
            setKind(v === "manual_deduct" ? "manual_deduct" : "manual_add")
          }
        >
          <SelectTrigger className="w-[180px] border-[#808080]/30">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="manual_add">Начислить</SelectItem>
            <SelectItem value="manual_deduct">Списать</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-[#808080]">Сумма (пункты)</Label>
        <Input
          type="number"
          min={1}
          step={1}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-[120px] border-[#808080]/30"
          required
        />
      </div>
      <div className="min-w-[200px] flex-1 space-y-1.5">
        <Label className="text-xs text-[#808080]">Причина</Label>
        <Input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          minLength={3}
          placeholder="Не короче 3 символов"
          className="border-[#808080]/30"
          required
        />
      </div>
      <Button
        type="submit"
        disabled={pending || !staffId}
        className="bg-[#ccff00] text-[#242424] hover:bg-[#ccff00]/90"
      >
        {pending ? "…" : "Применить"}
      </Button>
    </form>
  )
}
