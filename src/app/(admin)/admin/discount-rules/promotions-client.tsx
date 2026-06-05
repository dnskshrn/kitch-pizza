"use client"

import { useMemo, useState, useTransition } from "react"
import type { DiscountEffect, DiscountRule } from "@/types/promotions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Pencil, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { deleteRule, toggleRuleActive } from "./actions"
import { RuleDialog } from "./rule-dialog"

const EFFECT_LABELS: Record<DiscountEffect, string> = {
  order_percent: "% от заказа",
  order_fixed: "Фикс. скидка",
  item_percent: "% на товары",
  free_delivery: "Бесплатная доставка",
  free_item: "Подарок",
  cheapest_item_free: "N+1 бесплатный",
  bonus_multiplier: "Множитель баллов",
}

const WEEKDAYS_SHORT = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]

export type AdminBrandOption = { id: string; slug: string; name: string }

function scheduleSummary(rule: DiscountRule): string {
  const hasDays = rule.days_of_week != null && rule.days_of_week.length > 0
  const hasTime = Boolean(rule.active_from ?? rule.active_to)
  if (!hasDays && !hasTime) return "Всегда"

  const bits: string[] = []
  if (hasDays) {
    const labels = [...rule.days_of_week!]
      .sort((a, b) => a - b)
      .map((d) => WEEKDAYS_SHORT[d - 1] ?? String(d))
    bits.push(labels.join("–"))
  }
  if (hasTime) {
    const from = rule.active_from?.slice(0, 5) ?? "?"
    const to = rule.active_to?.slice(0, 5) ?? "?"
    bits.push(`${from}–${to}`)
  }
  return bits.join(" ")
}

function formatValidityDate(iso: string | null): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  return d.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

function validitySummary(rule: DiscountRule): string {
  if (!rule.valid_from && !rule.valid_until) return "бессрочно"
  const from = formatValidityDate(rule.valid_from)
  const to = formatValidityDate(rule.valid_until)
  if (from && to) return `${from} — ${to}`
  if (from) return `с ${from}`
  if (to) return `до ${to}`
  return "бессрочно"
}

function itemCountBadge(n: number): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return `${n} товар`
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) {
    return `${n} товара`
  }
  return `${n} товаров`
}

function itemPercentDiscountPct(rule: DiscountRule): number {
  if (rule.effect_value == null) return 0
  return Math.round(rule.effect_value * 100)
}

type PromotionsClientProps = {
  rules: DiscountRule[]
  brands: AdminBrandOption[]
}

export function PromotionsClient({ rules: initialRules, brands }: PromotionsClientProps) {
  const [rules, setRules] = useState(initialRules)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<DiscountRule | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<DiscountRule | null>(null)
  const [togglePending, startToggleTransition] = useTransition()
  const [deletePending, startDeleteTransition] = useTransition()

  const brandSlugById = useMemo(() => {
    const m = new Map<string, string>()
    for (const b of brands) {
      m.set(b.id, b.slug)
    }
    return m
  }, [brands])

  function openCreate() {
    setEditing(null)
    setDialogOpen(true)
  }

  function openEdit(rule: DiscountRule) {
    setEditing(rule)
    setDialogOpen(true)
  }

  function handleToggle(rule: DiscountRule, checked: boolean) {
    const prev = rule.is_active
    setRules((list) =>
      list.map((r) => (r.id === rule.id ? { ...r, is_active: checked } : r)),
    )
    startToggleTransition(async () => {
      try {
        await toggleRuleActive(rule.id, checked)
      } catch (e) {
        setRules((list) =>
          list.map((r) => (r.id === rule.id ? { ...r, is_active: prev } : r)),
        )
        toast.error(e instanceof Error ? e.message : "Не удалось переключить")
      }
    })
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Кампании</h1>
            <p className="text-muted-foreground text-sm">Campanii</p>
          </div>
          <Badge variant="secondary">{rules.length}</Badge>
        </div>
        <Button className="gap-2" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Новая кампания
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Название</TableHead>
            <TableHead>Бренд</TableHead>
            <TableHead>Тип эффекта</TableHead>
            <TableHead>Расписание</TableHead>
            <TableHead className="w-24">Приоритет</TableHead>
            <TableHead className="w-28">Активно</TableHead>
            <TableHead className="w-36 text-right">Действия</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rules.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={7}
                className="text-muted-foreground py-8 text-center"
              >
                Нет правил. Создайте первое.
              </TableCell>
            </TableRow>
          ) : (
            rules.map((rule) => {
              const isItemPercent = rule.effect_type === "item_percent"
              const itemCount = rule.target_item_ids?.length ?? 0
              const discountPct = itemPercentDiscountPct(rule)

              return (
                <TableRow key={rule.id}>
                  <TableCell className="font-medium">{rule.name}</TableCell>
                  <TableCell className="font-mono text-sm">
                    {brandSlugById.get(rule.brand_id) ?? rule.brand_id}
                  </TableCell>
                  <TableCell>
                    {isItemPercent ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">{discountPct}% скидка</Badge>
                        <Badge variant="secondary">
                          {itemCountBadge(itemCount)}
                        </Badge>
                      </div>
                    ) : (
                      EFFECT_LABELS[rule.effect_type]
                    )}
                  </TableCell>
                  <TableCell className="max-w-[200px] text-sm whitespace-normal">
                    {isItemPercent ? validitySummary(rule) : scheduleSummary(rule)}
                  </TableCell>
                  <TableCell>{rule.priority}</TableCell>
                  <TableCell>
                    <Switch
                      checked={rule.is_active}
                      disabled={togglePending}
                      onCheckedChange={(v) => handleToggle(rule, v)}
                      aria-label="Активно"
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Редактировать"
                      onClick={() => openEdit(rule)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Удалить"
                      onClick={() => setDeleteTarget(rule)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              )
            })
          )}
        </TableBody>
      </Table>

      <RuleDialog
        open={dialogOpen}
        onOpenChange={(v) => {
          setDialogOpen(v)
          if (!v) setEditing(null)
        }}
        rule={editing}
        brands={brands}
        onSaved={(saved) => {
          setRules((prev) => {
            const filtered = prev.filter((r) => r.id !== saved.id)
            const next = [...filtered, saved]
            next.sort((a, b) => {
              const bc = a.brand_id.localeCompare(b.brand_id)
              if (bc !== 0) return bc
              return b.priority - a.priority
            })
            return next
          })
        }}
        onDeleted={(id) => {
          setRules((prev) => prev.filter((r) => r.id !== id))
        }}
      />

      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="shadow-none ring-0 sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Удалить правило?</DialogTitle>
            <DialogDescription>
              Действие нельзя отменить.
              {deleteTarget ? (
                <span className="text-foreground mt-2 block font-medium">
                  {deleteTarget.name}
                </span>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Отмена
            </Button>
            <Button
              variant="destructive"
              disabled={deletePending || !deleteTarget}
              onClick={() => {
                const r = deleteTarget
                if (!r) return
                startDeleteTransition(async () => {
                  try {
                    await deleteRule(r.id)
                    setRules((prev) => prev.filter((x) => x.id !== r.id))
                    setDeleteTarget(null)
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Ошибка удаления")
                  }
                })
              }}
            >
              {deletePending ? "Удаление…" : "Удалить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
