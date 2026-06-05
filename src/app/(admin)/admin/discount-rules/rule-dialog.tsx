"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useEffect, useState, useTransition } from "react"
import { useForm, type Resolver } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"
import type { DiscountEffect, DiscountRule } from "@/types/promotions"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { deleteRule, saveRule } from "./actions"
import {
  CategoryTargetPicker,
  GiftMenuItemPicker,
  ItemPercentTargetPicker,
  PromoCodePicker,
} from "./rule-search-comboboxes"

const EFFECT_OPTIONS: { value: DiscountEffect; label: string }[] = [
  { value: "order_percent", label: "% от заказа" },
  { value: "order_fixed", label: "Фикс. скидка" },
  { value: "item_percent", label: "% на товары" },
  { value: "free_delivery", label: "Бесплатная доставка" },
  { value: "free_item", label: "Подарок" },
  { value: "cheapest_item_free", label: "N+1 бесплатный" },
  { value: "bonus_multiplier", label: "Множитель баллов" },
]

const WEEKDAY_LABELS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"] as const

const effectSchema = z.enum([
  "order_percent",
  "order_fixed",
  "item_percent",
  "free_delivery",
  "free_item",
  "cheapest_item_free",
  "bonus_multiplier",
])

const ruleFormSchema = z
  .object({
    name: z.string().min(1, "Укажите название"),
    brand_id: z.string().uuid("Выберите бренд"),
    effect_type: effectSchema,
    priority: z.preprocess(
      (v) => (v === "" || v == null ? 0 : Number(v)),
      z.number().int(),
    ),
    is_active: z.boolean(),
    effectValueInput: z.string(),
    gift_item_id: z.string(),
    gift_variant_id: z.string(),
    free_every_n: z.string(),
    min_order_mdl: z.string(),
    trigger_type: z.enum(["auto", "promo_code"]),
    promo_code_id: z.string(),
    days_of_week: z.array(z.number().int().min(1).max(7)),
    time_from: z.string(),
    time_to: z.string(),
    valid_from: z.string(),
    valid_until: z.string(),
    max_uses: z.string(),
    target_item_ids: z.array(z.string().uuid()),
    target_category_ids: z.array(z.string().uuid()),
  })
  .superRefine((val, ctx) => {
    const vf = val.valid_from.trim()
    const vu = val.valid_until.trim()
    if ((vf === "") !== (vu === "")) {
      ctx.addIssue({
        code: "custom",
        message: "Заполните оба поля периода действия или оставьте пустыми",
        path: ["valid_until"],
      })
    }
    if (vf && vu) {
      const a = new Date(vf)
      const b = new Date(vu)
      if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) {
        ctx.addIssue({
          code: "custom",
          message: "Некорректная дата",
          path: ["valid_until"],
        })
      } else if (a.getTime() >= b.getTime()) {
        ctx.addIssue({
          code: "custom",
          message: "«Действует с» должно быть раньше «Действует до»",
          path: ["valid_until"],
        })
      }
    }

    const tf = val.time_from.trim()
    const tt = val.time_to.trim()
    if ((tf === "") !== (tt === "")) {
      ctx.addIssue({
        code: "custom",
        message: "Укажите время «с» и «до» или оставьте оба пустыми",
        path: ["time_to"],
      })
    }

    const needsEffectValue =
      val.effect_type === "order_percent" ||
      val.effect_type === "item_percent" ||
      val.effect_type === "order_fixed" ||
      val.effect_type === "bonus_multiplier"

    const raw = val.effectValueInput.replace(",", ".").trim()
    if (needsEffectValue) {
      if (raw === "") {
        ctx.addIssue({
          code: "custom",
          message: "Укажите значение",
          path: ["effectValueInput"],
        })
      } else {
        const n = Number(raw)
        if (!Number.isFinite(n) || n <= 0) {
          ctx.addIssue({
            code: "custom",
            message: "Значение должно быть больше 0",
            path: ["effectValueInput"],
          })
        }
        if (
          val.effect_type === "order_percent" ||
          val.effect_type === "item_percent"
        ) {
          if (n > 100) {
            ctx.addIssue({
              code: "custom",
              message: "Процент не больше 100",
              path: ["effectValueInput"],
            })
          }
        }
      }
    }

    if (val.effect_type === "cheapest_item_free") {
      const n = parseInt(val.free_every_n.trim(), 10)
      if (!Number.isFinite(n) || n < 1) {
        ctx.addIssue({
          code: "custom",
          message: "Укажите N ≥ 1",
          path: ["free_every_n"],
        })
      }
    }

    if (val.effect_type === "item_percent" && val.target_item_ids.length === 0) {
      ctx.addIssue({
        code: "custom",
        message: "Выберите хотя бы один товар",
        path: ["target_item_ids"],
      })
    }

    if (val.effect_type === "free_item") {
      const gid = val.gift_item_id.trim()
      if (!gid) {
        ctx.addIssue({
          code: "custom",
          message: "Выберите товар из меню",
          path: ["gift_item_id"],
        })
      } else if (!z.string().uuid().safeParse(gid).success) {
        ctx.addIssue({
          code: "custom",
          message: "Некорректный UUID товара",
          path: ["gift_item_id"],
        })
      }
      const vid = val.gift_variant_id.trim()
      if (vid && !z.string().uuid().safeParse(vid).success) {
        ctx.addIssue({
          code: "custom",
          message: "Некорректный UUID варианта",
          path: ["gift_variant_id"],
        })
      }
    }

    if (val.trigger_type === "promo_code") {
      const pid = val.promo_code_id.trim()
      if (!pid) {
        ctx.addIssue({
          code: "custom",
          message: "Выберите промокод",
          path: ["promo_code_id"],
        })
      } else if (!z.string().uuid().safeParse(pid).success) {
        ctx.addIssue({
          code: "custom",
          message: "Некорректный UUID промокода",
          path: ["promo_code_id"],
        })
      }
    }
  })

export type RuleFormValues = {
  name: string
  brand_id: string
  effect_type: DiscountEffect
  priority: number
  is_active: boolean
  effectValueInput: string
  gift_item_id: string
  gift_variant_id: string
  free_every_n: string
  min_order_mdl: string
  trigger_type: "auto" | "promo_code"
  promo_code_id: string
  days_of_week: number[]
  time_from: string
  time_to: string
  valid_from: string
  valid_until: string
  max_uses: string
  target_item_ids: string[]
  target_category_ids: string[]
}

function isoToDatetimeLocal(iso: string | null): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function ruleToFormValues(rule: DiscountRule): RuleFormValues {
  let effectValueInput = ""
  if (
    rule.effect_type === "order_percent" ||
    rule.effect_type === "item_percent"
  ) {
    effectValueInput =
      rule.effect_value != null ? String(Number((rule.effect_value * 100).toFixed(4))) : ""
  } else if (rule.effect_type === "order_fixed") {
    effectValueInput =
      rule.effect_value != null ? String(rule.effect_value / 100) : ""
  } else if (rule.effect_type === "bonus_multiplier") {
    effectValueInput =
      rule.effect_value != null ? String(rule.effect_value) : ""
  }

  return {
    name: rule.name,
    brand_id: rule.brand_id,
    effect_type: rule.effect_type,
    priority: rule.priority,
    is_active: rule.is_active,
    effectValueInput,
    gift_item_id: rule.gift_item_id ?? "",
    gift_variant_id: rule.gift_item_variant_id ?? "",
    free_every_n: rule.free_every_n != null ? String(rule.free_every_n) : "",
    min_order_mdl:
      rule.min_order_bani != null ? String(rule.min_order_bani / 100) : "",
    trigger_type: rule.trigger_type,
    promo_code_id: rule.promo_code_id ?? "",
    days_of_week: rule.days_of_week ? [...rule.days_of_week] : [],
    time_from: rule.active_from?.slice(0, 5) ?? "",
    time_to: rule.active_to?.slice(0, 5) ?? "",
    valid_from: isoToDatetimeLocal(rule.valid_from),
    valid_until: isoToDatetimeLocal(rule.valid_until),
    max_uses: rule.max_uses != null ? String(rule.max_uses) : "",
    target_item_ids: rule.target_item_ids ? [...rule.target_item_ids] : [],
    target_category_ids: rule.target_category_ids
      ? [...rule.target_category_ids]
      : [],
  }
}

function emptyForm(defaultBrandId: string): RuleFormValues {
  return {
    name: "",
    brand_id: defaultBrandId,
    effect_type: "order_percent",
    priority: 0,
    is_active: true,
    effectValueInput: "",
    gift_item_id: "",
    gift_variant_id: "",
    free_every_n: "",
    min_order_mdl: "",
    trigger_type: "auto",
    promo_code_id: "",
    days_of_week: [],
    time_from: "",
    time_to: "",
    valid_from: "",
    valid_until: "",
    max_uses: "",
    target_item_ids: [],
    target_category_ids: [],
  }
}

function formToPartialRule(values: RuleFormValues, id: string | null): Partial<DiscountRule> {
  let effect_value: number | null = null
  const raw = values.effectValueInput.replace(",", ".").trim()
  const et = values.effect_type

  if (et === "order_percent" || et === "item_percent") {
    const p = Number(raw)
    effect_value = p / 100
  } else if (et === "order_fixed") {
    effect_value = Math.round(Number(raw) * 100)
  } else if (et === "bonus_multiplier") {
    effect_value = Number(raw)
  } else {
    effect_value = null
  }

  const gift_item_id =
    values.effect_type === "free_item" && values.gift_item_id.trim() !== ""
      ? values.gift_item_id.trim()
      : null
  const gift_item_variant_id =
    values.effect_type === "free_item" && values.gift_variant_id.trim() !== ""
      ? values.gift_variant_id.trim()
      : null

  let free_every_n: number | null = null
  if (values.effect_type === "cheapest_item_free") {
    free_every_n = parseInt(values.free_every_n.trim(), 10)
  }

  const tf = values.time_from.trim()
  const tt = values.time_to.trim()
  let active_from: string | null = null
  let active_to: string | null = null
  if (tf && tt) {
    active_from = tf.length === 5 && tf.split(":").length === 2 ? `${tf}:00` : tf
    active_to = tt.length === 5 && tt.split(":").length === 2 ? `${tt}:00` : tt
  }

  const minRaw = values.min_order_mdl.trim()
  const min_order_bani =
    minRaw === "" ? null : Math.round(Number(minRaw.replace(",", ".")) * 100)

  const maxRaw = values.max_uses.trim()
  const max_uses =
    maxRaw === "" ? null : Math.max(0, parseInt(maxRaw, 10))

  const vf = values.valid_from.trim()
  const vu = values.valid_until.trim()
  let valid_from: string | null = null
  let valid_until: string | null = null
  if (vf && vu) {
    valid_from = new Date(vf).toISOString()
    valid_until = new Date(vu).toISOString()
  }

  const days_of_week =
    values.days_of_week.length > 0
      ? [...values.days_of_week].sort((a, b) => a - b)
      : null

  const promo_code_id =
    values.trigger_type === "promo_code" && values.promo_code_id.trim() !== ""
      ? values.promo_code_id.trim()
      : null

  return {
    ...(id ? { id } : {}),
    brand_id: values.brand_id,
    name: values.name.trim(),
    label_ru: values.name.trim(),
    label_ro: null,
    effect_type: values.effect_type,
    effect_value,
    gift_item_id,
    gift_item_variant_id,
    target_item_ids:
      values.effect_type === "item_percent" && values.target_item_ids.length > 0
        ? [...values.target_item_ids]
        : null,
    target_category_ids:
      values.effect_type === "cheapest_item_free" &&
      values.target_category_ids.length > 0
        ? [...values.target_category_ids]
        : null,
    free_every_n,
    trigger_type: values.trigger_type,
    promo_code_id,
    min_order_bani,
    required_item_ids: null,
    required_item_min_qty: null,
    days_of_week,
    active_from,
    active_to,
    max_uses,
    valid_from,
    valid_until,
    priority: values.priority,
    is_active: values.is_active,
  }
}

type BrandOption = { id: string; slug: string; name: string }

type RuleDialogProps = {
  open: boolean
  onOpenChange: (v: boolean) => void
  rule: DiscountRule | null
  brands: BrandOption[]
  onSaved: (rule: DiscountRule) => void
  onDeleted: (id: string) => void
}

export function RuleDialog({
  open,
  onOpenChange,
  rule,
  brands,
  onSaved,
  onDeleted,
}: RuleDialogProps) {
  const defaultBrandId = brands[0]?.id ?? ""
  const form = useForm<RuleFormValues>({
    resolver: zodResolver(ruleFormSchema) as Resolver<RuleFormValues>,
    defaultValues: emptyForm(defaultBrandId),
  })

  const [pending, startTransition] = useTransition()
  const [deletePending, startDeleteTransition] = useTransition()
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    if (rule) {
      form.reset(ruleToFormValues(rule))
    } else if (defaultBrandId) {
      form.reset(emptyForm(defaultBrandId))
    }
  }, [open, rule, defaultBrandId, form])

  const effectType = form.watch("effect_type")

  function effectValueLabel(): string {
    switch (effectType) {
      case "order_percent":
      case "item_percent":
        return "Скидка %"
      case "order_fixed":
        return "Скидка (MDL)"
      case "bonus_multiplier":
        return "Множитель (напр. 2 = двойные баллы)"
      default:
        return "Значение"
    }
  }

  function showEffectValueInput(): boolean {
    return (
      effectType === "order_percent" ||
      effectType === "item_percent" ||
      effectType === "order_fixed" ||
      effectType === "bonus_multiplier"
    )
  }

  function onSubmit(values: RuleFormValues) {
    startTransition(async () => {
      try {
        const payload = formToPartialRule(values, rule?.id ?? null)
        const saved = await saveRule(payload)
        onSaved(saved)
        toast.success(rule ? "Сохранено" : "Правило создано")
        onOpenChange(false)
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Ошибка сохранения")
      }
    })
  }

  function handleDelete() {
    if (!rule?.id) return
    startDeleteTransition(async () => {
      try {
        await deleteRule(rule.id)
        onDeleted(rule.id)
        setDeleteConfirmOpen(false)
        onOpenChange(false)
        toast.success("Удалено")
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Ошибка удаления")
      }
    })
  }

  if (!defaultBrandId && open && !rule) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Нет брендов</DialogTitle>
            <DialogDescription>
              Добавьте бренды в базе, чтобы создавать правила.
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="shadow-none ring-0 sm:max-h-[90vh] sm:max-w-2xl sm:overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{rule ? "Редактирование правила" : "Новое правило"}</DialogTitle>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              <section className="space-y-4">
                <h3 className="text-sm font-semibold">Основное</h3>
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Название</FormLabel>
                      <FormControl>
                        <Input {...field} autoComplete="off" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="brand_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Бренд</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Бренд" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {brands.map((b) => (
                            <SelectItem key={b.id} value={b.id}>
                              {b.name} ({b.slug})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="effect_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Тип эффекта</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {EFFECT_OPTIONS.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex flex-wrap gap-4">
                  <FormField
                    control={form.control}
                    name="priority"
                    render={({ field }) => (
                      <FormItem className="min-w-[120px] flex-1">
                        <FormLabel>Приоритет</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="is_active"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between gap-4 rounded-lg border p-3">
                        <FormLabel className="!mt-0">Активно</FormLabel>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              </section>

              <section className="space-y-4">
                <h3 className="text-sm font-semibold">Значение эффекта</h3>
                {showEffectValueInput() ? (
                  <FormField
                    control={form.control}
                    name="effectValueInput"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{effectValueLabel()}</FormLabel>
                        <FormControl>
                          <Input {...field} inputMode="decimal" autoComplete="off" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ) : null}

                {effectType === "free_item" ? (
                  <>
                    <FormField
                      control={form.control}
                      name="gift_item_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Подарочный товар</FormLabel>
                          <FormControl>
                            <GiftMenuItemPicker
                              brandId={form.watch("brand_id")}
                              selectedItemId={field.value}
                              selectedVariantId={form.watch("gift_variant_id")}
                              onPick={(itemId, variantId) => {
                                field.onChange(itemId)
                                form.setValue("gift_variant_id", variantId)
                              }}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="gift_variant_id"
                      render={() => (
                        <FormItem className="space-y-0">
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </>
                ) : null}

                {effectType === "cheapest_item_free" ? (
                  <>
                    <FormField
                      control={form.control}
                      name="free_every_n"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Купи N — один бесплатно</FormLabel>
                          <FormControl>
                            <Input type="number" min={1} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="target_category_ids"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Категории</FormLabel>
                          <FormControl>
                            <CategoryTargetPicker
                              brandId={form.watch("brand_id")}
                              selectedIds={field.value}
                              onChange={field.onChange}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </>
                ) : null}

                {effectType === "item_percent" ? (
                  <FormField
                    control={form.control}
                    name="target_item_ids"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Товары</FormLabel>
                        <FormControl>
                          <ItemPercentTargetPicker
                            brandId={form.watch("brand_id")}
                            selectedIds={field.value}
                            onChange={field.onChange}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ) : null}
              </section>

              <section className="space-y-4">
                <h3 className="text-sm font-semibold">Условия применения</h3>
                <FormField
                  control={form.control}
                  name="min_order_mdl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Минимальная сумма заказа (MDL)</FormLabel>
                      <FormControl>
                        <Input {...field} inputMode="decimal" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="trigger_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Срабатывание</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="auto">Автоматически</SelectItem>
                          <SelectItem value="promo_code">По промокоду</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {form.watch("trigger_type") === "promo_code" ? (
                  <FormField
                    control={form.control}
                    name="promo_code_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Промокод</FormLabel>
                        <FormControl>
                          <PromoCodePicker
                            brandId={form.watch("brand_id")}
                            selectedPromoId={field.value}
                            onPick={(id) => field.onChange(id)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ) : null}
              </section>

              <section className="space-y-4">
                <h3 className="text-sm font-semibold">Расписание</h3>
                <FormField
                  control={form.control}
                  name="days_of_week"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Дни недели</FormLabel>
                      <div className="flex flex-wrap gap-3">
                        {WEEKDAY_LABELS.map((label, idx) => {
                          const day = idx + 1
                          const checked = field.value.includes(day)
                          return (
                            <label
                              key={day}
                              className="flex cursor-pointer items-center gap-2 text-sm"
                            >
                              <Checkbox
                                checked={checked}
                                onCheckedChange={(c) => {
                                  if (c === true) {
                                    field.onChange([...field.value, day])
                                  } else {
                                    field.onChange(field.value.filter((d) => d !== day))
                                  }
                                }}
                              />
                              {label}
                            </label>
                          )
                        })}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="time_from"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Время с</FormLabel>
                        <FormControl>
                          <Input type="time" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="time_to"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Время по</FormLabel>
                        <FormControl>
                          <Input type="time" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="valid_from"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Действует с</FormLabel>
                        <FormControl>
                          <Input type="datetime-local" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="valid_until"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Действует до</FormLabel>
                        <FormControl>
                          <Input type="datetime-local" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </section>

              <section className="space-y-4">
                <h3 className="text-sm font-semibold">Лимиты</h3>
                <FormField
                  control={form.control}
                  name="max_uses"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Макс. использований (необязательно)</FormLabel>
                      <FormControl>
                        <Input type="number" min={0} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </section>

              <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
                <div>
                  {rule?.id ? (
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={() => setDeleteConfirmOpen(true)}
                    >
                      Удалить
                    </Button>
                  ) : null}
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                  >
                    Отмена
                  </Button>
                  <Button type="submit" disabled={pending}>
                    {pending ? "Сохранение…" : "Сохранить"}
                  </Button>
                </div>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="shadow-none ring-0 sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Удалить правило?</DialogTitle>
            <DialogDescription>Это действие нельзя отменить.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)}>
              Отмена
            </Button>
            <Button variant="destructive" disabled={deletePending} onClick={handleDelete}>
              {deletePending ? "Удаление…" : "Удалить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
