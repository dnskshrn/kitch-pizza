"use client"

import { normalizePosBrandSlug, type BrandConfig } from "@/brands/index"
import type { OrdersPanelHandle } from "@/components/pos/orders-panel"
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { checkDeliveryZoneByAddress } from "@/lib/actions/pos/check-delivery-zone-pos"
import type { DeliveryZoneCheckResultPos } from "@/lib/actions/pos/check-delivery-zone-pos"
import { cancelOrderPos } from "@/lib/actions/pos/cancel-order-pos"
import { sendPosDraftToKitchen } from "@/lib/actions/pos/send-pos-draft-to-kitchen"
import { updateOrderDetailsPos } from "@/lib/actions/pos/update-order-details-pos"
import { updateOrderBrandPos } from "@/lib/actions/pos/update-order-brand-pos"
import {
  addOrderItemsPos,
  removeOrderItemPos,
  replaceOrderItemsPos,
  updateOrderItemCompositionPos,
  updateOrderItemQuantityPos,
} from "@/lib/actions/pos/update-order-items"
import { validatePromoCode } from "@/lib/actions/validate-promo-code"
import { calcPromoDiscount } from "@/lib/discount"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import { orderItemSizeDisplayLabel } from "@/lib/order-item-size-display"
import {
  POS_MENU_ITEM_FOR_MODAL_SELECT,
  posMenuRowForModal,
  posVariantsFromMenuEmbed,
} from "@/lib/pos/menu-item-modal-row"
import { writePosBrandSlugCookie } from "@/lib/pos/pos-brand-slug-cookie"
import type { MenuItem, MenuItemVariant } from "@/types/database"
import type { PosCartItem, PosOrder, PosWizardBrandOption } from "@/types/pos"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  AlertCircle,
  ArrowLeft,
  Banknote,
  CreditCard,
  Loader2,
  MapPin,
  Minus,
  MoreVertical,
  Plus,
  ShoppingBag,
  Truck,
  XIcon,
} from "lucide-react"
import Image from "next/image"
import type { RefObject } from "react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
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
  | "image_url"
> & {
  menu_item_variants?: MenuItemVariant[] | null
  menu_item_topping_groups?: { id: string }[] | null
}

const checkoutSchema = z
  .object({
    userName: z.string().min(1, "Введите имя"),
    userPhone: z.string().min(1, "Введите телефон"),
    deliveryMode: z.enum(["delivery", "pickup"]),
    deliveryAddress: z.string().optional(),
    addressEntrance: z.string().optional(),
    addressFloor: z.string().optional(),
    addressApartment: z.string().optional(),
    addressIntercom: z.string().optional(),
    paymentMethod: z.enum(["cash", "card"]),
    changeFromLei: z.string().optional(),
    comment: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.deliveryMode === "delivery" && !data.deliveryAddress?.trim()) {
      ctx.addIssue({
        code: "custom",
        message: "Укажите улицу и дом",
        path: ["deliveryAddress"],
      })
    }
  })

type CheckoutFormValues = z.infer<typeof checkoutSchema>

function checkoutValuesFromPosListOrder(o: PosOrder): CheckoutFormValues {
  return {
    userName: o.user_name?.trim() ?? "",
    userPhone: phoneInputFromStored(o.user_phone ?? ""),
    deliveryMode: o.delivery_mode,
    deliveryAddress:
      o.delivery_mode === "delivery"
        ? (o.delivery_address?.trim() ?? "")
        : "",
    addressEntrance: o.address_entrance?.trim() ?? "",
    addressFloor: o.address_floor?.trim() ?? "",
    addressApartment: o.address_apartment?.trim() ?? "",
    addressIntercom: o.address_intercom?.trim() ?? "",
    paymentMethod: o.payment_method ?? "cash",
    changeFromLei:
      o.change_from != null && o.change_from > 0
        ? String(o.change_from / 100)
        : "",
    comment: o.comment ?? "",
  }
}

function cartFingerprint(lines: PosCartItem[]): string {
  return lines
    .map(
      (c, i) =>
        `${i}:${c.orderItemId ?? ""}:${c.menuItemId}:${c.variantId ?? ""}:${c.size ?? ""}:${c.qty}:${c.price}:${c.toppings.map((t) => `${t.name}:${t.price}`).join(";")}`,
    )
    .join("|")
}

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
  const variants = posVariantsFromMenuEmbed(item)
  if (!item.has_sizes) {
    return `от ${formatMdlAmount(item.price ?? 0)} MDL`
  }
  const minFromV = variants.length
    ? Math.min(...variants.map((v) => v.price))
    : null
  const fallback = typeof item.price === "number" ? item.price : 0
  const minBani = minFromV ?? fallback
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

function unitPriceBani(row: MenuItemRow): number {
  const variants = posVariantsFromMenuEmbed(row)
  if (!row.has_sizes) return row.price ?? 0
  if (variants.length === 0) return row.price ?? 0
  return Math.min(...variants.map((v) => v.price))
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
  cartInteractionDisabled,
}: {
  line: PosCartItem
  idx: number
  onUpdateQty: (idx: number, delta: number) => void | Promise<void>
  onRemove: (idx: number) => void | Promise<void>
  onOpenLine: (idx: number) => void
  cartInteractionDisabled: boolean
}) {
  const locked = cartInteractionDisabled
  return (
    <SwipeToDelete onDelete={() => onRemove(idx)} disabled={locked}>
      <article
        role="button"
        tabIndex={0}
        onClick={() => !locked && onOpenLine(idx)}
        onKeyDown={(e) => {
          if (locked) return
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            onOpenLine(idx)
          }
        }}
        className={cn(
          "flex cursor-pointer flex-col gap-2 rounded-lg bg-[#f2f2f2] p-2 outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-[#242424]/30",
          locked && "pointer-events-none cursor-default opacity-60",
        )}
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
              {line.size
                ? ` · ${orderItemSizeDisplayLabel(line.size)}`
                : ""}
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
              disabled={locked}
              onClick={(e) => {
                e.stopPropagation()
                if (line.qty <= 1) {
                  void onRemove(idx)
                  return
                }
                void onUpdateQty(idx, -1)
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
              disabled={locked}
              onClick={(e) => {
                e.stopPropagation()
                void onUpdateQty(idx, 1)
              }}
              className="flex size-6 items-center justify-center rounded-full text-[#242424] transition-colors hover:bg-[#f2f2f2] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Plus className="size-3.5" />
            </button>
          </div>
          <span className="flex min-w-0 shrink-0 items-center gap-1 text-right font-mono text-[13px] font-bold tabular-nums text-[#242424]">
            {formatMdl(line.price * line.qty)}
          </span>
        </div>
      </article>
    </SwipeToDelete>
  )
}

const POS_RUNNER_CTA_CLASS =
  "flex w-full items-center justify-center rounded-lg bg-[#ccff00] px-5 py-3.5 text-[15px] font-bold text-[#242424] transition-colors hover:bg-[#bbee00] active:scale-[0.99] active:bg-[#aadd00] disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"

/* ─── Правая панель корзины ───────────────────────────────────── */
function CartPanel({
  cart,
  cartCount,
  subtotalBani,
  onUpdateQty,
  onRemove,
  onOpenLine,
  errorBanner,
  cartInteractionDisabled,
  onRunnerSend,
  runnerDisabled,
  runnerBusy,
  runnerAlreadySent,
}: {
  cart: PosCartItem[]
  cartCount: number
  subtotalBani: number
  onUpdateQty: (idx: number, delta: number) => void | Promise<void>
  onRemove: (idx: number) => void | Promise<void>
  onOpenLine: (idx: number) => void
  errorBanner?: string | null
  cartInteractionDisabled: boolean
  onRunnerSend?: () => void | Promise<void>
  runnerDisabled?: boolean
  runnerBusy?: boolean
  /** Заказ уже ушёл на кухню (не черновик) — только подпись, без повторной отправки */
  runnerAlreadySent?: boolean
}) {
  return (
    /* Серая полоса-отступ справа — часть родительского bg-[#f2f2f2] */
    <div className="flex h-full min-h-0 w-[300px] shrink-0 flex-col overflow-hidden p-3 pl-0">
      {errorBanner ? (
        <p className="text-destructive mb-2 shrink-0 px-1 text-center text-xs leading-snug">
          {errorBanner}
        </p>
      ) : null}
      <aside className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl bg-white">
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
                  key={
                    line.orderItemId ??
                    `${line.menuItemId}-${line.variantId ?? ""}-${line.size ?? "x"}-${idx}`
                  }
                  line={line}
                  idx={idx}
                  onUpdateQty={onUpdateQty}
                  onRemove={onRemove}
                  onOpenLine={onOpenLine}
                  cartInteractionDisabled={cartInteractionDisabled}
                />
              ))}
            </div>
          )}
        </div>

        {/* Футер: подытог + CTA */}
        <div className="shrink-0 border-t border-border p-5">
          <div className="flex items-baseline justify-between">
            <span className="text-[11px] font-normal uppercase tracking-[0.08em] text-muted-foreground">
              подытог
            </span>
            <span className="font-mono text-base font-bold tabular-nums text-foreground">
              {formatMdlAmount(subtotalBani)} лей
            </span>
          </div>
          {onRunnerSend ? (
            <button
              type="button"
              disabled={runnerAlreadySent || runnerDisabled || runnerBusy}
              onClick={() => void onRunnerSend()}
              className={cn("mt-3", POS_RUNNER_CTA_CLASS)}
            >
              {runnerAlreadySent ? (
                "Бегунок отправлен"
              ) : runnerBusy ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="size-4 shrink-0 animate-spin" />
                  Отправка…
                </span>
              ) : (
                "Отправить бегунок"
              )}
            </button>
          ) : null}
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
  headerMenu,
}: {
  leftSlot: React.ReactNode
  stepIndicator: React.ReactNode
  onClose: () => void
  /** Меню «⋯» слева от кнопки закрытия */
  headerMenu?: React.ReactNode
}) {
  return (
    <div className="grid h-14 shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-4 px-4">
      <div className="flex min-w-0 items-center gap-2">{leftSlot}</div>
      <div className="flex items-center">{stepIndicator}</div>
      <div className="flex items-center justify-end gap-1">
        {headerMenu}
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
  variant_id?: string | null
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
    orderItemId: line.id,
    menuItemId: line.menu_item_id ?? "",
    name: baseName,
    size: line.size,
    variantId: line.variant_id ?? null,
    price: unit,
    qty,
    imageUrl: embed?.image_url ?? undefined,
    toppings,
  }
}

type OrderFormProps = {
  /** UUID заказа POS (черновик или существующий) — мастер оформления. */
  orderId: string
  /** Бренды: конфиг витрины + UUID из БД (загрузка списка на уровне страницы POS). */
  wizardBrands: PosWizardBrandOption[]
  /** Заказ из списка панели — для полей «Детали» без отдельного запроса при смене шага. */
  listOrder: PosOrder | null
  onClose: () => void
  ordersPanelRef?: RefObject<OrdersPanelHandle | null>
}

function posLinePayloadFromCartItem(c: PosCartItem) {
  return {
    menuItemId: c.menuItemId,
    name:
      c.toppings.length > 0
        ? `${c.name} + ${c.toppings.map((t) => t.name).join(", ")}`
        : c.name,
    size: c.size,
    variantId: c.variantId ?? null,
    unitPriceBani: c.price,
    qty: c.qty,
    toppings: c.toppings.map((t) => ({
      name: t.name,
      price: Math.round(t.price),
    })),
  }
}

export function OrderForm({
  orderId: posOrderId,
  wizardBrands,
  listOrder,
  onClose,
  ordersPanelRef,
}: OrderFormProps) {
  const updateOrderLocalState = useCallback(
    (orderId: string, patch: Partial<PosOrder>) => {
      ordersPanelRef?.current?.updateOrderLocalState(orderId, patch)
    },
    [ordersPanelRef],
  )

  const refetchOrdersPanel = useCallback(async () => {
    await ordersPanelRef?.current?.refetchOrders?.()
  }, [ordersPanelRef])

  /** После смены бренда в БД подтягиваем список и фиксируем slug в локальном состоянии панели (join `brands` в выборке иногда приходит с задержкой или пустым). */
  const syncBrandSlugOnOrdersPanel = useCallback(
    async (slug: string) => {
      await refetchOrdersPanel()
      updateOrderLocalState(posOrderId, {
        brand_slug: normalizePosBrandSlug(slug.trim()),
        updated_at: new Date().toISOString(),
      })
    },
    [refetchOrdersPanel, updateOrderLocalState, posOrderId],
  )

  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [selectedBrand, setSelectedBrand] = useState<BrandConfig | null>(null)
  const [brandId, setBrandId] = useState<string | null>(null)
  const [categories, setCategories] = useState<MenuCategoryRow[]>([])
  const [activeCategoryId, setActiveCategoryId] = useState<string>("")
  const [menuItems, setMenuItems] = useState<MenuItemRow[]>([])
  const [menuLoading, setMenuLoading] = useState(false)
  const [cart, setCart] = useState<PosCartItem[]>([])
  const lastSyncedCartFingerprintRef = useRef("")
  const categoriesReadyBrandRef = useRef<string | null>(null)
  const menuLoadedKeyRef = useRef<string | null>(null)
  const [modalItem, setModalItem] = useState<MenuItemRow | null>(null)
  const [cartEditIndex, setCartEditIndex] = useState<number | null>(null)
  const cartModalBusyRef = useRef(false)
  const [cartActionBusy, setCartActionBusy] = useState(false)

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

  const [orderPrep, setOrderPrep] = useState<{ loading: boolean; error: string | null }>({
    loading: true,
    error: null,
  })
  const [orderNumber, setOrderNumber] = useState<number | null>(null)
  const [extendSubmitting, setExtendSubmitting] = useState(false)
  const [runnerBusy, setRunnerBusy] = useState(false)
  /** Защита от двойного нажатия «Отправить бегунок» до смены черновика */
  const runnerKitchenLockedRef = useRef(false)
  const runnerAlreadySent = listOrder?.status === "cooking"
  const [clearCartBusy, setClearCartBusy] = useState(false)
  const cartInteractionDisabled =
    cartActionBusy || extendSubmitting || clearCartBusy || runnerBusy
  const [extendError, setExtendError] = useState<string | null>(null)
  const [editBaselineDeliveryFeeBani, setEditBaselineDeliveryFeeBani] =
    useState<number | null>(null)

  const form = useForm<CheckoutFormValues>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      userName: "",
      userPhone: "",
      deliveryMode: "delivery",
      deliveryAddress: "",
      addressEntrance: "",
      addressFloor: "",
      addressApartment: "",
      addressIntercom: "",
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
    if (editBaselineDeliveryFeeBani != null) {
      return editBaselineDeliveryFeeBani
    }
    return 0
  }, [
    deliveryMode,
    zoneResult,
    subtotalBani,
    editBaselineDeliveryFeeBani,
  ])

  const totalBani = subtotalBani - discountBani + deliveryFeeBani

  const detailsSaveTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  )
  const stepRef = useRef(step)
  stepRef.current = step
  const scheduleDebouncedDetailsSaveRef = useRef(() => {})

  const detailsPricingRef = useRef({
    subtotalBani,
    discountBani,
    deliveryFeeBani,
    promoResult: null as import("@/types/database").PromoCode | null,
    promoInput: "",
  })
  detailsPricingRef.current = {
    subtotalBani,
    discountBani,
    deliveryFeeBani,
    promoResult,
    promoInput,
  }

  const clearDetailsDebounce = useCallback(() => {
    if (detailsSaveTimerRef.current !== undefined) {
      clearTimeout(detailsSaveTimerRef.current)
      detailsSaveTimerRef.current = undefined
    }
  }, [])

  useEffect(() => {
    return () => {
      clearDetailsDebounce()
    }
  }, [clearDetailsDebounce])

  useEffect(() => {
    if (step !== 3) clearDetailsDebounce()
  }, [step, clearDetailsDebounce])

  const detailsFormDirty = form.formState.isDirty

  useEffect(() => {
    if (!listOrder || listOrder.id !== posOrderId) return
    if (detailsFormDirty) return
    form.reset(checkoutValuesFromPosListOrder(listOrder))
    const pc = listOrder.promo_code?.trim() ?? ""
    setPromoInput(pc)
    if (!pc) {
      setPromoResult(null)
      setPromoError(null)
    }
  }, [listOrder, posOrderId, detailsFormDirty, form])

  useEffect(() => {
    categoriesReadyBrandRef.current = null
    menuLoadedKeyRef.current = null
  }, [posOrderId])

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
    if (!selectedBrand) {
      setBrandId(null)
      return
    }
    const row = wizardBrands.find((b) => b.slug === selectedBrand.slug)
    if (row?.dbId) {
      setBrandId(row.dbId)
      return
    }
    void resolveBrandId(selectedBrand.slug)
  }, [selectedBrand, wizardBrands, resolveBrandId])

  useEffect(() => {
    if (!selectedBrand) return
    writePosBrandSlugCookie(selectedBrand.slug)
  }, [selectedBrand])

  useEffect(() => {
    let cancelled = false
    lastSyncedCartFingerprintRef.current = ""
    setOrderPrep({ loading: true, error: null })

    void (async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("orders")
        .select(
          "delivery_fee, order_number, user_name, user_phone, delivery_mode, delivery_address, payment_method, change_from, comment, promo_code, address_entrance, address_floor, address_apartment, address_intercom, brands(slug), order_items(id, item_name, menu_item_id, variant_id, size, quantity, price, toppings, menu_items(image_url))",
        )
        .eq("id", posOrderId)
        .maybeSingle()

      if (cancelled) return

      if (error || !data) {
        setOrderPrep({ loading: false, error: "Не удалось загрузить заказ" })
        return
      }

      const raw = data as {
        order_number: number
        user_name: string | null
        user_phone: string | null
        delivery_mode: "delivery" | "pickup"
        delivery_address: string | null
        delivery_fee: number
        payment_method: "cash" | "card"
        change_from: number | null
        comment: string | null
        promo_code: string | null
        address_entrance: string | null
        address_floor: string | null
        address_apartment: string | null
        address_intercom: string | null
        brands: { slug: string } | { slug: string }[] | null
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

      const bEmbed = raw.brands
      const slug = Array.isArray(bEmbed)
        ? bEmbed[0]?.slug
        : bEmbed?.slug

      const lines = raw.order_items ?? []
      const cartLines = lines.map(posCartFromOrderLine)
      const sub = cartLines.reduce((s, c) => s + c.price * c.qty, 0)

      setOrderNumber(raw.order_number)
      setExtendError(null)
      setEditBaselineDeliveryFeeBani(
        Math.max(0, Math.round(raw.delivery_fee ?? 0)),
      )
      setModalItem(null)
      setCartEditIndex(null)

      if (!slug) {
        setSelectedBrand(null)
        setBrandId(null)
        setCart([])
        lastSyncedCartFingerprintRef.current = cartFingerprint([])
        setPromoInput("")
        setPromoResult(null)
        setPromoError(null)
        form.reset({
          userName: raw.user_name?.trim() ?? "",
          userPhone: phoneInputFromStored(raw.user_phone ?? ""),
          deliveryMode: raw.delivery_mode,
          deliveryAddress:
            raw.delivery_mode === "delivery"
              ? (raw.delivery_address?.trim() ?? "")
              : "",
          addressEntrance: raw.address_entrance?.trim() ?? "",
          addressFloor: raw.address_floor?.trim() ?? "",
          addressApartment: raw.address_apartment?.trim() ?? "",
          addressIntercom: raw.address_intercom?.trim() ?? "",
          paymentMethod: raw.payment_method,
          changeFromLei:
            raw.change_from != null && raw.change_from > 0
              ? String(raw.change_from / 100)
              : "",
          comment: raw.comment ?? "",
        })
        if (!cancelled) {
          setOrderPrep({ loading: false, error: null })
          setStep(1)
        }
        return
      }

      const cfg = wizardBrands.find(
        (x) => normalizePosBrandSlug(slug ?? "") === x.slug,
      )
      if (!cfg) {
        setOrderPrep({ loading: false, error: "Неизвестный бренд" })
        return
      }

      setSelectedBrand(cfg)

      setCart(cartLines)
      lastSyncedCartFingerprintRef.current = cartFingerprint(cartLines)
      setPromoInput(raw.promo_code?.trim() ?? "")
      setPromoError(null)
      if (raw.promo_code?.trim() && sub > 0) {
        const res = await validatePromoCode(raw.promo_code.trim(), sub)
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
        userName: raw.user_name?.trim() ?? "",
        userPhone: phoneInputFromStored(raw.user_phone ?? ""),
        deliveryMode: raw.delivery_mode,
        deliveryAddress:
          raw.delivery_mode === "delivery"
            ? (raw.delivery_address?.trim() ?? "")
            : "",
        addressEntrance: raw.address_entrance?.trim() ?? "",
        addressFloor: raw.address_floor?.trim() ?? "",
        addressApartment: raw.address_apartment?.trim() ?? "",
        addressIntercom: raw.address_intercom?.trim() ?? "",
        paymentMethod: raw.payment_method,
        changeFromLei:
          raw.change_from != null && raw.change_from > 0
            ? String(raw.change_from / 100)
            : "",
        comment: raw.comment ?? "",
      })

      if (!cancelled) {
        setOrderPrep({ loading: false, error: null })
        setStep(2)
      }
    })()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- prefetch только при смене заказа; в deps `{form}` давал повторную загрузку и сброс модалки
  }, [posOrderId])

  const loadCategories = useCallback(async (bid: string): Promise<boolean> => {
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
      return false
    }
    const rows = (data ?? []) as MenuCategoryRow[]
    setCategories(rows)
    setActiveCategoryId((prev) => {
      if (!rows.length) return ""
      if (prev && rows.some((c) => c.id === prev)) return prev
      return rows[0]!.id
    })
    return true
  }, [])

  useEffect(() => {
    if (step !== 2 || !brandId) return
    if (categoriesReadyBrandRef.current === brandId) return
    void (async () => {
      const ok = await loadCategories(brandId)
      if (ok) categoriesReadyBrandRef.current = brandId
    })()
  }, [step, brandId, loadCategories])

  const loadMenuItems = useCallback(async (): Promise<boolean> => {
    if (!brandId || !activeCategoryId) return false
    setMenuLoading(true)
    const supabase = createClient()
    const { data, error } = await supabase
      .from("menu_items")
      .select(POS_MENU_ITEM_FOR_MODAL_SELECT)
      .eq("brand_id", brandId)
      .eq("category_id", activeCategoryId)
      .eq("is_active", true)
      .order("sort_order", { ascending: true })

    setMenuLoading(false)
    if (error) {
      console.error("[order-form] menu_items", error.message)
      setMenuItems([])
      return false
    }
    setMenuItems((data ?? []) as MenuItemRow[])
    return true
  }, [brandId, activeCategoryId])

  useEffect(() => {
    if (step !== 2 || !brandId || !activeCategoryId) return
    const key = `${brandId}:${activeCategoryId}`
    if (menuLoadedKeyRef.current === key) return
    void (async () => {
      const ok = await loadMenuItems()
      if (ok) menuLoadedKeyRef.current = key
    })()
  }, [step, brandId, activeCategoryId, loadMenuItems])

  const refreshCartFromDb = useCallback(async () => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("orders")
      .select(
        "order_items(id, item_name, menu_item_id, variant_id, size, quantity, price, toppings, menu_items(image_url))",
      )
      .eq("id", posOrderId)
      .maybeSingle()

    if (error || !data) {
      console.error("[order-form] refreshCartFromDb", error?.message ?? "empty")
      return
    }
    const rows =
      (
        data as {
          order_items: Array<{
            id: string
            item_name: string
            menu_item_id: string | null
            variant_id: string | null
            size: string | null
            quantity: number
            price: number
            toppings: unknown
            menu_items:
              | { image_url: string | null }
              | { image_url: string | null }[]
              | null
          }>
        }
      ).order_items ?? []
    const lines = rows.map(posCartFromOrderLine)
    lastSyncedCartFingerprintRef.current = cartFingerprint(lines)
    setCart(lines)
  }, [posOrderId])

  const handleClearCart = useCallback(async () => {
    if (cart.length === 0) {
      toast.message("Корзина уже пуста")
      return
    }
    setClearCartBusy(true)
    try {
      const res = await replaceOrderItemsPos({
        orderId: posOrderId,
        lines: [],
      })
      if (!res.success) {
        toast.error(res.error ?? "Не удалось очистить корзину")
        return
      }
      setModalItem(null)
      setCartEditIndex(null)
      await refreshCartFromDb()
      await refetchOrdersPanel()
    } finally {
      setClearCartBusy(false)
    }
  }, [cart.length, posOrderId, refreshCartFromDb, refetchOrdersPanel])

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
    async (entry: PosCartItem) => {
      if (entry.price <= 0 || entry.qty < 1) return
      if (cartInteractionDisabled) return
      const idx = cart.findIndex(
        (x) =>
          x.menuItemId === entry.menuItemId &&
          (x.variantId ?? null) === (entry.variantId ?? null) &&
          (x.size ?? "") === (entry.size ?? "") &&
          toppingsSignature(x.toppings) === toppingsSignature(entry.toppings),
      )
      setCartActionBusy(true)
      try {
        if (idx >= 0) {
          const existing = cart[idx]!
          if (existing.orderItemId) {
            const res = await updateOrderItemQuantityPos({
              orderId: posOrderId,
              itemId: existing.orderItemId,
              quantity: existing.qty + entry.qty,
            })
            if (!res.success) {
              toast.error("Не удалось обновить количество")
              return
            }
          } else {
            toast.error("Некорректное состояние корзины")
            return
          }
        } else {
          const res = await addOrderItemsPos({
            orderId: posOrderId,
            lines: [posLinePayloadFromCartItem(entry)],
          })
          if (!res.success) {
            toast.error("Не удалось добавить позицию")
            return
          }
        }
        await refreshCartFromDb()
        await refetchOrdersPanel()
      } finally {
        setCartActionBusy(false)
      }
    },
    [
      cart,
      cartInteractionDisabled,
      posOrderId,
      refreshCartFromDb,
      toppingsSignature,
      refetchOrdersPanel,
    ],
  )

  const handleProductClick = useCallback(
    (row: MenuItemRow) => {
      if (cartInteractionDisabled) return
      setCartEditIndex(null)
      const hasToppingGroups = (row.menu_item_topping_groups?.length ?? 0) > 0
      if (!row.has_sizes && !hasToppingGroups) {
        const price = unitPriceBani(row)
        if (price <= 0) return
        void addCartItem({
          menuItemId: row.id,
          name: row.name_ru,
          size: null,
          variantId: null,
          price,
          qty: 1,
          imageUrl: row.image_url ?? undefined,
          toppings: [],
        })
        return
      }
      setModalItem(posMenuRowForModal(row))
    },
    [addCartItem, cartInteractionDisabled],
  )

  const updateQty = useCallback(
    async (idx: number, delta: number) => {
      if (cartInteractionDisabled) return
      const row = cart[idx]
      if (!row?.orderItemId) return
      const q = row.qty + delta
      setCartActionBusy(true)
      try {
        if (q < 1) {
          const res = await removeOrderItemPos({
            orderId: posOrderId,
            itemId: row.orderItemId,
          })
          if (!res.success) {
            toast.error("Не удалось удалить позицию")
            return
          }
        } else {
          const res = await updateOrderItemQuantityPos({
            orderId: posOrderId,
            itemId: row.orderItemId,
            quantity: q,
          })
          if (!res.success) {
            toast.error("Не удалось обновить количество")
            return
          }
        }
        await refreshCartFromDb()
        await refetchOrdersPanel()
      } finally {
        setCartActionBusy(false)
      }
    },
    [
      cart,
      cartInteractionDisabled,
      posOrderId,
      refreshCartFromDb,
      refetchOrdersPanel,
    ],
  )

  const removeLine = useCallback(
    async (idx: number) => {
      if (cartInteractionDisabled) return
      const row = cart[idx]
      if (!row) return
      if (!row.orderItemId) {
        setCart((prev) => prev.filter((_, i) => i !== idx))
        return
      }
      setCartActionBusy(true)
      try {
        const res = await removeOrderItemPos({
          orderId: posOrderId,
          itemId: row.orderItemId,
        })
        if (!res.success) {
          toast.error("Не удалось удалить позицию")
          return
        }
        await refreshCartFromDb()
        await refetchOrdersPanel()
      } finally {
        setCartActionBusy(false)
      }
    },
    [cart, cartInteractionDisabled, posOrderId, refreshCartFromDb, refetchOrdersPanel],
  )

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
        .select(POS_MENU_ITEM_FOR_MODAL_SELECT)
        .eq("id", line.menuItemId)
        .maybeSingle()

      if (error || !data) {
        console.error("[order-form] cart line modal", error?.message ?? "empty")
        return
      }
      setCartEditIndex(idx)
      setModalItem(posMenuRowForModal(data as MenuItemRow))
    } finally {
      cartModalBusyRef.current = false
    }
  }, [cart])

  const saveCartLineFromModal = useCallback(
    async (cartIndex: number, c: PosCartItem) => {
      if (cartInteractionDisabled) {
        throw new Error("Повторите попытку")
      }
      const prevLine = cart[cartIndex]
      if (!prevLine?.orderItemId) {
        throw new Error("Некорректное состояние корзины")
      }
      setCartActionBusy(true)
      try {
        const linePayload = posLinePayloadFromCartItem(c)
        const res = await updateOrderItemCompositionPos({
          orderId: posOrderId,
          itemId: prevLine.orderItemId,
          menuItemId: c.menuItemId,
          itemName: linePayload.name,
          size: c.size,
          variantId: linePayload.variantId ?? null,
          quantity: c.qty,
          unitPriceBani: c.price,
          toppings: c.toppings.map((t) => ({
            name: t.name,
            price: Math.round(t.price),
          })),
        })
        if (!res.success) {
          throw new Error(res.error ?? "Не удалось сохранить позицию")
        }
        await refreshCartFromDb()
        await refetchOrdersPanel()
      } finally {
        setCartActionBusy(false)
      }
    },
    [
      cart,
      cartInteractionDisabled,
      posOrderId,
      refreshCartFromDb,
      refetchOrdersPanel,
    ],
  )

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
    window.setTimeout(() => {
      scheduleDebouncedDetailsSaveRef.current()
    }, 0)
  }

  const [closeOrderOpen, setCloseOrderOpen] = useState(false)
  const [closeOrderPreset, setCloseOrderPreset] = useState<string>("")
  const [closeOrderOther, setCloseOrderOther] = useState("")
  const [closeOrderSaving, setCloseOrderSaving] = useState(false)
  const [cancelOrderFeedback, setCancelOrderFeedback] = useState<string | null>(
    null,
  )
  const [orderMenuOpen, setOrderMenuOpen] = useState(false)

  const persistBrandOrError = async (): Promise<boolean> => {
    if (!selectedBrand) {
      setExtendError("Выберите бренд")
      return false
    }
    const res = await updateOrderBrandPos({
      orderId: posOrderId,
      brandSlug: selectedBrand.slug,
    })
    if (!res.success) {
      setExtendError(res.error)
      return false
    }
    setExtendError(null)
    await syncBrandSlugOnOrdersPanel(selectedBrand.slug)
    return true
  }

  const persistCartToServer = async (): Promise<boolean> => {
    if (!brandId || !selectedBrand) {
      setExtendError("Сначала выберите бренд")
      return false
    }
    setExtendError(null)
    setExtendSubmitting(true)
    try {
      const linesPayload = cart.map((c) => ({
        menuItemId: c.menuItemId,
        name:
          c.toppings.length > 0
            ? `${c.name} + ${c.toppings.map((t) => t.name).join(", ")}`
            : c.name,
        size: c.size,
        variantId: c.variantId ?? null,
        unitPriceBani: c.price,
        qty: c.qty,
        toppings: c.toppings.map((t) => ({
          name: t.name,
          price: Math.round(t.price),
        })),
      }))
      const res = await replaceOrderItemsPos({
        orderId: posOrderId,
        lines: linesPayload,
      })
      if (!res.success) {
        setExtendError(res.error)
        return false
      }
      await refreshCartFromDb()
      await refetchOrdersPanel()
      return true
    } finally {
      setExtendSubmitting(false)
    }
  }

  const buildPhoneForSave = (raw: string) => {
    const d = raw.replace(/\s+/g, "")
    return d.startsWith("+") ? d : `+373${d}`
  }

  function detailsArePersistable(values: CheckoutFormValues): boolean {
    if (!values.userName.trim() || !values.userPhone.trim()) return false
    if (
      values.deliveryMode === "delivery" &&
      !values.deliveryAddress?.trim()
    ) {
      return false
    }
    return true
  }

  const runDetailsSaveToServer = useCallback(
    async (
      valuesOverride?: CheckoutFormValues,
      opts?: { forSubmit?: boolean },
    ): Promise<boolean> => {
      if (!selectedBrand) {
        if (opts?.forSubmit) setSubmitError("Выберите бренд на шаге 1")
        return false
      }
      const values = valuesOverride ?? form.getValues()
      if (!detailsArePersistable(values)) {
        return false
      }
      const {
        subtotalBani: sub,
        discountBani: disc,
        deliveryFeeBani: fee,
        promoResult: pr,
        promoInput: pi,
      } = detailsPricingRef.current

      const changeBani =
        values.paymentMethod === "cash"
          ? parseLeiToBani(values.changeFromLei ?? "")
          : null

      const res = await updateOrderDetailsPos({
        orderId: posOrderId,
        userName: values.userName,
        userPhone: buildPhoneForSave(values.userPhone),
        deliveryMode: values.deliveryMode,
        deliveryAddress:
          values.deliveryMode === "delivery"
            ? values.deliveryAddress
            : undefined,
        addressEntrance: values.addressEntrance?.trim() || null,
        addressFloor: values.addressFloor?.trim() || null,
        addressApartment: values.addressApartment?.trim() || null,
        addressIntercom: values.addressIntercom?.trim() || null,
        paymentMethod: values.paymentMethod,
        changeFrom: changeBani ?? undefined,
        comment: values.comment?.trim() || undefined,
        promoCode: pr ? pi.trim().toUpperCase() : undefined,
        discount: disc > 0 ? disc : 0,
        deliveryFee: fee,
      })
      if (!res.success) {
        if (opts?.forSubmit) setSubmitError(res.error)
        else toast.error("Не удалось сохранить данные")
        return false
      }
      const safeDiscount = Math.min(disc, sub)
      const cardTotal = sub - safeDiscount + fee
      updateOrderLocalState(posOrderId, {
        total: cardTotal,
        delivery_fee: fee,
        discount: safeDiscount,
        updated_at: new Date().toISOString(),
      })
      if (opts?.forSubmit) setSubmitError(null)
      return true
    },
    [selectedBrand, form, posOrderId, updateOrderLocalState],
  )

  const scheduleDebouncedDetailsSave = useCallback(() => {
    clearDetailsDebounce()
    detailsSaveTimerRef.current = setTimeout(() => {
      detailsSaveTimerRef.current = undefined
      if (stepRef.current !== 3) return
      void runDetailsSaveToServer()
    }, 600)
  }, [clearDetailsDebounce, runDetailsSaveToServer])

  scheduleDebouncedDetailsSaveRef.current = scheduleDebouncedDetailsSave

  const patchDetailsCardAndScheduleSave = useCallback(
    (patch: Partial<PosOrder>) => {
      updateOrderLocalState(posOrderId, {
        ...patch,
        updated_at: new Date().toISOString(),
      })
      scheduleDebouncedDetailsSave()
    },
    [posOrderId, updateOrderLocalState, scheduleDebouncedDetailsSave],
  )

  const navigateToStep = (target: 1 | 2 | 3) => {
    if (target === step) return
    const from = step
    if (from === 2) {
      void (async () => {
        if (
          (target === 3 || target === 1) &&
          cartFingerprint(cart) === lastSyncedCartFingerprintRef.current
        ) {
          setStep(target)
          return
        }
        const ok = await persistCartToServer()
        if (!ok) return
        setStep(target)
      })()
      return
    }
    setStep(target)
    if (from === 1) void persistBrandOrError()
  }

  const confirmCancelOrder = async () => {
    if (!closeOrderPreset) return
    if (closeOrderPreset === "__other__" && !closeOrderOther.trim()) return
    const reason =
      closeOrderPreset === "__other__"
        ? closeOrderOther.trim()
        : closeOrderPreset

    setCancelOrderFeedback(null)
    setCloseOrderSaving(true)
    try {
      const res = await cancelOrderPos({ orderId: posOrderId, reason })
      if (!res.success) {
        setCancelOrderFeedback(res.error ?? "Не удалось закрыть заказ")
        return
      }
      setCloseOrderOpen(false)
      onClose()
    } finally {
      setCloseOrderSaving(false)
    }
  }

  const closeOrderReasonPresets = [
    "Ошибка оператора",
    "Клиент не пришел",
    "Клиент передумал",
  ] as const

  const closeOrderDialog = (
    <Dialog
      open={closeOrderOpen}
      onOpenChange={(o) => {
        setCloseOrderOpen(o)
        if (!o) {
          setCloseOrderPreset("")
          setCloseOrderOther("")
          setCancelOrderFeedback(null)
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Закрыть заказ?</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <Select
            value={closeOrderPreset || undefined}
            onValueChange={setCloseOrderPreset}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Выберите причину" />
            </SelectTrigger>
            <SelectContent>
              {closeOrderReasonPresets.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
              <SelectItem value="__other__">Другое</SelectItem>
            </SelectContent>
          </Select>
          {closeOrderPreset === "__other__" ? (
            <Input
              placeholder="Укажите причину"
              value={closeOrderOther}
              onChange={(e) => setCloseOrderOther(e.target.value)}
              className="w-full"
            />
          ) : null}
          {cancelOrderFeedback ? (
            <p className="text-destructive text-sm">{cancelOrderFeedback}</p>
          ) : null}
        </div>
        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setCloseOrderOpen(false)}
          >
            Отмена
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={
              closeOrderSaving ||
              !closeOrderPreset ||
              (closeOrderPreset === "__other__" &&
                closeOrderOther.trim().length === 0)
            }
            onClick={() => void confirmCancelOrder()}
          >
            {closeOrderSaving ? "Закрытие…" : "Подтвердить"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )

  const handleRunnerFromStep2 = async () => {
    if (runnerAlreadySent) return
    if (runnerKitchenLockedRef.current) return
    if (cart.length === 0) {
      toast.error("Добавьте позиции в заказ")
      return
    }
    if (!selectedBrand) {
      setExtendError("Выберите бренд")
      toast.error("Выберите бренд")
      return
    }

    runnerKitchenLockedRef.current = true
    setRunnerBusy(true)
    setExtendError(null)

    try {
      const brandOk = await persistBrandOrError()
      if (!brandOk) return

      const cartOk = await persistCartToServer()
      if (!cartOk) return

      const res = await sendPosDraftToKitchen({ orderId: posOrderId })
      if (!res.success) {
        toast.error(res.error)
        return
      }
      await refetchOrdersPanel()
      toast.success(`Заказ №${res.orderNumber} отправлен на кухню`)
    } finally {
      setRunnerBusy(false)
      runnerKitchenLockedRef.current = false
    }
  }

  const submitCheckout = async (values: CheckoutFormValues) => {
    setSubmitError(null)

    if (runnerAlreadySent) return
    if (runnerKitchenLockedRef.current) return

    if (cart.length === 0) {
      setSubmitError("Добавьте позиции в заказ")
      return
    }
    if (!selectedBrand) {
      setSubmitError("Выберите бренд на шаге 1")
      return
    }
    if (!detailsArePersistable(values)) {
      setSubmitError("Заполните имя, телефон и адрес при доставке")
      return
    }

    runnerKitchenLockedRef.current = true
    setSubmitting(true)

    try {
      const cartOk = await persistCartToServer()
      if (!cartOk) {
        setSubmitError("Не удалось сохранить позиции заказа")
        return
      }

      const detailsSaved = await runDetailsSaveToServer(values, {
        forSubmit: true,
      })
      if (!detailsSaved) {
        return
      }

      const res = await sendPosDraftToKitchen({ orderId: posOrderId })

      if (!res.success) {
        setSubmitError(res.error)
        return
      }

      await refetchOrdersPanel()
      toast.success(`Заказ №${res.orderNumber} отправлен на кухню`)
    } finally {
      setRunnerBusy(false)
      setSubmitting(false)
      runnerKitchenLockedRef.current = false
    }
  }

  const onSubmit = form.handleSubmit(submitCheckout)

  /* Индикатор шагов — кнопки без разделителей */
  const stepIndicator = (
    <nav
      className="flex max-w-full min-w-0 shrink-0 items-center gap-2 overflow-x-auto text-xs whitespace-nowrap [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      role="navigation"
      aria-label="Шаги оформления заказа"
    >
      {([1, 2, 3] as const).map((n) => (
        <button
          key={n}
          type="button"
          disabled={
            orderPrep.loading ||
            (step === 2 && n === 3 && cartInteractionDisabled) ||
            runnerBusy
          }
          onClick={() => navigateToStep(n)}
          className={cn(
            "rounded-lg border-0 bg-white px-3 py-2 shadow-none ring-0 transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#242424]/20",
            step === n
              ? "font-bold text-[#242424]"
              : "font-normal text-[#808080] hover:text-[#242424]",
            "disabled:pointer-events-none disabled:opacity-50",
          )}
        >
          {n === 1 ? "1. Бренд" : null}
          {n === 2 ? "2. Оформление" : null}
          {n === 3 ? "3. Детали" : null}
        </button>
      ))}
    </nav>
  )

  const wizardHeaderMenu = (
    <Popover open={orderMenuOpen} onOpenChange={setOrderMenuOpen}>
      <PopoverTrigger asChild>
        <PosHeaderIconButton
          type="button"
          aria-label="Действия с заказом"
          disabled={clearCartBusy || extendSubmitting || submitting || runnerBusy}
        >
          <MoreVertical className="size-4" strokeWidth={2} />
        </PosHeaderIconButton>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={6}
        className="w-[min(100vw-2rem,15rem)] gap-0.5 rounded-xl border border-[#e8e8e8] bg-white p-1 shadow-md"
      >
        <button
          type="button"
          disabled={
            clearCartBusy ||
            extendSubmitting ||
            runnerBusy ||
            cart.length === 0
          }
          onClick={() => {
            setOrderMenuOpen(false)
            void handleClearCart()
          }}
          className={cn(
            "flex w-full items-center rounded-lg px-3 py-2.5 text-left text-[13px] font-medium text-[#242424]",
            "hover:bg-[#f2f2f2] disabled:cursor-not-allowed disabled:opacity-40",
          )}
        >
          Очистить корзину
        </button>
        <button
          type="button"
          onClick={() => {
            setOrderMenuOpen(false)
            setCancelOrderFeedback(null)
            setCloseOrderOpen(true)
          }}
          className={cn(
            "flex w-full items-center rounded-lg px-3 py-2.5 text-left text-[13px] font-medium text-red-600",
            "hover:bg-red-50",
          )}
        >
          Закрыть заказ
        </button>
      </PopoverContent>
    </Popover>
  )

  if (orderPrep.loading) {
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

  const prefetchError = orderPrep.error

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
  if (step === 1) {
    return (
      <>
        <div className="flex h-full min-h-0 flex-col overflow-hidden">
          <FormHeader
            leftSlot={
              <h2 className="min-w-0 truncate text-sm font-bold text-foreground">
                Для какого бренда заказ?
              </h2>
            }
            stepIndicator={stepIndicator}
            headerMenu={wizardHeaderMenu}
            onClose={onClose}
          />
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 pb-4 pt-3">
            {extendError ? (
              <p className="text-destructive bg-destructive/5 rounded-lg px-3 py-2 text-center text-sm">
                {extendError}
              </p>
            ) : null}
            {wizardBrands.map((b) => (
              <button
                key={b.slug}
                type="button"
                className={cn(
                  "flex min-h-[min(28vh,180px)] flex-1 cursor-pointer flex-col items-center justify-center gap-4 rounded-xl border-2 bg-white px-6 py-8 shadow-sm transition-all",
                  "hover:bg-muted/30 hover:brightness-[0.99] active:scale-[0.99]",
                )}
                style={{ borderColor: b.colors.accent }}
                onClick={() => {
                  void (async () => {
                    setExtendError(null)
                    setCart([])
                    setModalItem(null)
                    setCartEditIndex(null)
                    setPromoInput("")
                    setPromoResult(null)
                    setPromoError(null)
                    const res = await updateOrderBrandPos({
                      orderId: posOrderId,
                      brandSlug: b.slug,
                    })
                    if (!res.success) {
                      setExtendError(res.error)
                      return
                    }
                    await syncBrandSlugOnOrdersPanel(b.slug)
                    setSelectedBrand(b)
                    setStep(2)
                  })()
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
        {closeOrderDialog}
      </>
    )
  }

  /* ── Шаг 2: выбор меню ── */
  if (step === 2 && selectedBrand) {
    return (
      <>
        <div className="flex h-full min-h-0 flex-col overflow-hidden">
          <FormHeader
            leftSlot={
              <>
                <PosHeaderIconButton
                  aria-label="Назад"
                  onClick={() => navigateToStep(1)}
                  disabled={extendSubmitting || runnerBusy}
                >
                  <ArrowLeft className="size-4" />
                </PosHeaderIconButton>
                {orderNumber != null ? (
                  <span className="min-w-0 truncate text-sm font-bold text-foreground">
                    {`Заказ #${orderNumber}`}
                  </span>
                ) : (
                  <PosBrandMark brandSlug={selectedBrand.slug} size="md" />
                )}
              </>
            }
            stepIndicator={stepIndicator}
            headerMenu={wizardHeaderMenu}
            onClose={onClose}
          />

          <div className="flex min-h-0 min-w-0 flex-1 gap-3 overflow-hidden">
            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-3 pr-0">
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl bg-white">
                <Tabs
                  value={activeCategoryId}
                  onValueChange={setActiveCategoryId}
                  className="flex min-h-0 flex-1 flex-col overflow-hidden"
                >
                  <p className="text-muted-foreground shrink-0 px-4 pt-4 pb-3 text-center text-[11px] font-normal uppercase tracking-[0.08em]">
                    Оформление заказа
                  </p>

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

                  {categories.length === 0 ? (
                    <p className="text-muted-foreground p-4 text-center text-sm">
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
                          <p className="text-muted-foreground py-8 text-center text-sm">
                            Загрузка меню…
                          </p>
                        ) : menuItems.length === 0 ? (
                          <p className="text-muted-foreground py-8 text-center text-sm">
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

            <CartPanel
              cart={cart}
              cartCount={cartCount}
              subtotalBani={subtotalBani}
              onUpdateQty={updateQty}
              onRemove={removeLine}
              onOpenLine={(idx) => void openCartLineModal(idx)}
              errorBanner={extendError}
              cartInteractionDisabled={cartInteractionDisabled}
              onRunnerSend={handleRunnerFromStep2}
              runnerDisabled={
                runnerAlreadySent ||
                cart.length === 0 ||
                extendSubmitting ||
                !selectedBrand
              }
              runnerBusy={runnerBusy}
              runnerAlreadySent={runnerAlreadySent}
            />
          </div>
        </div>

        <PosProductModal
          item={modalItem}
          onClose={closeProductModal}
          onAdd={(c) => void addCartItem(c)}
          cartEditDraft={
            cartEditIndex !== null &&
            modalItem &&
            cart[cartEditIndex] &&
            cart[cartEditIndex]!.menuItemId === modalItem.id
              ? {
                  cartIndex: cartEditIndex,
                  qty: cart[cartEditIndex]!.qty,
                  size: cart[cartEditIndex]!.size,
                  variantId: cart[cartEditIndex]!.variantId ?? null,
                  toppings: cart[cartEditIndex]!.toppings.map((t) => ({
                    name: t.name,
                    price: t.price,
                  })),
                }
              : null
          }
          onCartEditSave={saveCartLineFromModal}
        />
        {closeOrderDialog}
      </>
    )
  }

  /* ── Шаг 3: оформление ── */
  return (
    <>
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        {/* Навигационная шапка */}
        <FormHeader
          leftSlot={
            <>
              <PosHeaderIconButton
                aria-label="Назад"
                onClick={() => navigateToStep(2)}
                disabled={submitting}
              >
                <ArrowLeft className="size-4" />
              </PosHeaderIconButton>
              <span className="min-w-0 truncate text-sm font-bold text-foreground">
                {orderNumber != null
                  ? `Заказ #${orderNumber} · Детали`
                  : "Детали"}
              </span>
            </>
          }
          stepIndicator={stepIndicator}
          headerMenu={wizardHeaderMenu}
          onClose={onClose}
        />

        {/* Контент: форма + сводка */}
        <div className="flex min-h-0 min-w-0 flex-1 gap-3 overflow-hidden">

        {/* ── ЦЕНТР: форма — белая карточка в сером острове ── */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-3 pr-0">
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl bg-white">
            <p className="text-muted-foreground shrink-0 px-4 pt-4 pb-3 text-center text-[11px] font-normal uppercase tracking-[0.08em]">
              Детали заказа
            </p>
            <Form {...form}>
              <form
                id="pos-wizard-details-form"
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
                          onClick={() => {
                            field.onChange("delivery")
                            updateOrderLocalState(posOrderId, {
                              delivery_mode: "delivery",
                              updated_at: new Date().toISOString(),
                            })
                            clearDetailsDebounce()
                            window.setTimeout(() => {
                              void runDetailsSaveToServer()
                            }, 0)
                          }}
                          icon={<Truck className="size-4 shrink-0" />}
                          label="Доставка"
                        />
                        <ModeButton
                          active={field.value === "pickup"}
                          onClick={() => {
                            field.onChange("pickup")
                            updateOrderLocalState(posOrderId, {
                              delivery_mode: "pickup",
                              updated_at: new Date().toISOString(),
                            })
                            clearDetailsDebounce()
                            window.setTimeout(() => {
                              void runDetailsSaveToServer()
                            }, 0)
                          }}
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
                            <Input
                              {...field}
                              autoComplete="name"
                              onChange={(e) => {
                                field.onChange(e)
                                const v = e.target.value
                                patchDetailsCardAndScheduleSave({
                                  user_name: v.trim() ? v : null,
                                })
                              }}
                            />
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
                                onChange={(e) => {
                                  field.onChange(e)
                                  patchDetailsCardAndScheduleSave({
                                    user_phone: buildPhoneForSave(
                                      e.target.value,
                                    ),
                                  })
                                }}
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {deliveryMode === "delivery" ? (
                    <>
                      <FormField
                        control={form.control}
                        name="deliveryAddress"
                        render={({ field }) => (
                          <FormItem className="mt-3">
                            <FormLabel className="text-xs text-muted-foreground">
                              Улица и дом
                            </FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                placeholder="Улица, дом"
                                onChange={(e) => {
                                  field.onChange(e)
                                  patchDetailsCardAndScheduleSave({
                                    delivery_address:
                                      e.target.value.trim() || null,
                                  })
                                }}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="mt-3 grid grid-cols-2 gap-3">
                        <FormField
                          control={form.control}
                          name="addressEntrance"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs text-muted-foreground">
                                Подъезд
                              </FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  placeholder=""
                                  onChange={(e) => {
                                    field.onChange(e)
                                    patchDetailsCardAndScheduleSave({
                                      address_entrance:
                                        e.target.value.trim() || null,
                                    })
                                  }}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="addressFloor"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs text-muted-foreground">
                                Этаж
                              </FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  placeholder=""
                                  onChange={(e) => {
                                    field.onChange(e)
                                    patchDetailsCardAndScheduleSave({
                                      address_floor:
                                        e.target.value.trim() || null,
                                    })
                                  }}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="addressApartment"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs text-muted-foreground">
                                Квартира
                              </FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  placeholder=""
                                  onChange={(e) => {
                                    field.onChange(e)
                                    patchDetailsCardAndScheduleSave({
                                      address_apartment:
                                        e.target.value.trim() || null,
                                    })
                                  }}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="addressIntercom"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs text-muted-foreground">
                                Домофон
                              </FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  placeholder=""
                                  onChange={(e) => {
                                    field.onChange(e)
                                    patchDetailsCardAndScheduleSave({
                                      address_intercom:
                                        e.target.value.trim() || null,
                                    })
                                  }}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <DeliveryZoneInfo
                        result={zoneResult}
                        checking={zoneChecking}
                        subtotalBani={subtotalBani}
                      />
                    </>
                  ) : null}

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
                          onClick={() => {
                            field.onChange("cash")
                            clearDetailsDebounce()
                            window.setTimeout(() => {
                              void runDetailsSaveToServer()
                            }, 0)
                          }}
                          icon={<Banknote className="size-4 shrink-0" />}
                          label="Наличными"
                        />
                        <ModeButton
                          active={field.value === "card"}
                          onClick={() => {
                            field.onChange("card")
                            clearDetailsDebounce()
                            window.setTimeout(() => {
                              void runDetailsSaveToServer()
                            }, 0)
                          }}
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
              </form>
            </Form>
          </div>
        </div>

        {/* ── ПРАВАЯ ПАНЕЛЬ: сводка заказа — белая карточка в сером острове ── */}
        <div className="flex h-full min-h-0 w-[300px] shrink-0 flex-col overflow-hidden p-3 pl-0">
          <aside className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl bg-white">
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
                    key={
                      line.orderItemId ??
                      `${line.menuItemId}-${line.variantId ?? ""}-${line.size ?? "x"}-${idx}`
                    }
                    line={line}
                    idx={idx}
                    onUpdateQty={updateQty}
                    onRemove={removeLine}
                    onOpenLine={(i) => void openCartLineModal(i)}
                    cartInteractionDisabled={cartInteractionDisabled}
                  />
                ))}
              </div>
            </div>

            <div className="shrink-0 border-t border-border p-5">
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
              <button
                type="submit"
                form="pos-wizard-details-form"
                disabled={runnerAlreadySent || submitting}
                className={cn("mt-3", POS_RUNNER_CTA_CLASS)}
              >
                {runnerAlreadySent ? (
                  "Бегунок отправлен"
                ) : submitting ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="size-4 shrink-0 animate-spin" />
                    Отправка…
                  </span>
                ) : (
                  "Отправить бегунок"
                )}
              </button>
            </div>
          </aside>
        </div>
      </div>
    </div>

      <PosProductModal
        item={modalItem}
        onClose={closeProductModal}
        onAdd={(c) => void addCartItem(c)}
        cartEditDraft={
          cartEditIndex !== null &&
          modalItem &&
          cart[cartEditIndex] &&
          cart[cartEditIndex]!.menuItemId === modalItem.id
            ? {
                cartIndex: cartEditIndex,
                qty: cart[cartEditIndex]!.qty,
                size: cart[cartEditIndex]!.size,
                variantId: cart[cartEditIndex]!.variantId ?? null,
                toppings: cart[cartEditIndex]!.toppings.map((t) => ({
                  name: t.name,
                  price: t.price,
                })),
              }
            : null
        }
        onCartEditSave={saveCartLineFromModal}
      />
      {closeOrderDialog}
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
