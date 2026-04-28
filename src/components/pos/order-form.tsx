"use client"

import { brands, type BrandConfig } from "@/brands/index"
import {
  PosHeaderIconButton,
  posHeaderCloseButtonClassName,
} from "@/components/pos/pos-header-icon-button"
import { PosProductModal } from "@/components/pos/pos-product-modal"
import { Card, CardContent } from "@/components/ui/card"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { checkDeliveryZoneByAddress } from "@/lib/actions/pos/check-delivery-zone-pos"
import type { DeliveryZoneCheckResultPos } from "@/lib/actions/pos/check-delivery-zone-pos"
import { createOrderPos } from "@/lib/actions/pos/create-order-pos"
import { validatePromoCode } from "@/lib/actions/validate-promo-code"
import { calcPromoDiscount } from "@/lib/discount"
import { createClient } from "@/lib/supabase/client"
import type { MenuItem } from "@/types/database"
import type { PosCartItem } from "@/types/pos"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  AlertCircle,
  ArrowLeft,
  Banknote,
  ChevronRight,
  CreditCard,
  Loader2,
  MapPin,
  Minus,
  Plus,
  ShoppingBag,
  Truck,
  X,
  XIcon,
} from "lucide-react"
import Image from "next/image"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"

type MenuCategoryRow = {
  id: string
  name_ru: string
  sort_order: number
}

type MenuItemRow = Pick<
  MenuItem,
  | "id"
  | "name_ru"
  | "description_ru"
  | "category_id"
  | "price"
  | "has_sizes"
  | "size_s_price"
  | "size_l_price"
  | "size_s_label"
  | "size_l_label"
  | "image_url"
> & {
  menu_item_topping_groups?: { id: string }[] | null
}

const checkoutSchema = z
  .object({
    userName: z.string().min(1, "Введите имя"),
    userPhone: z.string().min(1, "Введите телефон"),
    userBirthday: z.string().optional(),
    deliveryMode: z.enum(["delivery", "pickup"]),
    deliveryAddress: z.string().optional(),
    paymentMethod: z.enum(["cash", "card"]),
    changeFromLei: z.string().optional(),
    comment: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.deliveryMode === "delivery" && !data.deliveryAddress?.trim()) {
      ctx.addIssue({
        code: "custom",
        message: "Укажите адрес доставки",
        path: ["deliveryAddress"],
      })
    }
  })

type CheckoutFormValues = z.infer<typeof checkoutSchema>

function formatMdlAmount(bani: number): string {
  return (bani / 100).toLocaleString("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function formatMdl(bani: number): string {
  return `${formatMdlAmount(bani)} MDL`
}

function formatProductCardPrice(item: MenuItemRow): string {
  if (!item.has_sizes) {
    return `от ${formatMdlAmount(item.price ?? 0)} MDL`
  }
  const minBani = Math.min(
    item.size_s_price ?? item.price ?? 0,
    item.size_l_price ?? item.price ?? 0,
  )
  return `от ${formatMdlAmount(minBani)} MDL`
}

function parseLeiToBani(raw: string): number | null {
  const t = raw.trim().replace(",", ".")
  if (!t) return null
  const n = Number.parseFloat(t)
  if (!Number.isFinite(n) || n < 0) return null
  return Math.round(n * 100)
}

function promoErrorRu(
  err: import("@/types/database").PromoCodeValidationResult,
): string {
  if (err.valid) return ""
  switch (err.error) {
    case "not_found":
      return "Промокод не найден"
    case "inactive":
      return "Промокод неактивен"
    case "expired":
      return "Срок промокода истёк"
    case "not_started":
      return "Промокод ещё не действует"
    case "limit_reached":
      return "Лимит использований исчерпан"
    case "min_order_not_met":
      return "Не достигнута минимальная сумма заказа"
    default:
      return "Промокод недействителен"
  }
}

function unitPriceBani(row: MenuItemRow, size: "s" | "l" | null): number {
  if (!row.has_sizes) return row.price ?? 0
  if (size === "l") return row.size_l_price ?? row.price ?? 0
  if (size === "s") return row.size_s_price ?? row.price ?? 0
  return row.price ?? 0
}

/* ─── Карточка товара ─────────────────────────────────────────── */
function ProductCard({
  item,
  onAdd,
}: {
  item: MenuItemRow
  onAdd: () => void
}) {
  return (
    <button
      type="button"
      onClick={onAdd}
      aria-label={`Выбрать ${item.name_ru}`}
      className="flex flex-col items-center gap-2 rounded-xl bg-white p-3 text-left transition-colors hover:bg-[#f9f9f9] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
    >
      <div className="relative size-20 shrink-0 overflow-hidden rounded-full bg-muted">
        {item.image_url ? (
          <Image
            src={item.image_url}
            alt=""
            fill
            className="object-cover"
            sizes="80px"
          />
        ) : null}
      </div>
      <div className="flex w-full flex-col items-center gap-0.5 text-center">
        <p className="line-clamp-2 text-sm font-bold leading-tight text-foreground">
          {item.name_ru}
        </p>
        <p className="text-xs text-muted-foreground">
          {formatProductCardPrice(item)}
        </p>
      </div>
      <span
        className="flex size-8 items-center justify-center rounded-full border border-border text-base text-muted-foreground"
        aria-hidden
      >
        +
      </span>
    </button>
  )
}

/* ─── Строка корзины ──────────────────────────────────────────── */
function CartItemRow({
  line,
  idx,
  onUpdateQty,
  onRemove,
}: {
  line: PosCartItem
  idx: number
  onUpdateQty: (idx: number, delta: number) => void
  onRemove: (idx: number) => void
}) {
  return (
    <div className="border-b border-border px-4 py-3">
      <div className="flex items-start gap-3">
        {/* Миниатюра */}
        <div className="relative size-9 shrink-0 overflow-hidden rounded-full bg-muted">
          {line.imageUrl ? (
            <Image
              src={line.imageUrl}
              alt=""
              fill
              className="object-cover"
              sizes="36px"
            />
          ) : null}
        </div>
        {/* Название */}
        <div className="min-w-0 flex-1">
          <p className="line-clamp-1 text-sm font-bold text-foreground">
            {line.name}
            {line.size ? ` · ${line.size.toUpperCase()}` : ""}
          </p>
          {line.toppings.length > 0 ? (
            <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
              {line.toppings.map((t) => t.name).join(", ")}
            </p>
          ) : null}
        </div>
        {/* Удалить */}
        <button
          type="button"
          onClick={() => onRemove(idx)}
          aria-label="Удалить"
          className="flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      </div>
      {/* Счётчик + цена */}
      <div className="mt-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => onUpdateQty(idx, -1)}
            aria-label="Меньше"
            className="flex size-6 items-center justify-center rounded-full border border-border text-foreground transition-colors hover:border-foreground active:bg-muted"
          >
            <Minus className="size-3" />
          </button>
          <span className="w-4 text-center font-mono text-sm tabular-nums text-foreground">
            {line.qty}
          </span>
          <button
            type="button"
            onClick={() => onUpdateQty(idx, 1)}
            aria-label="Больше"
            className="flex size-6 items-center justify-center rounded-full border border-border text-foreground transition-colors hover:border-foreground active:bg-muted"
          >
            <Plus className="size-3" />
          </button>
        </div>
        <span className="font-mono text-sm font-bold tabular-nums text-foreground">
          {formatMdlAmount(line.price * line.qty)} лей
        </span>
      </div>
    </div>
  )
}

/* ─── Правая панель корзины ───────────────────────────────────── */
function CartPanel({
  cart,
  cartCount,
  subtotalBani,
  onUpdateQty,
  onRemove,
  onNext,
  nextLabel,
  nextDisabled,
}: {
  cart: PosCartItem[]
  cartCount: number
  subtotalBani: number
  onUpdateQty: (idx: number, delta: number) => void
  onRemove: (idx: number) => void
  onNext: () => void
  nextLabel: string
  nextDisabled: boolean
}) {
  return (
    /* Серая полоса-отступ справа — часть родительского bg-[#f2f2f2] */
    <div className="flex min-h-0 w-[300px] shrink-0 flex-col p-3 pl-0">
      <aside className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl bg-white">
        {/* Заголовок */}
        <div className="flex shrink-0 items-center gap-2.5 border-b border-border px-5 py-3.5">
          <span className="text-[11px] font-normal uppercase tracking-[0.08em] text-muted-foreground">
            Корзина
          </span>
          {cartCount > 0 && (
            <span className="inline-flex size-5 items-center justify-center rounded-full bg-foreground text-[10px] font-bold text-background">
              {cartCount}
            </span>
          )}
        </div>

        {/* Список позиций */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {cart.length === 0 ? (
            <p className="p-5 text-center text-sm text-muted-foreground">
              Корзина пуста
            </p>
          ) : (
            <div>
              {cart.map((line, idx) => (
                <CartItemRow
                  key={`${line.menuItemId}-${line.size ?? "x"}-${idx}`}
                  line={line}
                  idx={idx}
                  onUpdateQty={onUpdateQty}
                  onRemove={onRemove}
                />
              ))}
            </div>
          )}
        </div>

        {/* Футер: подытог + CTA */}
        <div className="shrink-0 border-t border-border p-5 space-y-3">
          <div className="flex items-baseline justify-between">
            <span className="text-[11px] font-normal uppercase tracking-[0.08em] text-muted-foreground">
              подытог
            </span>
            <span className="font-mono text-base font-bold tabular-nums text-foreground">
              {formatMdlAmount(subtotalBani)} лей
            </span>
          </div>
          <button
            type="button"
            disabled={nextDisabled}
            onClick={onNext}
            className="flex w-full items-center justify-between rounded-lg bg-primary px-5 py-3.5 text-[15px] font-bold text-primary-foreground transition-colors hover:bg-[#bbee00] active:scale-[0.99] active:bg-[#aadd00] disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
          >
            {nextLabel}
            <ChevronRight className="size-5 shrink-0" />
          </button>
        </div>
      </aside>
    </div>
  )
}

/* ─── Навигационная шапка (breadcrumb) ────────────────────────── */
function FormHeader({
  leftSlot,
  stepIndicator,
  onClose,
}: {
  leftSlot: React.ReactNode
  stepIndicator: React.ReactNode
  onClose: () => void
}) {
  return (
    <div className="grid h-14 shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-4 px-4">
      <div className="flex min-w-0 items-center gap-2">{leftSlot}</div>
      <div className="flex items-center">{stepIndicator}</div>
      <div className="flex justify-end">
        <PosHeaderIconButton
          aria-label="Закрыть"
          className={posHeaderCloseButtonClassName}
          onClick={onClose}
        >
          <XIcon className="size-4" />
        </PosHeaderIconButton>
      </div>
    </div>
  )
}

/* ─── Основной компонент ──────────────────────────────────────── */
type OrderFormProps = {
  onClose: () => void
  onOrderCreated: (orderId: string) => void
}

export function OrderForm({ onClose, onOrderCreated }: OrderFormProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [selectedBrand, setSelectedBrand] = useState<BrandConfig | null>(null)
  const [brandId, setBrandId] = useState<string | null>(null)
  const [categories, setCategories] = useState<MenuCategoryRow[]>([])
  const [activeCategoryId, setActiveCategoryId] = useState<string>("")
  const [menuItems, setMenuItems] = useState<MenuItemRow[]>([])
  const [menuLoading, setMenuLoading] = useState(false)
  const [cart, setCart] = useState<PosCartItem[]>([])
  const [modalItem, setModalItem] = useState<MenuItemRow | null>(null)

  const [promoInput, setPromoInput] = useState("")
  const [promoResult, setPromoResult] = useState<
    import("@/types/database").PromoCode | null
  >(null)
  const [promoError, setPromoError] = useState<string | null>(null)
  const [promoLoading, setPromoLoading] = useState(false)

  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const [zoneResult, setZoneResult] = useState<DeliveryZoneCheckResultPos | null>(null)
  const [zoneChecking, setZoneChecking] = useState(false)

  const form = useForm<CheckoutFormValues>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      userName: "",
      userPhone: "",
      userBirthday: "",
      deliveryMode: "delivery",
      deliveryAddress: "",
      paymentMethod: "cash",
      changeFromLei: "",
      comment: "",
    },
  })

  const deliveryMode = form.watch("deliveryMode")
  const paymentMethod = form.watch("paymentMethod")
  const deliveryAddress = form.watch("deliveryAddress")

  const subtotalBani = useMemo(
    () => cart.reduce((s, it) => s + it.price * it.qty, 0),
    [cart],
  )

  const discountBani = useMemo(() => {
    if (!promoResult) return 0
    return calcPromoDiscount(promoResult, subtotalBani)
  }, [promoResult, subtotalBani])

  const deliveryFeeBani = useMemo(() => {
    if (deliveryMode !== "delivery") return 0
    if (zoneResult?.status !== "in_zone") return 0
    const zone = zoneResult.zone
    if (zone.free_delivery_from_bani != null && subtotalBani >= zone.free_delivery_from_bani) return 0
    return zone.delivery_price_bani
  }, [deliveryMode, zoneResult, subtotalBani])

  const totalBani = subtotalBani - discountBani + deliveryFeeBani

  /* Debounce-проверка зоны доставки при вводе адреса */
  useEffect(() => {
    if (deliveryMode !== "delivery" || !selectedBrand) {
      setZoneResult(null)
      return
    }
    const addr = deliveryAddress?.trim() ?? ""
    if (!addr) {
      setZoneResult(null)
      return
    }

    const timer = setTimeout(async () => {
      setZoneChecking(true)
      try {
        const result = await checkDeliveryZoneByAddress(addr, selectedBrand.slug)
        setZoneResult(result)
      } finally {
        setZoneChecking(false)
      }
    }, 800)

    return () => clearTimeout(timer)
  }, [deliveryAddress, deliveryMode, selectedBrand])

  /* Сбрасываем зону при переключении режима */
  useEffect(() => {
    if (deliveryMode !== "delivery") setZoneResult(null)
  }, [deliveryMode])

  const resolveBrandId = useCallback(async (slug: string) => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("brands")
      .select("id")
      .eq("slug", slug)
      .maybeSingle()
    if (error || !data) {
      setBrandId(null)
      return
    }
    setBrandId((data as { id: string }).id)
  }, [])

  useEffect(() => {
    if (selectedBrand) void resolveBrandId(selectedBrand.slug)
  }, [selectedBrand, resolveBrandId])

  const loadCategories = useCallback(async (bid: string) => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("menu_categories")
      .select("id, name_ru, sort_order")
      .eq("brand_id", bid)
      .eq("is_active", true)
      .order("sort_order", { ascending: true })

    if (error) {
      console.error("[order-form] categories", error.message)
      setCategories([])
      setActiveCategoryId("")
      return
    }
    const rows = (data ?? []) as MenuCategoryRow[]
    setCategories(rows)
    setActiveCategoryId((prev) => {
      if (!rows.length) return ""
      if (prev && rows.some((c) => c.id === prev)) return prev
      return rows[0]!.id
    })
  }, [])

  useEffect(() => {
    if (step === 2 && brandId) void loadCategories(brandId)
  }, [step, brandId, loadCategories])

  const loadMenuItems = useCallback(async () => {
    if (!brandId || !activeCategoryId) return
    setMenuLoading(true)
    const supabase = createClient()
    const { data, error } = await supabase
      .from("menu_items")
      .select(
        "id, name_ru, description_ru, category_id, price, has_sizes, size_s_price, size_l_price, size_s_label, size_l_label, image_url, menu_item_topping_groups(id)",
      )
      .eq("brand_id", brandId)
      .eq("category_id", activeCategoryId)
      .eq("is_active", true)
      .order("sort_order", { ascending: true })

    setMenuLoading(false)
    if (error) {
      console.error("[order-form] menu_items", error.message)
      setMenuItems([])
      return
    }
    setMenuItems((data ?? []) as MenuItemRow[])
  }, [brandId, activeCategoryId])

  useEffect(() => {
    if (step === 2 && activeCategoryId) void loadMenuItems()
  }, [step, activeCategoryId, loadMenuItems])

  const cartCount = useMemo(
    () => cart.reduce((n, it) => n + it.qty, 0),
    [cart],
  )

  const toppingsSignature = useCallback((t: PosCartItem["toppings"]) => {
    return [...t]
      .map((x) => x.id)
      .sort()
      .join(",")
  }, [])

  const addCartItem = useCallback(
    (entry: PosCartItem) => {
      if (entry.price <= 0 || entry.qty < 1) return
      setCart((prev) => {
        const idx = prev.findIndex(
          (x) =>
            x.menuItemId === entry.menuItemId &&
            (x.size ?? null) === (entry.size ?? null) &&
            toppingsSignature(x.toppings) === toppingsSignature(entry.toppings),
        )
        if (idx >= 0) {
          const next = [...prev]
          next[idx] = {
            ...next[idx]!,
            qty: next[idx]!.qty + entry.qty,
          }
          return next
        }
        return [...prev, entry]
      })
    },
    [toppingsSignature],
  )

  const handleProductClick = useCallback(
    (row: MenuItemRow) => {
      const hasToppingGroups = (row.menu_item_topping_groups?.length ?? 0) > 0
      if (!row.has_sizes && !hasToppingGroups) {
        const price = unitPriceBani(row, null)
        if (price <= 0) return
        addCartItem({
          menuItemId: row.id,
          name: row.name_ru,
          size: null,
          price,
          qty: 1,
          imageUrl: row.image_url ?? undefined,
          toppings: [],
        })
        return
      }
      setModalItem(row)
    },
    [addCartItem],
  )

  const updateQty = (idx: number, delta: number) => {
    setCart((prev) => {
      const next = [...prev]
      const row = next[idx]
      if (!row) return prev
      const q = row.qty + delta
      if (q <= 0) return prev.filter((_, i) => i !== idx)
      next[idx] = { ...row, qty: q }
      return next
    })
  }

  const removeLine = (idx: number) => {
    setCart((prev) => prev.filter((_, i) => i !== idx))
  }

  const applyPromo = async () => {
    const code = promoInput.trim()
    if (!code) {
      setPromoError("Введите промокод")
      return
    }
    setPromoLoading(true)
    setPromoError(null)
    const res = await validatePromoCode(code, subtotalBani)
    setPromoLoading(false)
    if (!res.valid) {
      setPromoResult(null)
      setPromoError(promoErrorRu(res))
      return
    }
    setPromoResult(res.promo)
    setPromoError(null)
  }

  const submitCheckout = async (values: CheckoutFormValues) => {
    if (!selectedBrand) return
    setSubmitError(null)
    setSubmitting(true)
    const changeBani =
      values.paymentMethod === "cash"
        ? parseLeiToBani(values.changeFromLei ?? "")
        : null

    const res = await createOrderPos({
      brandSlug: selectedBrand.slug,
      items: cart.map((c) => ({
        menuItemId: c.menuItemId,
        name:
          c.toppings.length > 0
            ? `${c.name} + ${c.toppings.map((t) => t.name).join(", ")}`
            : c.name,
        size: c.size,
        price: c.price,
        qty: c.qty,
      })),
      userName: values.userName,
      userPhone: values.userPhone,
      userBirthday: values.userBirthday?.trim() || undefined,
      deliveryMode: values.deliveryMode,
      deliveryAddress:
        values.deliveryMode === "delivery"
          ? values.deliveryAddress
          : undefined,
      paymentMethod: values.paymentMethod,
      changeFrom: changeBani ?? undefined,
      comment: values.comment?.trim() || undefined,
      promoCode: promoResult ? promoInput.trim().toUpperCase() : undefined,
      discount: discountBani > 0 ? discountBani : undefined,
      deliveryFee: deliveryFeeBani,
    })

    setSubmitting(false)
    if (!res.success) {
      setSubmitError(res.error)
      return
    }
    onOrderCreated(res.orderId)
  }

  const onSubmit = form.handleSubmit(submitCheckout)

  /* Индикатор шагов */
  const stepIndicator = (
    <nav
      className="flex shrink-0 items-center gap-1.5 text-xs whitespace-nowrap"
      role="status"
      aria-label="Шаги оформления заказа"
    >
      <span
        className={
          step === 1 ? "font-bold text-foreground" : "text-muted-foreground"
        }
      >
        1.&nbsp;Бренд
      </span>
      <span className="text-muted-foreground" aria-hidden>→</span>
      <span
        className={
          step === 2 ? "font-bold text-foreground" : "text-muted-foreground"
        }
      >
        2.&nbsp;Заказ
      </span>
      <span className="text-muted-foreground" aria-hidden>→</span>
      <span
        className={
          step === 3 ? "font-bold text-foreground" : "text-muted-foreground"
        }
      >
        3.&nbsp;Оформление
      </span>
    </nav>
  )

  /* ── Шаг 1: выбор бренда ── */
  if (step === 1) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <FormHeader
          leftSlot={
            <h2 className="min-w-0 truncate text-sm font-bold text-foreground">
              Для какого бренда заказ?
            </h2>
          }
          stepIndicator={stepIndicator}
          onClose={onClose}
        />
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 pb-4 pt-3">
          {brands.map((b) => (
            <Card
              key={b.slug}
              className="hover:bg-muted/40 cursor-pointer border-l-4 py-0 transition-colors"
              style={{ borderLeftColor: b.colors.accent }}
              onClick={() => {
                setCart([])
                setModalItem(null)
                setPromoInput("")
                setPromoResult(null)
                setPromoError(null)
                setSelectedBrand(b)
                setStep(2)
              }}
            >
              <CardContent className="p-4">
                <p className="text-base font-bold">{b.name}</p>
                <p className="text-muted-foreground text-sm">{b.domain}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  /* ── Шаг 2: выбор меню ── */
  if (step === 2 && selectedBrand) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        {/* Навигационная шапка */}
        <FormHeader
          leftSlot={
            <>
              <PosHeaderIconButton
                aria-label="Назад"
                onClick={() => setStep(1)}
              >
                <ArrowLeft className="size-4" />
              </PosHeaderIconButton>
              <span className="min-w-0 truncate text-sm font-bold text-foreground">
                {selectedBrand.name}
              </span>
            </>
          }
          stepIndicator={stepIndicator}
          onClose={onClose}
        />

        {/* Контент: центр (меню) + правая панель (корзина) */}
        <div className="flex min-h-0 flex-1 gap-3 overflow-hidden">

          {/* ── ЦЕНТР: меню — белая карточка с отступом от серого острова ── */}
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-3 pr-0">
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl bg-white">
              <Tabs
                value={activeCategoryId}
                onValueChange={setActiveCategoryId}
                className="flex min-h-0 flex-1 flex-col overflow-hidden"
              >
                {/* Заголовок секции */}
                <p className="shrink-0 px-4 pt-4 pb-3 text-center text-[11px] font-normal uppercase tracking-[0.08em] text-muted-foreground">
                  Оформление заказа
                </p>

                {/* Горизонтальные табы категорий */}
                {categories.length > 0 && (
                  <div className="shrink-0 px-3 pb-3">
                    <div className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                      <div className="w-max min-w-full rounded-full bg-[#f2f2f2] p-1">
                        <TabsList
                          variant="pos"
                          className="inline-flex h-auto min-h-8 w-max flex-nowrap items-center justify-start gap-1 border-0 bg-transparent p-0 shadow-none ring-0"
                        >
                          {categories.map((c) => (
                            <TabsTrigger
                              key={c.id}
                              value={c.id}
                              className="h-auto shrink-0 rounded-full px-3 py-1.5 text-xs"
                            >
                              {c.name_ru}
                            </TabsTrigger>
                          ))}
                        </TabsList>
                      </div>
                    </div>
                  </div>
                )}

                {/* Сетка товаров */}
                {categories.length === 0 ? (
                  <p className="p-4 text-center text-sm text-muted-foreground">
                    Нет категорий меню для этого бренда.
                  </p>
                ) : (
                  categories.map((c) => (
                    <TabsContent
                      key={c.id}
                      value={c.id}
                      className="mt-0 min-h-0 flex-1 overflow-y-auto px-3 pb-3 data-[state=inactive]:hidden"
                    >
                      {menuLoading ? (
                        <p className="py-8 text-center text-sm text-muted-foreground">
                          Загрузка меню…
                        </p>
                      ) : menuItems.length === 0 ? (
                        <p className="py-8 text-center text-sm text-muted-foreground">
                          Нет товаров в этой категории.
                        </p>
                      ) : (
                        <div className="@container">
                          <div className="grid grid-cols-2 gap-3 @[28rem]:grid-cols-3 @[40rem]:grid-cols-4">
                            {menuItems.map((item) => (
                              <ProductCard
                                key={item.id}
                                item={item}
                                onAdd={() => handleProductClick(item)}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </TabsContent>
                  ))
                )}
              </Tabs>
            </div>
          </div>

          {/* ── ПРАВАЯ ПАНЕЛЬ: корзина ── */}
          <CartPanel
            cart={cart}
            cartCount={cartCount}
            subtotalBani={subtotalBani}
            onUpdateQty={updateQty}
            onRemove={removeLine}
            onNext={() => setStep(3)}
            nextLabel="К оформлению"
            nextDisabled={cart.length === 0}
          />
        </div>

        <PosProductModal
          item={modalItem}
          onClose={() => setModalItem(null)}
          onAdd={(c) => addCartItem(c)}
        />
      </div>
    )
  }

  /* ── Шаг 3: оформление ── */
  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Навигационная шапка */}
      <FormHeader
        leftSlot={
          <>
            <PosHeaderIconButton
              aria-label="Назад"
              onClick={() => setStep(2)}
            >
              <ArrowLeft className="size-4" />
            </PosHeaderIconButton>
            <span className="min-w-0 truncate text-sm font-bold text-foreground">
              Оформление
            </span>
          </>
        }
        stepIndicator={stepIndicator}
        onClose={onClose}
      />

      {/* Контент: форма + сводка */}
      <div className="flex min-h-0 flex-1 gap-3 overflow-hidden">

        {/* ── ЦЕНТР: форма — белая карточка в сером острове ── */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-3 pr-0">
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl bg-white">
            <p className="shrink-0 px-4 pt-4 pb-3 text-center text-[11px] font-normal uppercase tracking-[0.08em] text-muted-foreground">
              Данные заказа
            </p>
            <Form {...form}>
              <form
                className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pb-4"
                onSubmit={onSubmit}
              >
                {/* ── Тип заказа ── */}
                <FormField
                  control={form.control}
                  name="deliveryMode"
                  render={({ field }) => (
                    <FormSection title="Тип заказа">
                      <div className="grid grid-cols-2 gap-2">
                        <ModeButton
                          active={field.value === "delivery"}
                          onClick={() => field.onChange("delivery")}
                          icon={<Truck className="size-4 shrink-0" />}
                          label="Доставка"
                        />
                        <ModeButton
                          active={field.value === "pickup"}
                          onClick={() => field.onChange("pickup")}
                          icon={<ShoppingBag className="size-4 shrink-0" />}
                          label="Самовывоз"
                        />
                      </div>
                    </FormSection>
                  )}
                />

                {/* ── Контактные данные ── */}
                <FormSection title="Контактные данные">
                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      control={form.control}
                      name="userName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs text-muted-foreground">Имя</FormLabel>
                          <FormControl>
                            <Input {...field} autoComplete="name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="userPhone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs text-muted-foreground">Номер телефона</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground select-none">+373</span>
                              <Input
                                {...field}
                                placeholder="XXXXXXXX"
                                autoComplete="tel"
                                className="pl-12"
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {deliveryMode === "delivery" ? (
                    <FormField
                      control={form.control}
                      name="deliveryAddress"
                      render={({ field }) => (
                        <FormItem className="mt-3">
                          <FormLabel className="text-xs text-muted-foreground">Адрес доставки</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Улица, дом, квартира" />
                          </FormControl>
                          <FormMessage />
                          <DeliveryZoneInfo
                            result={zoneResult}
                            checking={zoneChecking}
                            subtotalBani={subtotalBani}
                          />
                        </FormItem>
                      )}
                    />
                  ) : null}

                  <FormField
                    control={form.control}
                    name="userBirthday"
                    render={({ field }) => (
                      <FormItem className="mt-3">
                        <FormLabel className="text-xs text-muted-foreground">День рождения</FormLabel>
                        <FormControl>
                          <Input {...field} type="date" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </FormSection>

                {/* ── Метод оплаты ── */}
                <FormField
                  control={form.control}
                  name="paymentMethod"
                  render={({ field }) => (
                    <FormSection title="Метод оплаты">
                      <div className="grid grid-cols-2 gap-2">
                        <ModeButton
                          active={field.value === "cash"}
                          onClick={() => field.onChange("cash")}
                          icon={<Banknote className="size-4 shrink-0" />}
                          label="Наличными"
                        />
                        <ModeButton
                          active={field.value === "card"}
                          onClick={() => field.onChange("card")}
                          icon={<CreditCard className="size-4 shrink-0" />}
                          label="Картой курьеру"
                        />
                      </div>

                      {paymentMethod === "cash" ? (
                        <FormField
                          control={form.control}
                          name="changeFromLei"
                          render={({ field: changeField }) => (
                            <FormItem className="mt-3">
                              <FormLabel className="text-xs text-muted-foreground">
                                С какой купюры потребуется сдача?
                              </FormLabel>
                              <FormControl>
                                <div className="flex items-center gap-2">
                                  <Input
                                    {...changeField}
                                    inputMode="decimal"
                                    placeholder=""
                                    className="w-24 shrink-0"
                                  />
                                  <span className="text-sm font-bold text-foreground">лей</span>
                                  <span className="text-xs text-muted-foreground">Например: 50, 100, 200, 400, 600 и т.д.</span>
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      ) : null}
                    </FormSection>
                  )}
                />

                {/* ── Дополнительно ── */}
                <FormSection title="Дополнительно">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="mb-1.5 text-xs text-muted-foreground">Промокод</p>
                      <div className="flex gap-2">
                        <Input
                          value={promoInput}
                          onChange={(e) => setPromoInput(e.target.value)}
                          placeholder="Код"
                          className="flex-1"
                        />
                        <button
                          type="button"
                          disabled={promoLoading}
                          onClick={() => void applyPromo()}
                          className="shrink-0 rounded-lg bg-muted px-3 py-2 text-xs font-bold text-foreground transition-colors hover:bg-[#e8e8e8] disabled:opacity-50"
                        >
                          {promoLoading ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            "Применить"
                          )}
                        </button>
                      </div>
                      {promoError ? (
                        <p className="mt-1 text-xs text-destructive">{promoError}</p>
                      ) : null}
                      {promoResult && !promoError ? (
                        <p className="mt-1 text-xs text-emerald-700">
                          Скидка: {formatMdl(discountBani)}
                        </p>
                      ) : null}
                    </div>
                    <div className="invisible" aria-hidden />
                  </div>

                  <FormField
                    control={form.control}
                    name="comment"
                    render={({ field }) => (
                      <FormItem className="mt-3">
                        <FormLabel className="text-xs text-muted-foreground">Комментарий</FormLabel>
                        <FormControl>
                          <Textarea {...field} rows={2} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </FormSection>

                {submitError ? (
                  <p className="text-destructive text-sm">{submitError}</p>
                ) : null}

                {/* CTA */}
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex w-full items-center justify-between rounded-lg bg-primary px-5 py-3.5 text-[15px] font-bold text-primary-foreground transition-colors hover:bg-[#bbee00] active:scale-[0.99] active:bg-[#aadd00] disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
                >
                  {submitting ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="size-4 shrink-0 animate-spin" />
                      Создание…
                    </span>
                  ) : (
                    "Создать заказ"
                  )}
                  {!submitting && <ChevronRight className="size-5 shrink-0" />}
                </button>
              </form>
            </Form>
          </div>
        </div>

        {/* ── ПРАВАЯ ПАНЕЛЬ: сводка заказа — белая карточка в сером острове ── */}
        <div className="flex min-h-0 w-[300px] shrink-0 flex-col p-3 pl-0">
          <aside className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl bg-white">
            <div className="flex shrink-0 items-center gap-2.5 border-b border-border px-5 py-3.5">
              <span className="text-[11px] font-normal uppercase tracking-[0.08em] text-muted-foreground">
                Сводка
              </span>
              {cartCount > 0 && (
                <span className="inline-flex size-5 items-center justify-center rounded-full bg-foreground text-[10px] font-bold text-background">
                  {cartCount}
                </span>
              )}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {cart.map((line, idx) => (
                <CartItemRow
                  key={`${line.menuItemId}-${line.size ?? "x"}-${idx}`}
                  line={line}
                  idx={idx}
                  onUpdateQty={updateQty}
                  onRemove={removeLine}
                />
              ))}
            </div>

            <div className="shrink-0 border-t border-border p-5 space-y-2">
              <dl className="space-y-1 text-xs">
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Подытог</dt>
                  <dd className="font-mono tabular-nums">
                    {formatMdl(subtotalBani)}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Доставка</dt>
                  <dd className="font-mono tabular-nums">
                    {formatMdl(deliveryFeeBani)}
                  </dd>
                </div>
                {discountBani > 0 ? (
                  <div className="flex justify-between gap-2 text-emerald-700">
                    <dt>Скидка</dt>
                    <dd className="font-mono tabular-nums">
                      −{formatMdl(discountBani)}
                    </dd>
                  </div>
                ) : null}
                <Separator className="my-1" />
                <div className="flex justify-between gap-2 text-sm font-bold">
                  <dt>Итого</dt>
                  <dd className="font-mono tabular-nums">
                    {formatMdl(totalBani)}
                  </dd>
                </div>
              </dl>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}

/* ── Инфо-блок зоны доставки ─────────────────────────────────── */
function DeliveryZoneInfo({
  result,
  checking,
  subtotalBani,
}: {
  result: DeliveryZoneCheckResultPos | null
  checking: boolean
  subtotalBani: number
}) {
  if (checking) {
    return (
      <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="size-3 animate-spin" />
        Проверяем зону доставки…
      </div>
    )
  }

  if (!result) return null

  if (result.status === "not_found") {
    return (
      <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-[#fff5eb] px-3 py-2 text-xs text-[#c2410c]">
        <AlertCircle className="size-3.5 shrink-0" />
        Адрес не найден — уточните название улицы
      </div>
    )
  }

  if (result.status === "out_of_zone") {
    return (
      <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-[#ffe1d4] px-3 py-2 text-xs text-[#c2410c]">
        <AlertCircle className="size-3.5 shrink-0" />
        Адрес вне зоны доставки
      </div>
    )
  }

  if (result.status === "error") {
    return (
      <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-[#fff5eb] px-3 py-2 text-xs text-[#c2410c]">
        <AlertCircle className="size-3.5 shrink-0" />
        {result.message}
      </div>
    )
  }

  /* in_zone */
  const zone = result.zone
  const isFree =
    zone.free_delivery_from_bani != null &&
    subtotalBani >= zone.free_delivery_from_bani
  const deliveryFeeDisplay = isFree
    ? "Бесплатно"
    : `${(zone.delivery_price_bani / 100).toFixed(0)} лей`

  return (
    <div className="mt-2 rounded-lg bg-[#ecffa1] px-3 py-2.5 text-xs text-[#3d5a00]">
      <div className="mb-1.5 flex items-center gap-1.5 font-bold">
        <MapPin className="size-3.5 shrink-0" />
        {zone.name}
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
        <div className="flex items-center justify-between">
          <span className="text-[#5f7600]">Доставка</span>
          <span className="font-mono font-bold tabular-nums">{deliveryFeeDisplay}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[#5f7600]">Время</span>
          <span className="font-mono font-bold tabular-nums">{zone.delivery_time_min} мин</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[#5f7600]">Мин. заказ</span>
          <span className="font-mono font-bold tabular-nums">{(zone.min_order_bani / 100).toFixed(0)} лей</span>
        </div>
        {zone.free_delivery_from_bani != null && (
          <div className="flex items-center justify-between">
            <span className="text-[#5f7600]">Бесплатно от</span>
            <span className="font-mono font-bold tabular-nums">{(zone.free_delivery_from_bani / 100).toFixed(0)} лей</span>
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Вспомогательные компоненты шага 3 ──────────────────────── */

function FormSection({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl bg-white p-4 ring-1 ring-border">
      <p className="mb-3 text-base font-bold text-foreground">{title}</p>
      {children}
    </div>
  )
}

function ModeButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "flex items-center justify-center gap-2 rounded-lg bg-foreground px-4 py-3 text-sm font-bold text-background transition-colors"
          : "flex items-center justify-center gap-2 rounded-lg bg-muted px-4 py-3 text-sm font-bold text-muted-foreground transition-colors hover:bg-[#e8e8e8] hover:text-foreground"
      }
    >
      {icon}
      {label}
    </button>
  )
}
