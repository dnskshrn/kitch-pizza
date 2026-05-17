"use client"

import { normalizePosBrandSlug, type BrandConfig } from "@/brands/index"
import { DiscountBreakdown } from "@/components/pos/discount-breakdown"
import type { OrdersPanelHandle } from "@/components/pos/orders-panel"
import { AssignCourierModal } from "@/components/pos/AssignCourierModal"
import { PayOrderModal } from "@/components/pos/pay-order-modal"
import { PromoPanel } from "@/components/pos/promo-panel"
import { useCashSession } from "@/components/pos/cash-session-context"
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
import { Checkbox } from "@/components/ui/checkbox"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { checkDeliveryZoneByAddress } from "@/lib/actions/pos/check-delivery-zone-pos"
import type { DeliveryZoneCheckResultPos } from "@/lib/actions/pos/check-delivery-zone-pos"
import { cancelOrderPos } from "@/lib/actions/pos/cancel-order-pos"
import { sendPosDraftToKitchen } from "@/lib/actions/pos/send-pos-draft-to-kitchen"
import {
  updateOrderDeliveryModePos,
  updateOrderDetailsPos,
} from "@/lib/actions/pos/update-order-details-pos"
import { updateOrderBrandPos } from "@/lib/actions/pos/update-order-brand-pos"
import {
  addOrderItemsPos,
  removeOrderItemPos,
  replaceOrderItemsPos,
  updateOrderItemCompositionPos,
  updateOrderItemQuantityPos,
} from "@/lib/actions/pos/update-order-items"
import {
  posLookupCustomer,
  posSaveCustomer,
  posSaveCustomerAddress,
} from "@/lib/actions/pos/customers-pos-actions"
import { evaluateDiscounts } from "@/lib/discount-engine"
import type { CustomerAddressRow, CustomerWithAddresses } from "@/lib/customers"
import { usePosMenuCache } from "@/lib/store/pos-menu-cache"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import { orderItemSizeDisplayLabel } from "@/lib/order-item-size-display"
import {
  POS_MENU_ITEM_FOR_MODAL_SELECT,
  posMenuRowForModal,
  posVariantsFromMenuEmbed,
} from "@/lib/pos/menu-item-modal-row"
import { writePosBrandSlugCookie } from "@/lib/pos/pos-brand-slug-cookie"
import { posCheckoutAddressFieldsFromOrder } from "@/lib/pos/split-composite-delivery-address"
import type { MenuItem, MenuItemVariant } from "@/types/database"
import type {
  CartItemForEngine,
  DeliveryZoneForEngine,
  DiscountEngineOutput,
} from "@/types/promotions"
import type { PosCartItem, PosOrder, PosWizardBrandOption } from "@/types/pos"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  AlertCircle,
  ArrowLeft,
  Banknote,
  Bike,
  CreditCard,
  Layers,
  Loader2,
  MapPin,
  Minus,
  MoreVertical,
  Plus,
  XIcon,
} from "lucide-react"
import Image from "next/image"
import type { RefObject, ReactNode } from "react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

/** Добавляет скидку с витрины, если движок её ещё не учёл полностью. */
function mergePersistedWebsitePromoDiscount(
  base: DiscountEngineOutput,
  persistedCodeRaw: string | null | undefined,
  persistedDiscountBani: number | null | undefined,
  dz: DeliveryZoneForEngine | null,
): DiscountEngineOutput {
  const persistedCode = persistedCodeRaw?.trim() ?? ""
  const persistedD = Math.round(
    typeof persistedDiscountBani === "number" &&
      Number.isFinite(persistedDiscountBani)
      ? persistedDiscountBani
      : 0,
  )
  if (!persistedCode || persistedD <= 0) return base

  const slack = persistedD - base.totalDiscountBani
  if (slack <= 0) return base

  const sub = Math.max(0, Math.round(base.itemSubtotalBani))
  const combinedDisc = Math.min(sub, Math.round(base.totalDiscountBani + slack))
  const discountedSubtotalBaniNew = Math.max(0, sub - combinedDisc)
  const totalDiscountBaniNew = sub - discountedSubtotalBaniNew

  const hasFreeDelivery = base.appliedDiscounts.some(
    (d) => d.effect_type === "free_delivery",
  )

  if (!dz || base.deliveryFeeBani === null) {
    const feeBani = Math.max(0, Math.round(base.deliveryFeeBani ?? 0))
    const extraLine = {
      rule_id: `__website_promo__${persistedCode.toUpperCase()}`,
      effect_type: "order_fixed" as const,
      label_ru: `Промокод ${persistedCode}:`,
      discount_bani: slack,
    }
    return {
      ...base,
      appliedDiscounts: [...base.appliedDiscounts, extraLine],
      discountedSubtotalBani: discountedSubtotalBaniNew,
      totalDiscountBani: totalDiscountBaniNew,
      deliveryFeeBani: base.deliveryFeeBani === null ? feeBani : base.deliveryFeeBani,
      totalBani: discountedSubtotalBaniNew + feeBani,
    }
  }

  let deliveryFeeBaniNew: number | null = base.deliveryFeeBani
  let totalBaniNew = base.totalBani
  if (hasFreeDelivery) {
    deliveryFeeBaniNew = 0
  } else if (discountedSubtotalBaniNew >= dz.free_from_bani) {
    deliveryFeeBaniNew = 0
  } else {
    deliveryFeeBaniNew = dz.price_bani
  }
  totalBaniNew = discountedSubtotalBaniNew + deliveryFeeBaniNew

  const extraLine = {
    rule_id: `__website_promo__${persistedCode.toUpperCase()}`,
    effect_type: "order_fixed" as const,
    label_ru: `Промокод ${persistedCode}:`,
    discount_bani: slack,
  }

  return {
    ...base,
    appliedDiscounts: [...base.appliedDiscounts, extraLine],
    totalDiscountBani: totalDiscountBaniNew,
    discountedSubtotalBani: discountedSubtotalBaniNew,
    deliveryFeeBani: deliveryFeeBaniNew,
    totalBani: totalBaniNew,
  }
}

/** Снимок сумм из сохранённого заказа (витрина), пока активные правила / зона подгружаются. */
function buildPersistedDiscountEngineSeed(
  cart: PosCartItem[],
  persistedDiscountBani: number,
  deliveryMode: "delivery" | "pickup" | "aggregator",
  deliveryFeeBani: number,
): DiscountEngineOutput | null {
  const discRound = Math.max(0, Math.round(persistedDiscountBani))
  if (discRound <= 0) return null

  let itemSubtotalBani = 0
  for (const line of cart) {
    itemSubtotalBani += Math.round(line.price) * line.qty
  }
  if (itemSubtotalBani <= 0) return null

  const totalDiscountBani = Math.min(itemSubtotalBani, discRound)
  const discountedSubtotalBani = itemSubtotalBani - totalDiscountBani

  let deliveryFeeOut: number | null
  let totalBaniOut: number | null

  if (deliveryMode === "pickup") {
    deliveryFeeOut = 0
    totalBaniOut = discountedSubtotalBani
  } else {
    const fee = Math.max(0, Math.round(deliveryFeeBani))
    deliveryFeeOut = fee
    totalBaniOut = discountedSubtotalBani + fee
  }

  return {
    appliedDiscounts: [],
    giftItems: [],
    itemSubtotalBani,
    totalDiscountBani,
    discountedSubtotalBani,
    deliveryFeeBani: deliveryFeeOut,
    totalBani: totalBaniOut,
    bonusMultiplier: 1,
    excludedCategoryIds: [],
  }
}

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
    userName: z.string(),
    userPhone: z.string(),
    deliveryMode: z.enum(["delivery", "pickup", "aggregator"]),
    deliveryAddress: z.string().optional(),
    addressEntrance: z.string().optional(),
    addressFloor: z.string().optional(),
    addressApartment: z.string().optional(),
    addressIntercom: z.string().optional(),
    paymentMethod: z.enum(["cash", "card", "aggregator_card", "mixed"]),
    cashAmount: z.number().int().min(0).nullable().optional(),
    cardAmount: z.number().int().min(0).nullable().optional(),
    changeFromLei: z.string().optional(),
    comment: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.deliveryMode !== "aggregator") {
      if (!data.userName.trim()) {
        ctx.addIssue({
          code: "custom",
          message: "Введите имя",
          path: ["userName"],
        })
      }
      if (!data.userPhone.trim()) {
        ctx.addIssue({
          code: "custom",
          message: "Введите телефон",
          path: ["userPhone"],
        })
      }
    }
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
  const addr = posCheckoutAddressFieldsFromOrder(o)
  return {
    userName: o.user_name?.trim() ?? "",
    userPhone: phoneInputFromStored(o.user_phone ?? ""),
    deliveryMode: o.delivery_mode,
    deliveryAddress: addr.deliveryAddress,
    addressEntrance: addr.entrance,
    addressFloor: addr.floor,
    addressApartment: addr.apartment,
    addressIntercom: addr.intercom,
    paymentMethod:
      o.payment_method === "card" ||
      o.payment_method === "cash" ||
      o.payment_method === "aggregator_card" ||
      o.payment_method === "mixed"
        ? o.payment_method
        : "cash",
    cashAmount:
      o.payment_method === "mixed" ? (o.cash_amount ?? null) : null,
    cardAmount:
      o.payment_method === "mixed" ? (o.card_amount ?? null) : null,
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
  totalsSlot,
  onUpdateQty,
  onRemove,
  onOpenLine,
  errorBanner,
  cartInteractionDisabled,
  onRunnerSend,
  onCourierAssign,
  onPayOrder,
  payOrderDisabled,
  runnerDisabled,
  runnerBusy,
  runnerAlreadySent,
  assignedCourierId,
  assignedCourierName,
  onChangeAssignedCourier,
  courierContactWarnings = [],
  courierButtonDisabled = false,
  courierButtonHints = [],
}: {
  cart: PosCartItem[]
  cartCount: number
  /** Сводка: промо + строки скидок и итог (вместо одной строки «подытог»). */
  totalsSlot?: ReactNode
  onUpdateQty: (idx: number, delta: number) => void | Promise<void>
  onRemove: (idx: number) => void | Promise<void>
  onOpenLine: (idx: number) => void
  errorBanner?: string | null
  cartInteractionDisabled: boolean
  onRunnerSend?: () => void | Promise<void>
  onCourierAssign?: () => void
  onPayOrder?: () => void
  payOrderDisabled?: boolean
  runnerDisabled?: boolean
  runnerBusy?: boolean
  /** Заказ уже ушёл на кухню (не черновик) — только подпись, без повторной отправки */
  runnerAlreadySent?: boolean
  assignedCourierId?: string | null
  assignedCourierName?: string | null
  onChangeAssignedCourier?: () => void
  courierContactWarnings?: string[]
  /** Телефон / адрес (доставка): блокирует «Назначить» и «Сменить» */
  courierButtonDisabled?: boolean
  courierButtonHints?: string[]
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

        {/* Футер: сводка + CTA */}
        <div className="shrink-0 border-t border-border p-5">
          {totalsSlot != null ? (
            <div className="mb-3">{totalsSlot}</div>
          ) : null}
          {(onCourierAssign || onChangeAssignedCourier) &&
          courierContactWarnings.length > 0 ? (
            <div className="mt-3 flex flex-col gap-1">
              {courierContactWarnings.map((line, i) => (
                <p
                  key={`${line}-${i}`}
                  className="text-center text-[12px] font-medium leading-snug text-amber-800"
                >
                  {line}
                </p>
              ))}
            </div>
          ) : null}
          {assignedCourierId && onChangeAssignedCourier ? (
            <div className="mt-3">
              <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-[#f2f2f2] px-3 py-2">
                <span className="min-w-0 flex-1 truncate text-left text-[13px] text-[#242424]">
                  <span className="font-normal text-[#808080]">Курьер · </span>
                  <span className="font-bold">
                    {assignedCourierName?.trim() || "—"}
                  </span>
                </span>
                <button
                  type="button"
                  disabled={courierButtonDisabled}
                  onClick={onChangeAssignedCourier}
                  className={cn(
                    "shrink-0 rounded-full border border-[#e0e0e0] bg-white px-2.5 py-1 text-[11px] font-bold text-[#242424] transition-colors hover:bg-[#f2f2f2]",
                    courierButtonDisabled
                      ? "pointer-events-none cursor-not-allowed opacity-40 hover:bg-white"
                      : "",
                  )}
                >
                  Сменить
                </button>
              </div>
              {courierButtonDisabled && courierButtonHints.length > 0 ? (
                <div className="mt-1.5 flex flex-col gap-0.5 px-1">
                  {courierButtonHints.map((line, i) => (
                    <p
                      key={`${line}-${i}`}
                      className="text-center text-[11px] font-medium leading-snug text-[#808080]"
                    >
                      {line}
                    </p>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
          {onCourierAssign ? (
            <div className="mt-3">
              <button
                type="button"
                disabled={courierButtonDisabled}
                onClick={onCourierAssign}
                className={cn(
                  POS_RUNNER_CTA_CLASS,
                  courierButtonDisabled
                    ? "pointer-events-none cursor-not-allowed opacity-40"
                    : "",
                )}
              >
                Назначить курьера
              </button>
              {courierButtonDisabled && courierButtonHints.length > 0 ? (
                <div className="mt-1.5 flex flex-col gap-0.5 px-1">
                  {courierButtonHints.map((line, i) => (
                    <p
                      key={`${line}-assign-${i}`}
                      className="text-center text-[11px] font-medium leading-snug text-[#808080]"
                    >
                      {line}
                    </p>
                  ))}
                </div>
              ) : null}
            </div>
          ) : onPayOrder ? (
            <button
              type="button"
              disabled={payOrderDisabled}
              onClick={onPayOrder}
              className={cn("mt-3", POS_RUNNER_CTA_CLASS)}
            >
              Принять оплату
            </button>
          ) : onRunnerSend ? (
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
    | { image_url: string | null; category_id?: string | null }
    | { image_url: string | null; category_id?: string | null }[]
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
  const categoryId =
    (embed && "category_id" in embed
      ? (embed as { category_id?: string | null }).category_id
      : null) ?? ""
  return {
    orderItemId: line.id,
    menuItemId: line.menu_item_id ?? "",
    category_id: typeof categoryId === "string" ? categoryId : "",
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
  const loadBrandMenu = usePosMenuCache((s) => s.loadBrandMenu)
  const getBrandMenu = usePosMenuCache((s) => s.getBrandMenu)
  const posMenuCategories = usePosMenuCache((s) =>
    brandId ? s.brands[brandId]?.categories : undefined,
  )

  const [engineOutput, setEngineOutput] = useState<DiscountEngineOutput | null>(
    null,
  )
  const [appliedPromoCode, setAppliedPromoCode] = useState<string | null>(null)

  const [posCustomerData, setPosCustomerData] = useState<CustomerWithAddresses | null>(
    null,
  )
  const [posBonusBalance, setPosBonusBalance] = useState<number | null>(null)
  const [posMaxRedemptionRate, setPosMaxRedemptionRate] = useState<number | null>(
    null,
  )
  const [posCustomerLoading, setPosCustomerLoading] = useState(false)
  const [posCustomerLookupDone, setPosCustomerLookupDone] = useState(false)
  const lastCustomerLookupPhoneRef = useRef<string | null>(null)
  /** saved: из справочника; new: ввод вручную */
  const [addressBookMode, setAddressBookMode] = useState<"saved" | "new">("saved")
  const [selectedSavedAddressId, setSelectedSavedAddressId] = useState<string | null>(
    null,
  )
  const [saveNewAddressOnSubmit, setSaveNewAddressOnSubmit] = useState(false)
  /** undefined — не трогать orders.profile_id; null — сбросить */
  const [linkedProfileId, setLinkedProfileId] = useState<string | null | undefined>(
    undefined,
  )
  const [saveCustomerBusy, setSaveCustomerBusy] = useState(false)
  /** Сумма списания бонусов в MDL (шаг «Детали» → сводка перед отправкой). */
  const [bonusesToRedeem, setBonusesToRedeem] = useState(
    Math.max(0, Math.floor(listOrder?.bonuses_redeemed ?? 0)),
  )
  const [bonusRedeemFieldError, setBonusRedeemFieldError] = useState<
    string | null
  >(null)
  const [bonusRedeemTouched, setBonusRedeemTouched] = useState(false)

  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const [zoneResult, setZoneResult] = useState<DeliveryZoneCheckResultPos | null>(null)
  const [zoneChecking, setZoneChecking] = useState(false)
  /** Последние координаты по геокоду зоны POS (для customer_addresses / orders). */
  const posDeliveryGeoRef = useRef<{ lat: number; lng: number } | null>(null)

  const [orderPrep, setOrderPrep] = useState<{ loading: boolean; error: string | null }>({
    loading: true,
    error: null,
  })
  const [orderNumber, setOrderNumber] = useState<number | null>(null)
  const [extendSubmitting, setExtendSubmitting] = useState(false)
  const [runnerBusy, setRunnerBusy] = useState(false)
  /** Защита от двойного нажатия «Отправить бегунок» до смены черновика */
  const runnerKitchenLockedRef = useRef(false)
  const [courierModalOpen, setCourierModalOpen] = useState(false)
  const [courierModalMode, setCourierModalMode] = useState<
    "assign" | "reassign"
  >("assign")
  const [courierContactWarnings, setCourierContactWarnings] = useState<
    string[]
  >([])
  const cashSession = useCashSession()
  const [payModalOpen, setPayModalOpen] = useState(false)
  const runnerAlreadySent = listOrder?.status === "cooking"
  const readyForCourierAssign =
    listOrder?.status === "ready" && listOrder?.delivery_mode === "delivery"
  const showPayOrderCta =
    // 1) обычная доставка после передачи курьеру
    listOrder?.status === "delivery" ||
    // 2) самовывоз готов — сразу оплата, без статуса delivery
    (listOrder?.status === "ready" &&
      listOrder?.delivery_mode === "pickup") ||
    // 3) Glovo готов — сразу оплата
    (listOrder?.status === "ready" &&
      listOrder?.delivery_mode === "aggregator")
  const courierButtonGate = useMemo(() => {
    if (!listOrder) {
      return { disabled: false as boolean, hints: [] as string[] }
    }
    const isPickup = listOrder.delivery_mode === "pickup"
    const isAggregator = listOrder.delivery_mode === "aggregator"
    const missingPhone = !isAggregator && !listOrder.user_phone?.trim()
    const missingAddress =
      !isPickup && !isAggregator && !listOrder.delivery_address?.trim()
    const disabled = missingPhone || missingAddress
    const hints = [
      missingPhone ? "Укажите телефон клиента" : null,
      missingAddress ? "Укажите адрес доставки" : null,
    ].filter((x): x is string => x != null)
    return { disabled, hints }
  }, [listOrder])
  const openCourierModalWithContactWarnings = useCallback(
    (mode: "assign" | "reassign") => {
      if (!listOrder) {
        setCourierContactWarnings([])
        setCourierModalMode(mode)
        setCourierModalOpen(true)
        return
      }
      const isPickup = listOrder.delivery_mode === "pickup"
      const isAggregator = listOrder.delivery_mode === "aggregator"
      const missingPhone = !isAggregator && !listOrder.user_phone?.trim()
      const missingAddress =
        !isPickup && !isAggregator && !listOrder.delivery_address?.trim()
      if (missingPhone || missingAddress) {
        return
      }
      setCourierContactWarnings([])
      setCourierModalMode(mode)
      setCourierModalOpen(true)
    },
    [listOrder],
  )
  const [clearCartBusy, setClearCartBusy] = useState(false)
  const [deliveryModeBusy, setDeliveryModeBusy] = useState(false)
  const [orderMenuOpen, setOrderMenuOpen] = useState(false)
  const cartInteractionDisabled =
    cartActionBusy || extendSubmitting || clearCartBusy || deliveryModeBusy || runnerBusy
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
      cashAmount: null,
      cardAmount: null,
      changeFromLei: "",
      comment: "",
    },
  })

  const deliveryMode = form.watch("deliveryMode")
  const paymentMethod = form.watch("paymentMethod")
  const cashAmountWatched = form.watch("cashAmount")
  const cardAmountWatched = form.watch("cardAmount")
  const deliveryAddress = form.watch("deliveryAddress")
  const userPhoneWatched = form.watch("userPhone")

  useEffect(() => {
    setCourierContactWarnings([])
  }, [posOrderId])

  useEffect(() => {
    if (!listOrder) return
    const isPickup = listOrder.delivery_mode === "pickup"
    const isAggregator = listOrder.delivery_mode === "aggregator"
    const missingAddress =
      !isPickup && !isAggregator && !listOrder.delivery_address?.trim()
    const missingPhone = !isAggregator && !listOrder.user_phone?.trim()
    if (!missingAddress && !missingPhone) {
      setCourierContactWarnings([])
    }
  }, [listOrder])

  useEffect(() => {
    const isPickupForm = deliveryMode === "pickup"
    const isAggForm = deliveryMode === "aggregator"
    const addrOk =
      isPickupForm || isAggForm || Boolean(deliveryAddress?.trim())
    const phoneOk = isAggForm || Boolean(userPhoneWatched?.trim())
    if (addrOk && phoneOk) {
      setCourierContactWarnings([])
    }
  }, [deliveryMode, deliveryAddress, userPhoneWatched])

  const cartForEngine = useMemo((): CartItemForEngine[] => {
    return cart.map((it) => ({
      menu_item_id: it.menuItemId,
      category_id: it.category_id,
      variant_id: it.variantId ?? null,
      quantity: it.qty,
      unit_price_bani: it.price,
    }))
  }, [cart])

  const excludedCategoryIds = useMemo(() => {
    if (!posMenuCategories) return []
    return posMenuCategories
      .filter((c) => c.exclude_from_discounts)
      .map((c) => c.id)
  }, [posMenuCategories])

  const deliveryZoneForEngine = useMemo((): DeliveryZoneForEngine | null => {
    if (deliveryMode === "pickup") {
      return { price_bani: 0, free_from_bani: 0 }
    }
    if (zoneResult?.status === "in_zone") {
      const z = zoneResult.zone
      return {
        price_bani: z.delivery_price_bani,
        free_from_bani: z.free_delivery_from_bani ?? Number.MAX_SAFE_INTEGER,
      }
    }
    if (
      editBaselineDeliveryFeeBani != null &&
      editBaselineDeliveryFeeBani > 0
    ) {
      return {
        price_bani: editBaselineDeliveryFeeBani,
        free_from_bani: Number.MAX_SAFE_INTEGER,
      }
    }
    return null
  }, [deliveryMode, zoneResult, editBaselineDeliveryFeeBani])

  const fallbackEngineOutput = useMemo(
    () =>
      evaluateDiscounts({
        items: cartForEngine,
        rules: [],
        deliveryZone: deliveryZoneForEngine,
        excludedCategoryIds:
          excludedCategoryIds.length > 0 ? excludedCategoryIds : undefined,
      }),
    [
      cartForEngine,
      deliveryZoneForEngine,
      excludedCategoryIds,
    ],
  )

  const rawEngineOutput = engineOutput ?? fallbackEngineOutput
  const effectiveEngineOutput = useMemo(
    () =>
      mergePersistedWebsitePromoDiscount(
        rawEngineOutput,
        listOrder?.promo_code,
        listOrder?.discount,
        deliveryZoneForEngine,
      ),
    [
      rawEngineOutput,
      listOrder?.promo_code,
      listOrder?.discount,
      deliveryZoneForEngine,
    ],
  )

  const excludedCategoriesInCart = useMemo(() => {
    if (!effectiveEngineOutput || effectiveEngineOutput.totalDiscountBani === 0) return []
    const inCart = new Set(cartForEngine.map((i) => i.category_id))
    const src = posMenuCategories ?? []
    return src
      .filter((c) => c.exclude_from_discounts && inCart.has(c.id))
      .map((c) => ({ id: c.id, name_ru: c.name_ru, name_ro: "" }))
  }, [effectiveEngineOutput, cartForEngine, posMenuCategories])

  const totalBani = effectiveEngineOutput.totalBani ?? 0
  const runnerHasPricedItems = effectiveEngineOutput.itemSubtotalBani > 0

  const skipWebsitePromoSeedResolve = Boolean(
    listOrder?.source === "website" && listOrder?.promo_code?.trim(),
  )

  const persistedOrderBonusPts = useMemo(() => {
    if (!listOrder || listOrder.id !== posOrderId) return 0
    return Math.max(0, Math.floor(listOrder.bonuses_redeemed ?? 0))
  }, [listOrder, posOrderId])

  const effectiveBonusPoints = useMemo(() => {
    const uiPoints = Math.max(0, Math.floor(bonusesToRedeem || 0))
    return bonusRedeemTouched
      ? uiPoints
      : Math.max(persistedOrderBonusPts, uiPoints)
  }, [bonusRedeemTouched, bonusesToRedeem, persistedOrderBonusPts])

  useEffect(() => {
    if (!listOrder || listOrder.id !== posOrderId || cart.length === 0) return
    const d = Math.max(0, Math.round(listOrder.discount ?? 0))
    if (d <= 0) return
    setEngineOutput((prev) => {
      if (prev !== null) return prev
      return (
        buildPersistedDiscountEngineSeed(
          cart,
          d,
          listOrder.delivery_mode,
          Math.max(0, Math.round(listOrder.delivery_fee ?? 0)),
        ) ?? prev
      )
    })
  }, [listOrder, posOrderId, cart])

  /** Левый список читает `orders.total/discount`; на шаге 2 они могли не совпасть с движком — подтягиваем только в локальный снимок панели (без БД). */
  useEffect(() => {
    if (step !== 2) return
    if (!listOrder || listOrder.id !== posOrderId) return

    const pay = effectiveEngineOutput.totalBani
    if (pay == null) return

    const bonusBani = effectiveBonusPoints * 100
    const disc = Math.min(
      effectiveEngineOutput.itemSubtotalBani,
      Math.max(0, Math.round(effectiveEngineOutput.totalDiscountBani)),
    )
    const roundedPay = Math.max(0, Math.round(pay) - bonusBani)

    const t0 = Math.round(listOrder.total ?? 0)
    const d0 = Math.round(listOrder.discount ?? 0)

    if (
      Math.abs(t0 - roundedPay) <= 2 &&
      Math.abs(d0 - disc) <= 2
    ) {
      return
    }

    updateOrderLocalState(posOrderId, {
      total: roundedPay,
      discount: disc,
      bonuses_redeemed: effectiveBonusPoints,
      updated_at: new Date().toISOString(),
    })
  }, [
    step,
    posOrderId,
    listOrder?.id,
    listOrder?.total,
    listOrder?.discount,
    effectiveEngineOutput.totalBani,
    effectiveEngineOutput.totalDiscountBani,
    effectiveEngineOutput.itemSubtotalBani,
    effectiveBonusPoints,
    updateOrderLocalState,
  ])

  const posBonusMaxRedeemable = useMemo(() => {
    const balance = posBonusBalance ?? 0
    const orderTotalMdl = totalBani / 100
    const rate = posMaxRedemptionRate ?? 0.3
    return Math.floor(Math.min(balance, orderTotalMdl * rate))
  }, [posBonusBalance, totalBani, posMaxRedemptionRate])

  const redeemBaniApplied = effectiveBonusPoints * 100
  const payableAfterBonusBani = Math.max(0, totalBani - redeemBaniApplied)

  const optimisticCartOrderPatch = useCallback(
    (lines: PosCartItem[]): Partial<PosOrder> => {
      const subtotal = lines.reduce((sum, line) => sum + line.price * line.qty, 0)
      const discount = Math.min(
        subtotal,
        Math.max(0, Math.round(effectiveEngineOutput.totalDiscountBani ?? 0)),
      )
      const deliveryFee = Math.max(
        0,
        Math.round(
          effectiveEngineOutput.deliveryFeeBani ?? listOrder?.delivery_fee ?? 0,
        ),
      )
      const bonusBani = effectiveBonusPoints * 100

      return {
        item_count: lines.reduce((sum, line) => sum + line.qty, 0),
        total: Math.max(0, subtotal - discount + deliveryFee - bonusBani),
        discount,
        delivery_fee: deliveryFee,
        bonuses_redeemed: effectiveBonusPoints,
        updated_at: new Date().toISOString(),
      }
    },
    [
      effectiveBonusPoints,
      effectiveEngineOutput.deliveryFeeBani,
      effectiveEngineOutput.totalDiscountBani,
      listOrder?.delivery_fee,
    ],
  )

  const applyOptimisticCart = useCallback(
    (lines: PosCartItem[]) => {
      setCart(lines)
      updateOrderLocalState(posOrderId, optimisticCartOrderPatch(lines))
    },
    [optimisticCartOrderPatch, posOrderId, updateOrderLocalState],
  )

  const rollbackOptimisticCart = useCallback(
    (snapshot: PosCartItem[], message: string) => {
      applyOptimisticCart(snapshot)
      toast.error(message)
    },
    [applyOptimisticCart],
  )

  const detailsSaveTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  )
  const stepRef = useRef(step)
  stepRef.current = step
  const scheduleDebouncedDetailsSaveRef = useRef(() => {})

  const detailsPricingRef = useRef({
    engineOutput: fallbackEngineOutput,
    appliedPromoCode: null as string | null,
    linkedProfileId: undefined as string | null | undefined,
    bonusesToRedeem: 0,
  })
  detailsPricingRef.current = {
    engineOutput: effectiveEngineOutput,
    appliedPromoCode,
    linkedProfileId,
    bonusesToRedeem: effectiveBonusPoints,
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
    setBonusesToRedeem(Math.max(0, Math.floor(listOrder.bonuses_redeemed ?? 0)))
    setAppliedPromoCode(listOrder.promo_code?.trim() || null)
  }, [listOrder, posOrderId, detailsFormDirty, form])

  useEffect(() => {
    categoriesReadyBrandRef.current = null
    menuLoadedKeyRef.current = null
  }, [posOrderId])

  useEffect(() => {
    setPosCustomerData(null)
    setPosBonusBalance(null)
    setPosCustomerLoading(false)
    setPosCustomerLookupDone(false)
    setAddressBookMode("saved")
    setSelectedSavedAddressId(null)
    setSaveNewAddressOnSubmit(false)
    setLinkedProfileId(undefined)
    setBonusRedeemFieldError(null)
    setPosMaxRedemptionRate(null)
    setBonusRedeemTouched(false)
    lastCustomerLookupPhoneRef.current = null
  }, [posOrderId])

  useEffect(() => {
    if (!listOrder || listOrder.id !== posOrderId) return
    const pid = listOrder.profile_id?.trim()
    if (!pid) return
    setLinkedProfileId((prev) => (prev === undefined ? pid : prev))
  }, [listOrder?.profile_id, listOrder?.id, posOrderId])

  const posBonusRedeemAllowed =
    typeof linkedProfileId === "string" &&
    (posBonusBalance ?? 0) > 0 &&
    totalBani > 0

  const showBonusRedeemUi =
    posBonusRedeemAllowed || persistedOrderBonusPts > 0

  useEffect(() => {
    if (bonusRedeemTouched) return
    if (!listOrder || listOrder.id !== posOrderId) {
      setBonusesToRedeem(0)
      return
    }
    setBonusesToRedeem(Math.max(0, Math.floor(listOrder.bonuses_redeemed ?? 0)))
  }, [listOrder, posOrderId, bonusRedeemTouched])

  useEffect(() => {
    if (posBonusRedeemAllowed) return
    const persisted =
      listOrder?.id === posOrderId
        ? Math.max(0, Math.floor(listOrder.bonuses_redeemed ?? 0))
        : 0
    if (persisted > 0) return
    setBonusesToRedeem(0)
    setBonusRedeemFieldError(null)
  }, [posBonusRedeemAllowed, listOrder?.id, listOrder?.bonuses_redeemed, posOrderId])

  useEffect(() => {
    if (!posBonusRedeemAllowed) return
    const persisted =
      listOrder?.id === posOrderId
        ? Math.max(0, Math.floor(listOrder.bonuses_redeemed ?? 0))
        : 0
    const cap = Math.max(posBonusMaxRedeemable, persisted)
    setBonusesToRedeem((prev) => (prev > cap ? cap : prev))
  }, [
    posBonusRedeemAllowed,
    posBonusMaxRedeemable,
    listOrder?.id,
    listOrder?.bonuses_redeemed,
    posOrderId,
  ])

  useEffect(() => {
    setBonusRedeemTouched(false)
  }, [posOrderId, posCustomerData?.profile.id])

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

  useEffect(() => {
    if (zoneResult?.status === "in_zone" || zoneResult?.status === "out_of_zone") {
      posDeliveryGeoRef.current = {
        lat: zoneResult.lat,
        lng: zoneResult.lng,
      }
    } else {
      posDeliveryGeoRef.current = null
    }
  }, [zoneResult])

  /* Сбрасываем зону при переключении режима */
  useEffect(() => {
    if (deliveryMode === "pickup" || deliveryMode === "aggregator") {
      setZoneResult(null)
    }
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
    setEngineOutput(null)

    void (async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("orders")
        .select(
          "delivery_fee, discount, order_number, user_name, user_phone, delivery_mode, delivery_address, payment_method, change_from, cash_amount, card_amount, comment, promo_code, address_entrance, address_floor, address_apartment, address_intercom, aggregator, prep_deadline_at, brands(slug), order_items(id, item_name, menu_item_id, variant_id, size, quantity, price, toppings, menu_items(image_url, category_id))",
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
        delivery_mode: "delivery" | "pickup" | "aggregator"
        delivery_address: string | null
        delivery_fee: number
        discount: number
        payment_method: "cash" | "card" | "aggregator_card" | "mixed"
        aggregator: "glovo" | null
        prep_deadline_at: string | null
        change_from: number | null
        cash_amount: number | null
        card_amount: number | null
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
          variant_id: string | null
          size: string | null
          quantity: number
          price: number
          toppings: unknown
          menu_items:
            | { image_url: string | null; category_id?: string | null }
            | { image_url: string | null; category_id?: string | null }[]
            | null
        }> | null
      }

      const bEmbed = raw.brands
      const slug = Array.isArray(bEmbed)
        ? bEmbed[0]?.slug
        : bEmbed?.slug

      const lines = raw.order_items ?? []
      const cartLines = lines.map(posCartFromOrderLine)

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
        setAppliedPromoCode(null)
        setEngineOutput(null)
        const addr = posCheckoutAddressFieldsFromOrder(raw)
        form.reset({
          userName: raw.user_name?.trim() ?? "",
          userPhone: phoneInputFromStored(raw.user_phone ?? ""),
          deliveryMode: raw.delivery_mode,
          deliveryAddress: addr.deliveryAddress,
          addressEntrance: addr.entrance,
          addressFloor: addr.floor,
          addressApartment: addr.apartment,
          addressIntercom: addr.intercom,
          paymentMethod: raw.payment_method,
          changeFromLei:
            raw.change_from != null && raw.change_from > 0
              ? String(raw.change_from / 100)
              : "",
          cashAmount:
            raw.payment_method === "mixed" ? (raw.cash_amount ?? null) : null,
          cardAmount:
            raw.payment_method === "mixed" ? (raw.card_amount ?? null) : null,
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
      setAppliedPromoCode(raw.promo_code?.trim() || null)

      const seedDiscount = Math.max(0, Math.round(raw.discount ?? 0))
      const seeded = buildPersistedDiscountEngineSeed(
        cartLines,
        seedDiscount,
        raw.delivery_mode,
        Math.max(0, Math.round(raw.delivery_fee ?? 0)),
      )
      setEngineOutput(seeded ?? null)

      const addr = posCheckoutAddressFieldsFromOrder(raw)
      form.reset({
        userName: raw.user_name?.trim() ?? "",
        userPhone: phoneInputFromStored(raw.user_phone ?? ""),
        deliveryMode: raw.delivery_mode,
        deliveryAddress: addr.deliveryAddress,
        addressEntrance: addr.entrance,
        addressFloor: addr.floor,
        addressApartment: addr.apartment,
        addressIntercom: addr.intercom,
        paymentMethod: raw.payment_method,
        changeFromLei:
          raw.change_from != null && raw.change_from > 0
            ? String(raw.change_from / 100)
            : "",
        cashAmount:
          raw.payment_method === "mixed" ? (raw.cash_amount ?? null) : null,
        cardAmount:
          raw.payment_method === "mixed" ? (raw.card_amount ?? null) : null,
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

  const loadCategoriesFallback = useCallback(async (
    bid: string,
  ): Promise<boolean> => {
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

  const loadCategories = useCallback(
    async (bid: string): Promise<boolean> => {
      const cached = getBrandMenu(bid)
      const menu = cached ?? ((await loadBrandMenu(bid)) ? getBrandMenu(bid) : null)

      if (!menu) {
        return loadCategoriesFallback(bid)
      }

      const rows = menu.categories
      setCategories(rows)
      setActiveCategoryId((prev) => {
        if (!rows.length) return ""
        if (prev && rows.some((c) => c.id === prev)) return prev
        return rows[0]!.id
      })
      return true
    },
    [getBrandMenu, loadBrandMenu, loadCategoriesFallback],
  )

  useEffect(() => {
    if (step !== 2 || !brandId) return
    if (categoriesReadyBrandRef.current === brandId) return
    void (async () => {
      const ok = await loadCategories(brandId)
      if (ok) categoriesReadyBrandRef.current = brandId
    })()
  }, [step, brandId, loadCategories])

  const loadMenuItemsFallback = useCallback(async (): Promise<boolean> => {
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

  const loadMenuItems = useCallback(async (): Promise<boolean> => {
    if (!brandId || !activeCategoryId) return false

    const cached = getBrandMenu(brandId)
    const menu =
      cached ?? ((await loadBrandMenu(brandId)) ? getBrandMenu(brandId) : null)

    if (!menu) {
      return loadMenuItemsFallback()
    }

    setMenuLoading(false)
    setMenuItems((menu.itemsByCategory[activeCategoryId] ?? []) as MenuItemRow[])
    return true
  }, [
    activeCategoryId,
    brandId,
    getBrandMenu,
    loadBrandMenu,
    loadMenuItemsFallback,
  ])

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
        "order_items(id, item_name, menu_item_id, variant_id, size, quantity, price, toppings, menu_items(image_url, category_id))",
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
              | { image_url: string | null; category_id?: string | null }
              | { image_url: string | null; category_id?: string | null }[]
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
    const snapshot = cart
    const nextCart: PosCartItem[] = []
    setModalItem(null)
    setCartEditIndex(null)
    applyOptimisticCart(nextCart)
    setClearCartBusy(true)
    try {
      const res = await replaceOrderItemsPos({
        orderId: posOrderId,
        lines: [],
      })
      if (!res.success) {
        rollbackOptimisticCart(
          snapshot,
          res.error ?? "Не удалось очистить корзину",
        )
        return
      }
      lastSyncedCartFingerprintRef.current = cartFingerprint(nextCart)
    } finally {
      setClearCartBusy(false)
    }
  }, [
    applyOptimisticCart,
    cart,
    posOrderId,
    rollbackOptimisticCart,
  ])

  const handleChangeDeliveryMode = useCallback(
    async (nextMode: "delivery" | "pickup") => {
      if (deliveryMode === nextMode || deliveryModeBusy) return

      setOrderMenuOpen(false)
      setDeliveryModeBusy(true)
      try {
        const res = await updateOrderDeliveryModePos(posOrderId, nextMode)
        if (!res.success) {
          toast.error(res.error)
          return
        }

        form.setValue("deliveryMode", res.deliveryMode, {
          shouldDirty: true,
          shouldTouch: true,
          shouldValidate: true,
        })
        form.setValue(
          "deliveryAddress",
          res.deliveryMode === "pickup" ? "" : (res.deliveryAddress ?? ""),
          {
            shouldDirty: true,
            shouldTouch: true,
            shouldValidate: true,
          },
        )
        if (res.deliveryMode === "pickup") {
          setZoneResult(null)
          setEditBaselineDeliveryFeeBani(0)
        }
        updateOrderLocalState(posOrderId, {
          delivery_mode: res.deliveryMode,
          delivery_address: res.deliveryAddress,
          delivery_fee: res.deliveryFee,
          total: res.total,
          updated_at: new Date().toISOString(),
        })
        toast.success(
          res.deliveryMode === "pickup"
            ? "Тип заказа изменён на навынос"
            : "Тип заказа изменён на доставку",
        )
      } finally {
        setDeliveryModeBusy(false)
      }
    },
    [
      deliveryMode,
      deliveryModeBusy,
      form,
      posOrderId,
      updateOrderLocalState,
    ],
  )

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
      const snapshot = cart
      const idx = cart.findIndex(
        (x) =>
          x.menuItemId === entry.menuItemId &&
          (x.variantId ?? null) === (entry.variantId ?? null) &&
          (x.size ?? "") === (entry.size ?? "") &&
          toppingsSignature(x.toppings) === toppingsSignature(entry.toppings),
      )
      const nextCart =
        idx >= 0
          ? cart.map((line, lineIdx) =>
              lineIdx === idx ? { ...line, qty: line.qty + entry.qty } : line,
            )
          : [...cart, entry]
      applyOptimisticCart(nextCart)
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
              rollbackOptimisticCart(snapshot, "Не удалось обновить количество")
              return
            }
          } else {
            rollbackOptimisticCart(snapshot, "Некорректное состояние корзины")
            return
          }
        } else {
          const res = await addOrderItemsPos({
            orderId: posOrderId,
            lines: [posLinePayloadFromCartItem(entry)],
          })
          if (!res.success) {
            rollbackOptimisticCart(snapshot, "Не удалось добавить позицию")
            return
          }
          void refreshCartFromDb()
        }
        lastSyncedCartFingerprintRef.current = cartFingerprint(nextCart)
      } finally {
        setCartActionBusy(false)
      }
    },
    [
      applyOptimisticCart,
      cart,
      cartInteractionDisabled,
      posOrderId,
      refreshCartFromDb,
      rollbackOptimisticCart,
      toppingsSignature,
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
          category_id: row.category_id,
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
      const snapshot = cart
      const nextCart =
        q < 1
          ? cart.filter((_, lineIdx) => lineIdx !== idx)
          : cart.map((line, lineIdx) =>
              lineIdx === idx ? { ...line, qty: q } : line,
            )
      applyOptimisticCart(nextCart)
      setCartActionBusy(true)
      try {
        if (q < 1) {
          const res = await removeOrderItemPos({
            orderId: posOrderId,
            itemId: row.orderItemId,
          })
          if (!res.success) {
            rollbackOptimisticCart(snapshot, "Не удалось удалить позицию")
            return
          }
        } else {
          const res = await updateOrderItemQuantityPos({
            orderId: posOrderId,
            itemId: row.orderItemId,
            quantity: q,
          })
          if (!res.success) {
            rollbackOptimisticCart(snapshot, "Не удалось обновить количество")
            return
          }
        }
        lastSyncedCartFingerprintRef.current = cartFingerprint(nextCart)
      } finally {
        setCartActionBusy(false)
      }
    },
    [
      applyOptimisticCart,
      cart,
      cartInteractionDisabled,
      posOrderId,
      rollbackOptimisticCart,
    ],
  )

  const removeLine = useCallback(
    async (idx: number) => {
      if (cartInteractionDisabled) return
      const row = cart[idx]
      if (!row) return
      const snapshot = cart
      const nextCart = cart.filter((_, lineIdx) => lineIdx !== idx)
      applyOptimisticCart(nextCart)
      if (!row.orderItemId) {
        lastSyncedCartFingerprintRef.current = cartFingerprint(nextCart)
        return
      }
      setCartActionBusy(true)
      try {
        const res = await removeOrderItemPos({
          orderId: posOrderId,
          itemId: row.orderItemId,
        })
        if (!res.success) {
          rollbackOptimisticCart(snapshot, "Не удалось удалить позицию")
          return
        }
        lastSyncedCartFingerprintRef.current = cartFingerprint(nextCart)
      } finally {
        setCartActionBusy(false)
      }
    },
    [
      applyOptimisticCart,
      cart,
      cartInteractionDisabled,
      posOrderId,
      rollbackOptimisticCart,
    ],
  )

  const closeProductModal = useCallback(() => {
    setModalItem(null)
    setCartEditIndex(null)
  }, [])

  const openCartLineModal = useCallback(
    async (idx: number) => {
      if (cartModalBusyRef.current) return
      const line = cart[idx]
      if (!line) return
      cartModalBusyRef.current = true
      try {
        const cachedMenu = brandId ? getBrandMenu(brandId) : null
        const menu =
          cachedMenu ??
          (brandId && (await loadBrandMenu(brandId)) ? getBrandMenu(brandId) : null)
        const cachedItem = menu?.itemsById[line.menuItemId]

        if (cachedItem) {
          setCartEditIndex(idx)
          setModalItem(posMenuRowForModal(cachedItem as MenuItemRow))
          return
        }

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
    },
    [brandId, cart, getBrandMenu, loadBrandMenu],
  )

  const saveCartLineFromModal = useCallback(
    async (cartIndex: number, c: PosCartItem) => {
      if (cartInteractionDisabled) {
        throw new Error("Повторите попытку")
      }
      const prevLine = cart[cartIndex]
      if (!prevLine?.orderItemId) {
        throw new Error("Некорректное состояние корзины")
      }
      const snapshot = cart
      const nextCart = cart.map((line, idx) =>
        idx === cartIndex ? { ...c, orderItemId: prevLine.orderItemId } : line,
      )
      applyOptimisticCart(nextCart)
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
          rollbackOptimisticCart(
            snapshot,
            res.error ?? "Не удалось сохранить позицию",
          )
          throw new Error(res.error ?? "Не удалось сохранить позицию")
        }
        lastSyncedCartFingerprintRef.current = cartFingerprint(nextCart)
      } finally {
        setCartActionBusy(false)
      }
    },
    [
      applyOptimisticCart,
      cart,
      cartInteractionDisabled,
      posOrderId,
      rollbackOptimisticCart,
    ],
  )

  const [closeOrderOpen, setCloseOrderOpen] = useState(false)
  const [closeOrderPreset, setCloseOrderPreset] = useState<string>("")
  const [closeOrderOther, setCloseOrderOther] = useState("")
  const [closeOrderSaving, setCloseOrderSaving] = useState(false)
  const [cancelOrderFeedback, setCancelOrderFeedback] = useState<string | null>(
    null,
  )

  const persistBrandOrError = async (): Promise<boolean> => {
    if (!selectedBrand) {
      setExtendError("Выберите бренд")
      toast.error("Выберите бренд")
      return false
    }
    const res = await updateOrderBrandPos({
      orderId: posOrderId,
      brandSlug: selectedBrand.slug,
    })
    if (!res.success) {
      setExtendError(res.error)
      toast.error(res.error)
      return false
    }
    setExtendError(null)
    await syncBrandSlugOnOrdersPanel(selectedBrand.slug)
    return true
  }

  const persistCartToServer = async (): Promise<boolean> => {
    if (!brandId || !selectedBrand) {
      setExtendError("Сначала выберите бренд")
      toast.error("Сначала выберите бренд")
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
        toast.error(res.error)
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
    if (values.deliveryMode === "aggregator") {
      return true
    }
    if (!values.userName.trim() || !values.userPhone.trim()) return false
    if (
      values.deliveryMode !== "pickup" &&
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
        engineOutput: eng,
        appliedPromoCode: promoCode,
        linkedProfileId: pid,
      } = detailsPricingRef.current

      const changeBani =
        values.paymentMethod === "cash"
          ? parseLeiToBani(values.changeFromLei ?? "")
          : null

      const totalDiscountBani = eng.totalDiscountBani
      const feeBani = eng.deliveryFeeBani ?? 0

      const fromOrderBonuses =
        listOrder?.id === posOrderId
          ? Math.max(0, Math.floor(listOrder.bonuses_redeemed ?? 0))
          : 0
      const uiBonuses = Math.max(
        0,
        Math.floor(detailsPricingRef.current.bonusesToRedeem ?? 0),
      )
      const bonusesRedeemedPoints = bonusRedeemTouched
        ? uiBonuses
        : Math.max(fromOrderBonuses, uiBonuses)

      const sub = eng.itemSubtotalBani
      const safeDiscountPre = Math.min(totalDiscountBani, sub)
      const expectedPayTotalBani = Math.max(
        0,
        sub - safeDiscountPre + feeBani - bonusesRedeemedPoints * 100,
      )

      if (values.paymentMethod === "mixed") {
        const c = values.cashAmount ?? 0
        const d = values.cardAmount ?? 0
        const splitOk =
          c > 0 &&
          d > 0 &&
          Math.abs(c + d - expectedPayTotalBani) <= 1
        if (!splitOk) {
          if (opts?.forSubmit) return false
          return true
        }
      }

      const paymentMethodForSave =
        values.deliveryMode === "aggregator" &&
        values.paymentMethod === "card"
          ? ("aggregator_card" as const)
          : values.paymentMethod

      const res = await updateOrderDetailsPos({
        orderId: posOrderId,
        userName: values.userName,
        userPhone: buildPhoneForSave(values.userPhone),
        deliveryMode: values.deliveryMode,
        deliveryAddress:
          values.deliveryMode === "pickup" ||
          values.deliveryMode === "aggregator"
            ? undefined
            : values.deliveryAddress,
        addressEntrance:
          values.deliveryMode === "aggregator"
            ? null
            : values.addressEntrance?.trim() || null,
        addressFloor:
          values.deliveryMode === "aggregator"
            ? null
            : values.addressFloor?.trim() || null,
        addressApartment:
          values.deliveryMode === "aggregator"
            ? null
            : values.addressApartment?.trim() || null,
        addressIntercom:
          values.deliveryMode === "aggregator"
            ? null
            : values.addressIntercom?.trim() || null,
        paymentMethod: paymentMethodForSave,
        changeFrom: changeBani ?? undefined,
        cashAmount:
          values.paymentMethod === "mixed"
            ? (values.cashAmount ?? null)
            : null,
        cardAmount:
          values.paymentMethod === "mixed"
            ? (values.cardAmount ?? null)
            : null,
        comment: values.comment?.trim() || undefined,
        promoCode: promoCode?.trim() || undefined,
        discount: totalDiscountBani,
        discountRulesApplied: JSON.stringify(eng.appliedDiscounts ?? []),
        giftItems: eng.giftItems ?? [],
        deliveryFee: feeBani,
        profileId: pid,
        delivery_lat:
          values.deliveryMode === "pickup" ||
          values.deliveryMode === "aggregator"
            ? null
            : (posDeliveryGeoRef.current?.lat ?? null),
        delivery_lng:
          values.deliveryMode === "pickup" ||
          values.deliveryMode === "aggregator"
            ? null
            : (posDeliveryGeoRef.current?.lng ?? null),
        bonus_multiplier: eng?.bonusMultiplier ?? 1,
        bonusesRedeemedPoints,
      })
      if (!res.success) {
        if (opts?.forSubmit) setSubmitError(res.error)
        else toast.error("Не удалось сохранить данные")
        return false
      }
      const safeDiscount = safeDiscountPre
      const cardTotal = expectedPayTotalBani
      updateOrderLocalState(posOrderId, {
        total: cardTotal,
        delivery_fee: feeBani,
        discount: safeDiscount,
        bonuses_redeemed: bonusesRedeemedPoints,
        updated_at: new Date().toISOString(),
      })
      if (opts?.forSubmit) setSubmitError(null)
      return true
    },
    [selectedBrand, form, posOrderId, updateOrderLocalState, listOrder, bonusRedeemTouched],
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

  const phoneDigitsCount = (raw: string) => raw.replace(/\D/g, "").length

  const handleBonusRedeemInputChange = useCallback(
    (rawStr: string) => {
      setBonusRedeemTouched(true)
      const rate = posMaxRedemptionRate ?? 0.3
      const maxAllowed = Math.max(posBonusMaxRedeemable, persistedOrderBonusPts)
      const t = rawStr.trim().replace(",", ".")
      if (t === "") {
        setBonusesToRedeem(0)
        setBonusRedeemFieldError(null)
        return
      }
      const raw = Number.parseFloat(t)
      if (!Number.isFinite(raw)) {
        return
      }
      const capped = Math.max(0, Math.min(raw, maxAllowed))
      let msg: string | null = null
      if (raw < 0) {
        msg = "Сумма не может быть отрицательной"
      } else if (raw > maxAllowed) {
        msg = `Максимум ${maxAllowed} бонусов (${Math.round(rate * 100)}% от суммы заказа)`
      }
      setBonusRedeemFieldError(msg)
      setBonusesToRedeem(capped)
    },
    [posMaxRedemptionRate, posBonusMaxRedeemable, persistedOrderBonusPts],
  )

  const applyAddressRowToForm = useCallback(
    (row: CustomerAddressRow) => {
      form.setValue("deliveryAddress", row.address)
      form.setValue("addressEntrance", row.entrance ?? "")
      form.setValue("addressFloor", row.floor ?? "")
      form.setValue("addressApartment", row.apartment ?? "")
      form.setValue("addressIntercom", row.intercom ?? "")
      patchDetailsCardAndScheduleSave({
        delivery_address: row.address,
        address_entrance: row.entrance?.trim() || null,
        address_floor: row.floor?.trim() || null,
        address_apartment: row.apartment?.trim() || null,
        address_intercom: row.intercom?.trim() || null,
      })
    },
    [form, patchDetailsCardAndScheduleSave],
  )

  const runPosCustomerLookup = useCallback(
    async (rawPhone: string) => {
      const digits = phoneDigitsCount(buildPhoneForSave(rawPhone))
      if (digits < 11) {
        setPosCustomerData(null)
        setPosBonusBalance(null)
        setPosMaxRedemptionRate(null)
        setPosCustomerLookupDone(false)
        setSelectedSavedAddressId(null)
        setLinkedProfileId(undefined)
        return
      }
      setPosCustomerLoading(true)
      try {
        const res = await posLookupCustomer(rawPhone)
        setPosCustomerLookupDone(true)
        if (!res.ok) {
          toast.error(res.error)
          return
        }
        if (!res.customer) {
          setPosCustomerData(null)
          setPosBonusBalance(null)
          setPosMaxRedemptionRate(null)
          setLinkedProfileId(null)
          setSelectedSavedAddressId(null)
          setAddressBookMode("new")
          window.setTimeout(() => scheduleDebouncedDetailsSave(), 0)
          return
        }
        setPosCustomerData(res.customer)
        setPosBonusBalance(res.bonusBalance)
        setPosMaxRedemptionRate(res.maxRedemptionRate ?? 0.3)
        setLinkedProfileId(res.customer.profile.id)
        const nm = res.customer.profile.name?.trim()
        if (nm) {
          form.setValue("userName", nm)
          patchDetailsCardAndScheduleSave({ user_name: nm })
        }
        const addrs = res.customer.addresses
        if (addrs.length === 0) {
          setAddressBookMode("new")
          setSelectedSavedAddressId(null)
          const legacy = res.customer.profile.address?.trim()
          if (legacy) {
            form.setValue("deliveryAddress", legacy)
            patchDetailsCardAndScheduleSave({
              delivery_address: legacy,
            })
          }
          window.setTimeout(() => scheduleDebouncedDetailsSave(), 0)
          return
        }
        setAddressBookMode("saved")
        const first = addrs[0]!
        setSelectedSavedAddressId(first.id)
        applyAddressRowToForm(first)
        window.setTimeout(() => scheduleDebouncedDetailsSave(), 0)
      } finally {
        setPosCustomerLoading(false)
      }
    },
    [applyAddressRowToForm, form, patchDetailsCardAndScheduleSave, scheduleDebouncedDetailsSave],
  )

  const phoneLookupDebounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  )

  useEffect(() => {
    if (step !== 3) return
    if (!detailsFormDirty) return
    const normalizedPhone = buildPhoneForSave(userPhoneWatched)
    const digits = phoneDigitsCount(normalizedPhone)
    if (digits < 11) {
      lastCustomerLookupPhoneRef.current = null
    } else if (lastCustomerLookupPhoneRef.current === normalizedPhone) {
      return
    }
    if (phoneLookupDebounceRef.current !== undefined) {
      clearTimeout(phoneLookupDebounceRef.current)
    }
    phoneLookupDebounceRef.current = setTimeout(() => {
      phoneLookupDebounceRef.current = undefined
      lastCustomerLookupPhoneRef.current = normalizedPhone
      void runPosCustomerLookup(userPhoneWatched)
    }, 500)
    return () => {
      if (phoneLookupDebounceRef.current !== undefined) {
        clearTimeout(phoneLookupDebounceRef.current)
      }
    }
  }, [step, userPhoneWatched, detailsFormDirty, runPosCustomerLookup])

  const handleSaveNewPosCustomer = useCallback(async () => {
    const v = form.getValues()
    if (!v.userPhone.trim()) {
      toast.error("Введите телефон")
      return
    }
    if (!v.userName.trim()) {
      toast.error("Введите имя")
      return
    }
    setSaveCustomerBusy(true)
    try {
      const res = await posSaveCustomer({
        phone: v.userPhone,
        name: v.userName.trim(),
        address: v.deliveryAddress?.trim() || undefined,
      })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success("Клиент сохранён")
      setLinkedProfileId(res.profile.id)
      await runPosCustomerLookup(v.userPhone)
    } finally {
      setSaveCustomerBusy(false)
    }
  }, [form, runPosCustomerLookup])

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

      const res = await sendPosDraftToKitchen({
        orderId: posOrderId,
        bonusesToRedeem: detailsPricingRef.current.bonusesToRedeem,
        profileId:
          typeof detailsPricingRef.current.linkedProfileId === "string"
            ? detailsPricingRef.current.linkedProfileId
            : undefined,
      })
      if (!res.success) {
        toast.error(res.error)
        return
      }
      setBonusesToRedeem(0)
      setBonusRedeemFieldError(null)
      toast.success(`Заказ №${res.orderNumber} отправлен на кухню`)
      void refetchOrdersPanel().catch(() => undefined)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Не удалось отправить заказ"
      setExtendError(message)
      toast.error(message)
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

    if (values.paymentMethod === "mixed") {
      const c = values.cashAmount ?? 0
      const d = values.cardAmount ?? 0
      const target = payableAfterBonusBani
      if (c <= 0 || d <= 0 || Math.abs(c + d - target) > 1) {
        toast.error("Укажите суммы split-оплаты")
        return
      }
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

      const profileForAddr = detailsPricingRef.current.linkedProfileId
      if (
        saveNewAddressOnSubmit &&
        values.deliveryMode !== "pickup" &&
        values.deliveryMode !== "aggregator" &&
        profileForAddr &&
        addressBookMode === "new" &&
        values.deliveryAddress?.trim()
      ) {
        const geo = posDeliveryGeoRef.current
        const addrRes = await posSaveCustomerAddress({
          profileId: profileForAddr,
          address: {
            address: values.deliveryAddress.trim(),
            entrance: values.addressEntrance?.trim() || null,
            floor: values.addressFloor?.trim() || null,
            apartment: values.addressApartment?.trim() || null,
            intercom: values.addressIntercom?.trim() || null,
            delivery_lat: geo?.lat ?? null,
            delivery_lng: geo?.lng ?? null,
          },
          setAsDefault: false,
        })
        if (!addrRes.ok) {
          toast.error(addrRes.error)
        }
      }

      const res = await sendPosDraftToKitchen({
        orderId: posOrderId,
        bonusesToRedeem: detailsPricingRef.current.bonusesToRedeem,
        profileId:
          typeof detailsPricingRef.current.linkedProfileId === "string"
            ? detailsPricingRef.current.linkedProfileId
            : undefined,
      })

      if (!res.success) {
        setSubmitError(res.error)
        return
      }

      setBonusesToRedeem(0)
      setBonusRedeemFieldError(null)

      toast.success(`Заказ №${res.orderNumber} отправлен на кухню`)
      void refetchOrdersPanel().catch(() => undefined)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Не удалось отправить заказ"
      setSubmitError(message)
      toast.error(message)
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
          disabled={
            clearCartBusy ||
            deliveryModeBusy ||
            extendSubmitting ||
            submitting ||
            runnerBusy
          }
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
          disabled={deliveryMode === "delivery" || deliveryModeBusy}
          onClick={() => {
            void handleChangeDeliveryMode("delivery")
          }}
          className={cn(
            "flex w-full items-center rounded-lg px-3 py-2.5 text-left text-[13px] font-medium text-[#242424]",
            "hover:bg-[#f2f2f2] disabled:cursor-not-allowed disabled:opacity-40",
          )}
        >
          Сделать доставкой
        </button>
        <button
          type="button"
          disabled={deliveryMode === "pickup" || deliveryModeBusy}
          onClick={() => {
            void handleChangeDeliveryMode("pickup")
          }}
          className={cn(
            "flex w-full items-center rounded-lg px-3 py-2.5 text-left text-[13px] font-medium text-[#242424]",
            "hover:bg-[#f2f2f2] disabled:cursor-not-allowed disabled:opacity-40",
          )}
        >
          Сделать навыносом
        </button>
        <div className="my-1 h-px bg-[#f2f2f2]" />
        <button
          type="button"
          disabled={
            clearCartBusy ||
            deliveryModeBusy ||
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
                    setAppliedPromoCode(null)
                    setEngineOutput(null)
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
                  <span className="flex min-w-0 max-w-full items-center gap-2">
                    <span className="min-w-0 truncate text-sm font-bold text-foreground">
                      {`Заказ #${orderNumber}`}
                    </span>
                    {deliveryMode === "aggregator" ? (
                      <span className="shrink-0 rounded-md bg-orange-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                        GLOVO
                      </span>
                    ) : null}
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
              totalsSlot={
                <>
                  {brandId ? (
                    <PromoPanel
                      brandId={brandId}
                      promoSessionKey={posOrderId}
                      seedPromoCode={listOrder?.promo_code?.trim() ?? null}
                      skipSeedResolve={skipWebsitePromoSeedResolve}
                      items={cartForEngine}
                      deliveryZone={deliveryZoneForEngine}
                      excludedCategoryIds={excludedCategoryIds}
                      onDiscountChange={setEngineOutput}
                      onAppliedPromoCodeChange={setAppliedPromoCode}
                    />
                  ) : null}
                  <DiscountBreakdown
                    output={effectiveEngineOutput}
                    deliveryZone={deliveryZoneForEngine}
                    bonusRedeemedBani={redeemBaniApplied}
                    excludedCategories={excludedCategoriesInCart}
                  />
                </>
              }
              onUpdateQty={updateQty}
              onRemove={removeLine}
              onOpenLine={(idx) => void openCartLineModal(idx)}
              errorBanner={extendError}
              cartInteractionDisabled={cartInteractionDisabled}
              onCourierAssign={
                readyForCourierAssign
                  ? () => {
                      openCourierModalWithContactWarnings("assign")
                    }
                  : undefined
              }
              onPayOrder={
                showPayOrderCta ? () => setPayModalOpen(true) : undefined
              }
              payOrderDisabled={!cashSession}
              assignedCourierId={
                showPayOrderCta &&
                listOrder?.delivery_mode !== "pickup" &&
                listOrder?.courier_id
                  ? listOrder.courier_id
                  : null
              }
              assignedCourierName={
                showPayOrderCta &&
                listOrder?.delivery_mode !== "pickup" &&
                listOrder?.courier_id
                  ? listOrder.courier_name
                  : null
              }
              onChangeAssignedCourier={
                showPayOrderCta &&
                listOrder?.delivery_mode !== "pickup" &&
                listOrder?.courier_id
                  ? () => {
                      openCourierModalWithContactWarnings("reassign")
                    }
                  : undefined
              }
              courierButtonDisabled={courierButtonGate.disabled}
              courierButtonHints={courierButtonGate.hints}
              courierContactWarnings={courierContactWarnings}
              onRunnerSend={
                listOrder?.status === "draft" ||
                listOrder?.status === "new" ||
                listOrder?.status === "confirmed"
                  ? handleRunnerFromStep2
                  : undefined
              }
              runnerDisabled={
                runnerAlreadySent ||
                cart.length === 0 ||
                cartActionBusy ||
                extendSubmitting ||
                !selectedBrand ||
                !runnerHasPricedItems
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
        {orderNumber != null && (
          <AssignCourierModal
            orderId={posOrderId}
            orderNumber={orderNumber}
            mode={courierModalMode}
            currentCourierId={
              courierModalMode === "reassign"
                ? (listOrder?.courier_id ?? null)
                : null
            }
            isOpen={courierModalOpen}
            onClose={() => setCourierModalOpen(false)}
            onAssigned={(courierId, courierName) => {
              if (courierModalMode === "assign") {
                updateOrderLocalState(posOrderId, {
                  status: "delivery",
                  courier_id: courierId,
                  courier_name: courierName,
                  updated_at: new Date().toISOString(),
                })
              } else {
                updateOrderLocalState(posOrderId, {
                  courier_id: courierId,
                  courier_name: courierName,
                  updated_at: new Date().toISOString(),
                })
              }
              void refetchOrdersPanel()
            }}
          />
        )}
        {cashSession && listOrder ? (
          <PayOrderModal
            open={payModalOpen}
            orderId={posOrderId}
            orderTotal={listOrder.total}
            paymentMethod={listOrder.payment_method}
            isAggregatorOrder={listOrder.delivery_mode === "aggregator"}
            cashSessionId={cashSession.cashSessionId}
            staffId={cashSession.staffId}
            onClose={() => setPayModalOpen(false)}
            onSuccess={() => {
              setPayModalOpen(false)
              void refetchOrdersPanel()
            }}
          />
        ) : null}
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
              <span className="flex min-w-0 max-w-full items-center gap-2">
                <span className="min-w-0 truncate text-sm font-bold text-foreground">
                  {orderNumber != null
                    ? `Заказ #${orderNumber} · Детали`
                    : "Детали"}
                </span>
                {deliveryMode === "aggregator" ? (
                  <span className="shrink-0 rounded-md bg-orange-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                    GLOVO
                  </span>
                ) : null}
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
            {deliveryMode === "aggregator" ? (
              <div className="flex shrink-0 items-center justify-center gap-2 px-4 pt-4 pb-2">
                <div className="flex w-full items-center justify-center gap-2 rounded-lg bg-orange-500 px-3 py-2.5 text-white shadow-sm">
                  <Bike className="size-4 shrink-0" aria-hidden />
                  <span className="text-sm font-semibold tracking-tight">
                    🚴 Заказ Glovo
                  </span>
                </div>
              </div>
            ) : null}
            <p
              className={cn(
                "text-muted-foreground shrink-0 px-4 pb-3 text-center text-[11px] font-normal uppercase tracking-[0.08em]",
                deliveryMode === "aggregator" ? "pt-2" : "pt-4",
              )}
            >
              {deliveryMode === "aggregator"
                ? "Детали заказа Glovo"
                : "Детали заказа"}
            </p>
            <Form {...form}>
              <form
                id="pos-wizard-details-form"
                className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pb-4"
                onSubmit={onSubmit}
              >
                {deliveryMode !== "aggregator" ? (
                <>
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
                                onBlur={(e) => {
                                  field.onBlur()
                                  void runPosCustomerLookup(e.target.value)
                                }}
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="mt-2 flex min-h-5 flex-wrap items-center gap-2">
                    {posCustomerLoading ? (
                      <span className="text-[11px] text-muted-foreground">
                        Поиск клиента…
                      </span>
                    ) : null}
                    {posCustomerLookupDone &&
                    !posCustomerData &&
                    phoneDigitsCount(buildPhoneForSave(userPhoneWatched)) >=
                      11 ? (
                      <span className="rounded-md bg-[#f2f2f2] px-2 py-0.5 text-[11px] text-[#808080]">
                        Новый клиент
                      </span>
                    ) : null}
                    {posCustomerData ? (
                      <span className="text-[12px] font-bold tabular-nums text-[#242424]">
                        Бонусы: {posBonusBalance ?? 0}
                      </span>
                    ) : null}
                    {showBonusRedeemUi ? (
                      <div className="mt-2 w-full max-w-[280px] space-y-1">
                        <label
                          htmlFor="pos-bonus-redeem"
                          className="text-[11px] text-muted-foreground"
                        >
                          Списать бонусов
                        </label>
                        {!bonusRedeemTouched && posBonusRedeemAllowed ? (
                          <p className="text-[11px] text-[#808080]">
                            Можно списать до {posBonusMaxRedeemable} бонусов (
                            {Math.round((posMaxRedemptionRate ?? 0.3) * 100)}% от
                            суммы)
                          </p>
                        ) : null}
                        <Input
                          id="pos-bonus-redeem"
                          type="number"
                          min={0}
                          step={0.01}
                          inputMode="decimal"
                          className="h-8 font-mono text-xs tabular-nums"
                          value={
                            bonusesToRedeem === 0 && !bonusRedeemTouched
                              ? effectiveBonusPoints === 0
                                ? ""
                                : effectiveBonusPoints
                              : bonusesToRedeem
                          }
                          onChange={(e) =>
                            handleBonusRedeemInputChange(e.target.value)
                          }
                        />
                        {bonusRedeemFieldError ? (
                          <p className="text-[11px] text-red-600">
                            {bonusRedeemFieldError}
                          </p>
                        ) : null}
                        <p className="text-[11px] text-[#808080]">
                          К оплате: {formatMdlAmount(payableAfterBonusBani)} MDL
                          <span className="mx-1.5 opacity-50">|</span>
                          Списывается бонусов: {effectiveBonusPoints}
                        </p>
                      </div>
                    ) : null}
                    {posCustomerLookupDone &&
                    !posCustomerData &&
                    !posCustomerLoading &&
                    phoneDigitsCount(buildPhoneForSave(userPhoneWatched)) >=
                      11 ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={
                          saveCustomerBusy || !form.getValues("userName").trim()
                        }
                        className="h-7 border-[#242424]/20 text-[11px]"
                        onClick={() => void handleSaveNewPosCustomer()}
                      >
                        {saveCustomerBusy ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          "Сохранить клиента"
                        )}
                      </Button>
                    ) : null}
                  </div>

                  {deliveryMode !== "pickup" ? (
                    <>
                      {posCustomerData &&
                      posCustomerData.addresses.length > 1 &&
                      addressBookMode === "saved" ? (
                        <div className="mt-3 space-y-1.5">
                          <p className="text-xs text-muted-foreground">
                            Сохранённые адреса
                          </p>
                          <Select
                            value={selectedSavedAddressId ?? ""}
                            onValueChange={(id) => {
                              if (id === "__new__") {
                                setAddressBookMode("new")
                                setSelectedSavedAddressId(null)
                                setSaveNewAddressOnSubmit(false)
                                form.setValue("deliveryAddress", "")
                                form.setValue("addressEntrance", "")
                                form.setValue("addressFloor", "")
                                form.setValue("addressApartment", "")
                                form.setValue("addressIntercom", "")
                                patchDetailsCardAndScheduleSave({
                                  delivery_address: null,
                                  address_entrance: null,
                                  address_floor: null,
                                  address_apartment: null,
                                  address_intercom: null,
                                })
                                return
                              }
                              const row = posCustomerData.addresses.find(
                                (a) => a.id === id,
                              )
                              if (row) {
                                setSelectedSavedAddressId(id)
                                setAddressBookMode("saved")
                                setSaveNewAddressOnSubmit(false)
                                applyAddressRowToForm(row)
                              }
                            }}
                          >
                            <SelectTrigger className="h-9 w-full text-left text-sm">
                              <SelectValue placeholder="Выберите адрес" />
                            </SelectTrigger>
                            <SelectContent>
                              {posCustomerData.addresses.map((a) => (
                                <SelectItem key={a.id} value={a.id}>
                                  {a.label
                                    ? `${a.label} — ${a.address}`
                                    : a.address}
                                </SelectItem>
                              ))}
                              <SelectItem value="__new__">+ Новый адрес</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      ) : null}
                      {posCustomerData &&
                      posCustomerData.addresses.length === 1 &&
                      addressBookMode === "saved" ? (
                        <p className="mt-2 text-[11px] text-[#808080]">
                          Адрес из профиля клиента (можно изменить)
                        </p>
                      ) : null}
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
                      {typeof linkedProfileId === "string" &&
                      addressBookMode === "new" ? (
                        <div className="mt-3 flex items-center gap-2">
                          <Checkbox
                            id="pos-save-new-address"
                            checked={saveNewAddressOnSubmit}
                            onCheckedChange={(c) =>
                              setSaveNewAddressOnSubmit(c === true)
                            }
                          />
                          <label
                            htmlFor="pos-save-new-address"
                            className="cursor-pointer text-xs text-[#808080]"
                          >
                            Сохранить адрес
                          </label>
                        </div>
                      ) : null}
                      <DeliveryZoneInfo
                        result={zoneResult}
                        checking={zoneChecking}
                        subtotalBani={effectiveEngineOutput.discountedSubtotalBani}
                      />
                    </>
                  ) : null}

                </FormSection>
                </>
                ) : null}

                {/* ── Метод оплаты ── */}
                <FormField
                  control={form.control}
                  name="paymentMethod"
                  render={({ field }) => (
                    <FormSection title="Метод оплаты">
                      {deliveryMode === "aggregator" ? (
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
                            label="Наличные"
                          />
                          <ModeButton
                            active={field.value === "aggregator_card"}
                            onClick={() => {
                              field.onChange("aggregator_card")
                              clearDetailsDebounce()
                              window.setTimeout(() => {
                                void runDetailsSaveToServer()
                              }, 0)
                            }}
                            icon={<CreditCard className="size-4 shrink-0" />}
                            label="Карта Glovo"
                          />
                        </div>
                      ) : (
                        <>
                          <div className="grid grid-cols-3 gap-2">
                            <ModeButton
                              active={field.value === "cash"}
                              onClick={() => {
                                field.onChange("cash")
                                form.setValue("cashAmount", null)
                                form.setValue("cardAmount", null)
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
                                form.setValue("cashAmount", null)
                                form.setValue("cardAmount", null)
                                clearDetailsDebounce()
                                window.setTimeout(() => {
                                  void runDetailsSaveToServer()
                                }, 0)
                              }}
                              icon={<CreditCard className="size-4 shrink-0" />}
                              label="Картой курьеру"
                            />
                            <ModeButton
                              active={field.value === "mixed"}
                              onClick={() => {
                                field.onChange("mixed")
                                clearDetailsDebounce()
                              }}
                              icon={<Layers className="size-4 shrink-0" />}
                              label="Разделить"
                              hideLabel
                            />
                          </div>
                          {paymentMethod === "mixed"
                            ? (() => {
                                const totalBaniSplit = payableAfterBonusBani
                                const totalMdl = Math.round(
                                  totalBaniSplit / 100,
                                )
                                const cashAmountMdl = Math.round(
                                  (cashAmountWatched ?? 0) / 100,
                                )
                                const cardAmountMdl = Math.round(
                                  (cardAmountWatched ?? 0) / 100,
                                )
                                return (
                                  <div className="mt-3 flex flex-col gap-2 rounded-lg bg-muted/50 p-3">
                                    <div className="flex items-center gap-3">
                                      <span className="w-28 shrink-0 text-sm text-muted-foreground">
                                        💵 Наличными
                                      </span>
                                      <Input
                                        type="number"
                                        min={0}
                                        max={totalMdl}
                                        value={
                                          cashAmountMdl === 0 &&
                                          (cashAmountWatched == null ||
                                            cashAmountWatched === 0)
                                            ? ""
                                            : cashAmountMdl
                                        }
                                        onChange={(e) => {
                                          const val = Math.max(
                                            0,
                                            Math.min(
                                              totalMdl,
                                              Number(e.target.value) || 0,
                                            ),
                                          )
                                          form.setValue("cashAmount", val * 100)
                                          form.setValue(
                                            "cardAmount",
                                            totalBaniSplit - val * 100,
                                          )
                                          clearDetailsDebounce()
                                          window.setTimeout(() => {
                                            void runDetailsSaveToServer()
                                          }, 0)
                                        }}
                                        className="h-8 w-24"
                                        placeholder="0"
                                      />
                                      <span className="text-sm text-muted-foreground">
                                        MDL
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                      <span className="w-28 shrink-0 text-sm text-muted-foreground">
                                        💳 Картой
                                      </span>
                                      <Input
                                        type="number"
                                        min={0}
                                        max={totalMdl}
                                        value={
                                          cardAmountMdl === 0 &&
                                          (cardAmountWatched == null ||
                                            cardAmountWatched === 0)
                                            ? ""
                                            : cardAmountMdl
                                        }
                                        onChange={(e) => {
                                          const val = Math.max(
                                            0,
                                            Math.min(
                                              totalMdl,
                                              Number(e.target.value) || 0,
                                            ),
                                          )
                                          form.setValue("cardAmount", val * 100)
                                          form.setValue(
                                            "cashAmount",
                                            totalBaniSplit - val * 100,
                                          )
                                          clearDetailsDebounce()
                                          window.setTimeout(() => {
                                            void runDetailsSaveToServer()
                                          }, 0)
                                        }}
                                        className="h-8 w-24"
                                        placeholder="0"
                                      />
                                      <span className="text-sm text-muted-foreground">
                                        MDL
                                      </span>
                                    </div>
                                    {cashAmountMdl + cardAmountMdl !==
                                      totalMdl && (
                                      <p className="text-xs text-destructive">
                                        Сумма должна быть {totalMdl} MDL (сейчас{" "}
                                        {cashAmountMdl + cardAmountMdl} MDL)
                                      </p>
                                    )}
                                  </div>
                                )
                              })()
                            : null}
                        </>
                      )}

                      {paymentMethod === "cash" &&
                      deliveryMode !== "aggregator" ? (
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
                  <FormField
                    control={form.control}
                    name="comment"
                    render={({ field }) => (
                      <FormItem>
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
              <div className="space-y-3">
                {brandId ? (
                  <PromoPanel
                    brandId={brandId}
                    promoSessionKey={posOrderId}
                    seedPromoCode={listOrder?.promo_code?.trim() ?? null}
                    skipSeedResolve={skipWebsitePromoSeedResolve}
                    items={cartForEngine}
                    deliveryZone={deliveryZoneForEngine}
                    excludedCategoryIds={excludedCategoryIds}
                    onDiscountChange={setEngineOutput}
                    onAppliedPromoCodeChange={setAppliedPromoCode}
                  />
                ) : null}
                <DiscountBreakdown
                  output={effectiveEngineOutput}
                  deliveryZone={deliveryZoneForEngine}
                  bonusRedeemedBani={redeemBaniApplied}
                  excludedCategories={excludedCategoriesInCart}
                />
              </div>
              {showPayOrderCta ? (
                <button
                  type="button"
                  disabled={!cashSession}
                  onClick={() => setPayModalOpen(true)}
                  className={cn("mt-3", POS_RUNNER_CTA_CLASS)}
                >
                  Принять оплату
                </button>
              ) : listOrder?.status === "draft" ||
                listOrder?.status === "new" ||
                listOrder?.status === "confirmed" ? (
                <button
                  type="submit"
                  form="pos-wizard-details-form"
                  disabled={
                    runnerAlreadySent ||
                    submitting ||
                    cartActionBusy ||
                    !runnerHasPricedItems
                  }
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
              ) : null}
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
      {cashSession && listOrder ? (
        <PayOrderModal
          open={payModalOpen}
          orderId={posOrderId}
          orderTotal={listOrder.total}
          paymentMethod={listOrder.payment_method}
          isAggregatorOrder={listOrder.delivery_mode === "aggregator"}
          cashSessionId={cashSession.cashSessionId}
          staffId={cashSession.staffId}
          onClose={() => setPayModalOpen(false)}
          onSuccess={() => {
            setPayModalOpen(false)
            void refetchOrdersPanel()
          }}
        />
      ) : null}
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
  hideLabel,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
  /** Только иконка (подпись в aria-label и title). */
  hideLabel?: boolean
}) {
  const densityClass = hideLabel
    ? "px-3"
    : "gap-2 px-4"

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={hideLabel ? label : undefined}
      title={hideLabel ? label : undefined}
      className={`flex items-center justify-center rounded-lg py-3 text-sm font-bold transition-colors ${densityClass} ${
        active
          ? "bg-foreground text-background"
          : "bg-muted text-muted-foreground hover:bg-[#e8e8e8] hover:text-foreground"
      }`}
    >
      {icon}
      {hideLabel ? null : label}
    </button>
  )
}
