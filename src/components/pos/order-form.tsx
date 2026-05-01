"use client"

import { brands, type BrandConfig } from "@/brands/index"
import {
  PosHeaderIconButton,
  posHeaderCloseButtonClassName,
} from "@/components/pos/pos-header-icon-button"
import { PosBrandMark } from "@/components/pos/pos-brand-mark"
import { PosProductModal } from "@/components/pos/pos-product-modal"
import { SwipeToDelete } from "@/components/pos/swipe-to-delete"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { checkDeliveryZoneByAddress } from "@/lib/actions/pos/check-delivery-zone-pos"
import type { DeliveryZoneCheckResultPos } from "@/lib/actions/pos/check-delivery-zone-pos"
import { createOrderPos } from "@/lib/actions/pos/create-order-pos"
import { updateOrderDetailsPos } from "@/lib/actions/pos/update-order-details-pos"
import { addOrderItemsPos } from "@/lib/actions/pos/update-order-items"
import { validatePromoCode } from "@/lib/actions/validate-promo-code"
import { calcPromoDiscount } from "@/lib/discount"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
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
  XIcon,
} from "lucide-react"
import Image from "next/image"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
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

/* ─── Строка корзины: два ряда — заголовок + иконка, затем кол-во и сумма ─ */
function CartItemRow({
  line,
  idx,
  onUpdateQty,
  onRemove,
  onOpenLine,
}: {
  line: PosCartItem
  idx: number
  onUpdateQty: (idx: number, delta: number) => void
  onRemove: (idx: number) => void
  onOpenLine: (idx: number) => void
}) {
  return (
    <SwipeToDelete onDelete={() => onRemove(idx)}>
      <article
        role="button"
        tabIndex={0}
        onClick={() => onOpenLine(idx)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            onOpenLine(idx)
          }
        }}
        className="flex cursor-pointer flex-col gap-2 rounded-lg bg-[#f2f2f2] p-2 outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-[#242424]/30"
      >
        <div className="flex items-start gap-2">
          <div className="relative size-10 shrink-0 overflow-hidden rounded-full bg-white">
            {line.imageUrl ? (
              <Image
                src={line.imageUrl}
                alt=""
                fill
                className="object-cover"
                sizes="40px"
              />
            ) : null}
          </div>
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 text-[13px] font-bold leading-tight text-[#242424]">
              {line.name}
              {line.size ? ` · ${line.size.toUpperCase()}` : ""}
            </p>
            {line.toppings.length > 0 ? (
              <p className="mt-0.5 line-clamp-1 text-[11px] leading-tight text-[#808080]">
                {line.toppings.map((t) => t.name).join(", ")}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 pl-12">
          <div className="flex shrink-0 items-center gap-1 rounded-full bg-white p-0.5">
            <button
              type="button"
              aria-label="Уменьшить количество"
              disabled={line.qty <= 1}
              onClick={(e) => {
                e.stopPropagation()
                onUpdateQty(idx, -1)
              }}
              className="flex size-6 items-center justify-center rounded-full text-[#242424] transition-colors hover:bg-[#f2f2f2] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Minus className="size-3.5" />
            </button>
            <span className="w-5 text-center font-mono text-[12px] font-bold tabular-nums text-[#242424]">
              {line.qty}
            </span>
            <button
              type="button"
              aria-label="Увеличить количество"
              onClick={(e) => {
                e.stopPropagation()
                onUpdateQty(idx, 1)
              }}
              className="flex size-6 items-center justify-center rounded-full text-[#242424] transition-colors hover:bg-[#f2f2f2] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Plus className="size-3.5" />
            </button>
          </div>
          <span className="min-w-0 shrink-0 text-right font-mono text-[13px] font-bold tabular-nums text-[#242424]">
            {formatMdl(line.price * line.qty)}
          </span>
        </div>
      </article>
    </SwipeToDelete>
  )
}

/* ─── Правая панель корзины ───────────────────────────────────── */
function CartPanel({
  cart,
  cartCount,
  subtotalBani,
  onUpdateQty,
  onRemove,
  onOpenLine,
  onNext,
  nextLabel,
  nextDisabled,
  errorBanner,
}: {
  cart: PosCartItem[]
  cartCount: number
  subtotalBani: number
  onUpdateQty: (idx: number, delta: number) => void
  onRemove: (idx: number) => void
  onOpenLine: (idx: number) => void
  onNext: () => void
  nextLabel: string
  nextDisabled: boolean
  errorBanner?: string | null
}) {
  return (
    /* Серая полоса-отступ справа — часть родительского bg-[#f2f2f2] */
    <div className="flex min-h-0 w-[300px] shrink-0 flex-col p-3 pl-0">
      {errorBanner ? (
        <p className="text-destructive mb-2 px-1 text-center text-xs leading-snug">
          {errorBanner}
        </p>
      ) : null}
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
            <div className="space-y-2 p-3 pr-2">
              {cart.map((line, idx) => (
                <CartItemRow
                  key={`${line.menuItemId}-${line.size ?? "x"}-${idx}`}
                  line={line}
                  idx={idx}
                  onUpdateQty={onUpdateQty}
                  onRemove={onRemove}
                  onOpenLine={onOpenLine}
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
  /** Новый заказ после шага «Оформление». */
  onOrderCreated?: (orderId: string) => void
  /** Если задан UUID — форма открывается на шаге меню для добавления позиций к существующему заказу. */
  extendOrderId?: string
  /** После успешного addOrderItemsPos или отмены «назад» со шага меню. */
  onExtendDone?: () => void
  /** Редактирование шага «Оформление» для существующего заказа (клиент, доставка, оплата). */
  editOrderDetailsId?: string
  /** После сохранения или «Назад» с шага оформления в режиме редактирования. */
  onEditDetailsDone?: () => void
}

function phoneInputFromStored(phone: string): string {
  const t = phone.replace(/\s+/g, "")
  if (t.startsWith("+373")) return t.slice(4)
  if (t.startsWith("373")) return t.slice(3)
  return t
}

function posCartFromOrderLine(line: {
  id: string
  item_name: string
  menu_item_id: string | null
  size: string | null
  quantity: number
  price: number
  toppings: unknown
  menu_items:
    | { image_url: string | null }
    | { image_url: string | null }[]
    | null
}): PosCartItem {
  const rawName = line.item_name?.trim() || "—"
  const plus = rawName.indexOf(" + ")
  const baseName = plus >= 0 ? rawName.slice(0, plus).trim() : rawName
  const sz = line.size?.toLowerCase() ?? ""
  const size: "s" | "l" | null =
    sz === "s" ? "s" : sz === "l" ? "l" : null
  const qty = Math.max(1, line.quantity)
  const unit = qty > 0 ? Math.round(line.price / qty) : 0
  const rawTops = Array.isArray(line.toppings) ? line.toppings : []
  const toppings = rawTops
    .map((t: unknown, i: number) => {
      const o = t as { name?: string; price?: number }
      return {
        id: `${line.id}-t-${i}`,
        name: typeof o.name === "string" ? o.name : "",
        price: Math.round(typeof o.price === "number" ? o.price : 0),
      }
    })
    .filter((t) => t.name)
  const embed = Array.isArray(line.menu_items)
    ? line.menu_items[0]
    : line.menu_items
  return {
    menuItemId: line.menu_item_id ?? "",
    name: baseName,
    size,
    price: unit,
    qty,
    imageUrl: embed?.image_url ?? undefined,
    toppings,
  }
}

export function OrderForm({
  onClose,
  onOrderCreated,
  extendOrderId,
  onExtendDone,
  editOrderDetailsId,
  onEditDetailsDone,
}: OrderFormProps) {
  const [step, setStep] = useState<1 | 2 | 3>(() => {
    if (editOrderDetailsId) return 3
    if (extendOrderId) return 2
    return 1
  })
  const [selectedBrand, setSelectedBrand] = useState<BrandConfig | null>(null)
  const [brandId, setBrandId] = useState<string | null>(null)
  const [categories, setCategories] = useState<MenuCategoryRow[]>([])
  const [activeCategoryId, setActiveCategoryId] = useState<string>("")
  const [menuItems, setMenuItems] = useState<MenuItemRow[]>([])
  const [menuLoading, setMenuLoading] = useState(false)
  const [cart, setCart] = useState<PosCartItem[]>([])
  const [modalItem, setModalItem] = useState<MenuItemRow | null>(null)
  const [cartEditIndex, setCartEditIndex] = useState<number | null>(null)
  const cartModalBusyRef = useRef(false)

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

  const [extendPrep, setExtendPrep] = useState<{
    loading: boolean
    error: string | null
  }>(() => ({
    loading: Boolean(extendOrderId),
    error: null,
  }))
  const [extendOrderNumber, setExtendOrderNumber] = useState<number | null>(null)
  const [extendSubmitting, setExtendSubmitting] = useState(false)
  const [extendError, setExtendError] = useState<string | null>(null)
  const [editDetailsPrep, setEditDetailsPrep] = useState<{
    loading: boolean
    error: string | null
  }>(() => ({
    loading: Boolean(editOrderDetailsId),
    error: null,
  }))
  const [editBaselineDeliveryFeeBani, setEditBaselineDeliveryFeeBani] =
    useState<number | null>(null)

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
    if (zoneResult?.status === "in_zone") {
      const zone = zoneResult.zone
      if (zone.free_delivery_from_bani != null && subtotalBani >= zone.free_delivery_from_bani) return 0
      return zone.delivery_price_bani
    }
    if (
      zoneResult?.status === "out_of_zone" ||
      zoneResult?.status === "not_found"
    ) {
      return 0
    }
    if (editOrderDetailsId && editBaselineDeliveryFeeBani != null) {
      return editBaselineDeliveryFeeBani
    }
    return 0
  }, [
    deliveryMode,
    zoneResult,
    subtotalBani,
    editOrderDetailsId,
    editBaselineDeliveryFeeBani,
  ])

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

  useEffect(() => {
    if (!extendOrderId) {
      setExtendPrep({ loading: false, error: null })
      setExtendError(null)
      if (!editOrderDetailsId) {
        setExtendOrderNumber(null)
      }
      return
    }

    let cancelled = false
    setExtendPrep({ loading: true, error: null })

    void (async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("orders")
        .select("order_number, brands(slug)")
        .eq("id", extendOrderId)
        .maybeSingle()

      if (cancelled) return

      if (error || !data) {
        setExtendPrep({ loading: false, error: "Не удалось загрузить заказ" })
        return
      }

      const bEmbed = data.brands as { slug: string } | { slug: string }[] | null
      const slug = Array.isArray(bEmbed) ? bEmbed[0]?.slug : bEmbed?.slug
      if (!slug) {
        setExtendPrep({ loading: false, error: "Бренд заказа не найден" })
        return
      }

      const cfg = brands.find((x) => x.slug === slug)
      if (!cfg) {
        setExtendPrep({ loading: false, error: "Неизвестный бренд" })
        return
      }

      setSelectedBrand(cfg)
      setExtendOrderNumber(data.order_number as number)
      setCart([])
      setModalItem(null)
      setPromoInput("")
      setPromoResult(null)
      setPromoError(null)
      setExtendPrep({ loading: false, error: null })
    })()

    return () => {
      cancelled = true
    }
  }, [extendOrderId, editOrderDetailsId])

  useEffect(() => {
    if (!editOrderDetailsId) {
      setEditDetailsPrep({ loading: false, error: null })
      setEditBaselineDeliveryFeeBani(null)
      return
    }

    let cancelled = false
    setEditDetailsPrep({ loading: true, error: null })

    void (async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("orders")
        .select(
          "*, brands(slug), order_items(id, item_name, menu_item_id, size, quantity, price, toppings, menu_items(image_url))",
        )
        .eq("id", editOrderDetailsId)
        .maybeSingle()

      if (cancelled) return

      if (error || !data) {
        setEditDetailsPrep({
          loading: false,
          error: "Не удалось загрузить заказ",
        })
        return
      }

      const bEmbed = data.brands as { slug: string } | { slug: string }[] | null
      const slug = Array.isArray(bEmbed) ? bEmbed[0]?.slug : bEmbed?.slug
      if (!slug) {
        setEditDetailsPrep({
          loading: false,
          error: "Бренд заказа не найден",
        })
        return
      }

      const cfg = brands.find((x) => x.slug === slug)
      if (!cfg) {
        setEditDetailsPrep({ loading: false, error: "Неизвестный бренд" })
        return
      }

      const row = data as {
        order_number: number
        user_name: string | null
        user_phone: string
        user_birthday: string | null
        delivery_mode: "delivery" | "pickup"
        delivery_address: string | null
        payment_method: "cash" | "card"
        change_from: number | null
        comment: string | null
        promo_code: string | null
        order_items: Array<{
          id: string
          item_name: string
          menu_item_id: string | null
          size: string | null
          quantity: number
          price: number
          toppings: unknown
          menu_items:
            | { image_url: string | null }
            | { image_url: string | null }[]
            | null
        }> | null
      }

      const lines = row.order_items ?? []
      const cartLines = lines.map(posCartFromOrderLine)
      const sub = cartLines.reduce((s, c) => s + c.price * c.qty, 0)

      setSelectedBrand(cfg)
      setExtendOrderNumber(row.order_number)
      setEditBaselineDeliveryFeeBani(
        Math.max(0, Math.round((data as { delivery_fee: number }).delivery_fee ?? 0)),
      )
      setCart(cartLines)
      setModalItem(null)
      setCartEditIndex(null)

      setPromoInput(row.promo_code?.trim() ?? "")
      setPromoError(null)
      if (row.promo_code?.trim() && sub > 0) {
        const res = await validatePromoCode(row.promo_code.trim(), sub)
        if (cancelled) return
        if (res.valid) {
          setPromoResult(res.promo)
        } else {
          setPromoResult(null)
        }
      } else {
        setPromoResult(null)
      }

      form.reset({
        userName: row.user_name?.trim() ?? "",
        userPhone: phoneInputFromStored(row.user_phone),
        userBirthday: row.user_birthday?.slice(0, 10) ?? "",
        deliveryMode: row.delivery_mode,
        deliveryAddress:
          row.delivery_mode === "delivery"
            ? (row.delivery_address?.trim() ?? "")
            : "",
        paymentMethod: row.payment_method,
        changeFromLei:
          row.change_from != null && row.change_from > 0
            ? String(row.change_from / 100)
            : "",
        comment: row.comment ?? "",
      })

      if (!cancelled) {
        setEditDetailsPrep({ loading: false, error: null })
      }
    })()

    return () => {
      cancelled = true
    }
  }, [editOrderDetailsId, form])

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
      setCartEditIndex(null)
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
      if (q < 1) return prev
      next[idx] = { ...row, qty: q }
      return next
    })
  }

  const removeLine = (idx: number) => {
    setCart((prev) => prev.filter((_, i) => i !== idx))
  }

  const closeProductModal = useCallback(() => {
    setModalItem(null)
    setCartEditIndex(null)
  }, [])

  const openCartLineModal = useCallback(async (idx: number) => {
    if (cartModalBusyRef.current) return
    const line = cart[idx]
    if (!line) return
    cartModalBusyRef.current = true
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("menu_items")
        .select(
          "id, name_ru, description_ru, category_id, price, has_sizes, size_s_price, size_l_price, size_s_label, size_l_label, image_url, menu_item_topping_groups(id)",
        )
        .eq("id", line.menuItemId)
        .maybeSingle()

      if (error || !data) {
        console.error("[order-form] cart line modal", error?.message ?? "empty")
        return
      }
      setCartEditIndex(idx)
      setModalItem(data as MenuItemRow)
    } finally {
      cartModalBusyRef.current = false
    }
  }, [cart])

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
    if (editOrderDetailsId) {
      if (!selectedBrand) return
      setSubmitError(null)
      setSubmitting(true)
      const changeBani =
        values.paymentMethod === "cash"
          ? parseLeiToBani(values.changeFromLei ?? "")
          : null

      const res = await updateOrderDetailsPos({
        orderId: editOrderDetailsId,
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
        discount: discountBani > 0 ? discountBani : 0,
        deliveryFee: deliveryFeeBani,
      })

      setSubmitting(false)
      if (!res.success) {
        setSubmitError(res.error)
        return
      }
      onEditDetailsDone?.()
      return
    }

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
        toppings: c.toppings.map((t) => ({
          name: t.name,
          price: Math.round(t.price),
        })),
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
    onOrderCreated?.(res.orderId)
  }

  const submitExtendItems = async () => {
    if (!extendOrderId || cart.length === 0) return
    setExtendError(null)
    setExtendSubmitting(true)
    try {
      const res = await addOrderItemsPos({
        orderId: extendOrderId,
        lines: cart.map((c) => ({
          menuItemId: c.menuItemId,
          name:
            c.toppings.length > 0
              ? `${c.name} + ${c.toppings.map((t) => t.name).join(", ")}`
              : c.name,
          size: c.size,
          unitPriceBani: c.price,
          qty: c.qty,
          toppings: c.toppings.map((t) => ({
            name: t.name,
            price: Math.round(t.price),
          })),
        })),
      })
      if (!res.success) {
        setExtendError(res.error)
        return
      }
      onExtendDone?.()
    } finally {
      setExtendSubmitting(false)
    }
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

  if (
    (extendOrderId && extendPrep.loading) ||
    (editOrderDetailsId && editDetailsPrep.loading)
  ) {
    return (
      <div className="text-muted-foreground flex h-full flex-col items-center justify-center gap-3 p-6 text-sm">
        <Loader2
          className="size-8 animate-spin text-foreground/60"
          aria-hidden
        />
        Загрузка заказа…
      </div>
    )
  }

  const prefetchError = extendOrderId
    ? extendPrep.error
    : editOrderDetailsId
      ? editDetailsPrep.error
      : null

  if (prefetchError) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-6">
        <p className="text-destructive text-center text-sm">{prefetchError}</p>
        <Button type="button" variant="outline" onClick={onClose}>
          Закрыть
        </Button>
      </div>
    )
  }

  /* ── Шаг 1: выбор бренда ── */
  if (step === 1 && !extendOrderId && !editOrderDetailsId) {
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
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 pb-4 pt-3">
          {brands.map((b) => (
            <button
              key={b.slug}
              type="button"
              className={cn(
                "flex min-h-[min(28vh,180px)] flex-1 cursor-pointer flex-col items-center justify-center gap-4 rounded-xl border-2 bg-white px-6 py-8 shadow-sm transition-all",
                "hover:bg-muted/30 hover:brightness-[0.99] active:scale-[0.99]",
              )}
              style={{ borderColor: b.colors.accent }}
              onClick={() => {
                setCart([])
                setModalItem(null)
                setCartEditIndex(null)
                setPromoInput("")
                setPromoResult(null)
                setPromoError(null)
                setSelectedBrand(b)
                setStep(2)
              }}
            >
              <div className="flex h-16 w-full max-w-[220px] shrink-0 items-center justify-center">
                <Image
                  src={b.logo}
                  alt={b.name}
                  width={240}
                  height={96}
                  className="max-h-16 w-auto max-w-full object-contain"
                  unoptimized
                />
              </div>
              <span className="text-center text-sm font-bold text-foreground">
                {b.name}
              </span>
            </button>
          ))}
        </div>
      </div>
    )
  }

  /* ── Шаг 2: выбор меню ── */
  if (step === 2 && selectedBrand && !editOrderDetailsId) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        {/* Навигационная шапка */}
        <FormHeader
          leftSlot={
            <>
              <PosHeaderIconButton
                aria-label="Назад"
                onClick={() =>
                  extendOrderId ? onExtendDone?.() : setStep(1)
                }
              >
                <ArrowLeft className="size-4" />
              </PosHeaderIconButton>
              {extendOrderId && extendOrderNumber != null ? (
                <span className="min-w-0 truncate text-sm font-bold text-foreground">
                  {`Добавить к заказу #${extendOrderNumber}`}
                </span>
              ) : (
                <PosBrandMark brandSlug={selectedBrand.slug} size="md" />
              )}
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
                  {extendOrderId ? "Добавить позиции" : "Оформление заказа"}
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
            onOpenLine={(idx) => void openCartLineModal(idx)}
            onNext={() =>
              extendOrderId ? void submitExtendItems() : setStep(3)
            }
            nextLabel={
              extendSubmitting
                ? "Сохранение…"
                : extendOrderId
                  ? "Добавить к заказу"
                  : "К оформлению"
            }
            nextDisabled={cart.length === 0 || extendSubmitting}
            errorBanner={extendOrderId ? extendError : null}
          />
        </div>

        <PosProductModal
          item={modalItem}
          onClose={closeProductModal}
          onAdd={(c) => addCartItem(c)}
          cartEditDraft={
            cartEditIndex !== null &&
            modalItem &&
            cart[cartEditIndex] &&
            cart[cartEditIndex]!.menuItemId === modalItem.id
              ? {
                  cartIndex: cartEditIndex,
                  qty: cart[cartEditIndex]!.qty,
                  size: cart[cartEditIndex]!.size,
                  toppings: cart[cartEditIndex]!.toppings.map((t) => ({
                    name: t.name,
                    price: t.price,
                  })),
                }
              : null
          }
          onCartEditSave={async (cartIndex, c) => {
            setCart((prev) => {
              const next = [...prev]
              if (next[cartIndex]) next[cartIndex] = c
              return next
            })
          }}
        />
      </div>
    )
  }

  /* ── Шаг 3: оформление ── */
  return (
    <>
      <div className="flex h-full min-h-0 flex-col">
        {/* Навигационная шапка */}
        <FormHeader
        leftSlot={
          <>
            <PosHeaderIconButton
              aria-label="Назад"
              onClick={() =>
                editOrderDetailsId
                  ? onEditDetailsDone?.()
                  : setStep(2)
              }
            >
              <ArrowLeft className="size-4" />
            </PosHeaderIconButton>
            <span className="min-w-0 truncate text-sm font-bold text-foreground">
              {editOrderDetailsId && extendOrderNumber != null
                ? `Редактировать · #${extendOrderNumber}`
                : "Оформление"}
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
                      {editOrderDetailsId ? "Сохранение…" : "Создание…"}
                    </span>
                  ) : editOrderDetailsId ? (
                    "Сохранить изменения"
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
              <div className="space-y-2 p-3 pr-2">
                {cart.map((line, idx) => (
                  <CartItemRow
                    key={`${line.menuItemId}-${line.size ?? "x"}-${idx}`}
                    line={line}
                    idx={idx}
                    onUpdateQty={updateQty}
                    onRemove={removeLine}
                    onOpenLine={(i) => void openCartLineModal(i)}
                  />
                ))}
              </div>
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

      <PosProductModal
        item={modalItem}
        onClose={closeProductModal}
        onAdd={(c) => addCartItem(c)}
        cartEditDraft={
          cartEditIndex !== null &&
          modalItem &&
          cart[cartEditIndex] &&
          cart[cartEditIndex]!.menuItemId === modalItem.id
            ? {
                cartIndex: cartEditIndex,
                qty: cart[cartEditIndex]!.qty,
                size: cart[cartEditIndex]!.size,
                toppings: cart[cartEditIndex]!.toppings.map((t) => ({
                  name: t.name,
                  price: t.price,
                })),
              }
            : null
        }
        onCartEditSave={async (cartIndex, c) => {
          setCart((prev) => {
            const next = [...prev]
            if (next[cartIndex]) next[cartIndex] = c
            return next
          })
        }}
      />
    </>
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
