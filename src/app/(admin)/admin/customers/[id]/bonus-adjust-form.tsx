"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"

/**
 * API `/api/admin/bonus/adjust` требует непустой `staff_id` для поля `created_by`.
 * `staffId` передаётся с сервера (первый активный сотрудник).
 */
export function BonusAdjustForm({
  profileId,
  staffId,
}: {
  profileId: string
  staffId: string | null
}) {
  const router = useRouter()
  const [type, setType] = useState<"add" | "deduct">("add")
  const [amount, setAmount] = useState("")
  const [note, setNote] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!staffId) {
      setError(
        "Нет сотрудника для аудита корректировки. Добавьте активного сотрудника в staff.",
      )
      return
    }

    const n = Number.parseInt(amount, 10)
    if (!Number.isFinite(n) || n < 1) {
      setError("Укажите целое число от 1")
      return
    }

    const noteTrim = note.trim()
    if (noteTrim === "") {
      setError("Комментарий обязателен")
      return
    }

    const payload = {
      profile_id: profileId,
      amount: type === "add" ? n : -n,
      type: type === "add" ? "manual_add" : "manual_deduct",
      note: noteTrim,
      staff_id: staffId,
    }

    setLoading(true)
    try {
      const res = await fetch("/api/admin/bonus/adjust", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) {
        setError(data.error ?? "Не удалось применить корректировку")
        return
      }
      toast.success("Бонусы обновлены")
      setAmount("")
      setNote("")
      setError(null)
      router.refresh()
    } catch {
      setError("Сеть недоступна")
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-md border p-4">
      <div className="space-y-2">
        <Label className="text-muted-foreground">Операция</Label>
        <Tabs
          value={type}
          onValueChange={(v) => setType(v === "deduct" ? "deduct" : "add")}
        >
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="add">Начислить</TabsTrigger>
            <TabsTrigger value="deduct">Списать</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 sm:items-end">
        <div className="space-y-2">
          <Label htmlFor="bonus-amount">Сумма (бонусов)</Label>
          <Input
            id="bonus-amount"
            type="number"
            min={1}
            step={1}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={loading}
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="bonus-note">Комментарий</Label>
          <Input
            id="bonus-note"
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={loading}
            placeholder="Обязательно"
          />
        </div>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Button type="submit" disabled={loading || !staffId}>
        {loading ? "…" : "Применить"}
      </Button>
    </form>
  )
}
