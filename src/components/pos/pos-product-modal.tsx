"use client"

import { PosHeaderIconButton } from "@/components/pos/pos-header-icon-button"
import { ToppingStepperCard } from "@/components/topping-stepper-card"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { discountRateFromEffectValue } from "@/lib/discount"
import { isRuleScheduleActive } from "@/lib/discount-engine"
import { calcPosToppingsCharge, getPosCartItemUnitPriceBani } from "@/lib/pos-cart-helpers"
import {
  cartToppingFromTopping,
  getTotalQuantityInGroup,
  posAddTopping,
  posRemoveTopping,
  migratePosCartToppingsFromLegacy,
} from "@/lib/pos-cart-toppings"
import {
  formatStorefrontToppingGroupHeader,
  getFreeUnitsRemaining,
} from "@/lib/topping-pricing"
import type { MenuItem, MenuItemVariant } from "@/types/database"
import type { PosCartItem, PosCartTopping } from "@/types/pos"
import type { DiscountRule } from "@/types/promotions"
import { createBrowserClient } from "@supabase/ssr"
import { Loader2, XIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import Image from "next/image"
import { useCallback, useEffect, useMemo, useState } from "react"

/** Поля меню, нужные для модалки POS (совместимо с выборкой из `menu_items`). */
export type PosProductModalMenuItem = Pick<
  MenuItem,
  | "id"
  | "category_id"
  | "name_ru"
  | "description_ru"
  | "image_url"
  | "has_sizes"
  | "price"
  | "aggregator_price_bani"
> & {
  variants?: MenuItemVariant[] | null
}

type UiTopping = {
  id: string
  name_ru: string
  name_ro: string
  price: number
  aggregator_price_bani: number | null
  image_url: string | null
  group_id: string
}

type UiGroup = {
  id: string
  name_ru: string
  sort_order: number
  max_selections: number | null
  free_count: number
  toppings: UiTopping[]
}

function formatLei(bani: number): string {
  return (bani / 100).toLocaleString("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function itemPercentDisplayPriceBani(
  menuItemId: string,
  variantPriceBani: number,
  discountRules: DiscountRule[],
  now: Date = new Date(),
): number {
  const rule = [...discountRules]
    .sort((a, b) => b.priority - a.priority)
    .find(
      (r) =>
        r.effect_type === "item_percent" &&
        r.effect_value != null &&
        isRuleScheduleActive(r, now) &&
        r.target_item_ids?.includes(menuItemId),
    )
  if (rule?.effect_value != null) {
    const rate = discountRateFromEffectValue(rule.effect_value)
    return Math.round(variantPriceBani * (1 - rate))
  }
  return variantPriceBani
}

function resolvePosCatalogUnitPriceBani(
  catalogPrice: number,
  aggregatorPrice: number | null | undefined,
  isAggregator: boolean,
): number {
  if (isAggregator && aggregatorPrice != null) return aggregatorPrice
  return catalogPrice
}

function normalizeOne<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null
  return Array.isArray(v) ? (v[0] ?? null) : v
}

function sortVariantsPos(list: MenuItemVariant[]): MenuItemVariant[] {
  return [...list].sort(
    (a, b) =>
      a.sort_order - b.sort_order || a.name_ru.localeCompare(b.name_ru),
  )
}

/** Выбор варианта по данным строки заказа / корзины. */
function resolvePosVariantSelection(
  rows: MenuItemVariant[],
  variantId: string | null | undefined,
  sizeSnap: string | null | undefined,
): string | null {
  if (rows.length === 0) return null
  if (variantId && rows.some((v) => v.id === variantId)) return variantId
  const s = sizeSnap?.toLowerCase()?.trim()
  if (s === "s") return rows[0]!.id
  if (s === "l") return rows[Math.min(1, rows.length - 1)]!.id
  const raw = sizeSnap?.trim()
  if (raw) {
    const byName = rows.find(
      (v) =>
        v.name_ru.trim() === raw ||
        v.name_ro.trim() === raw,
    )
    if (byName) return byName.id
  }
  return rows[0]!.id
}

/** Предзаполнение при редактировании уже сохранённой строки заказа в POS. */
export type PosProductModalEditDraft = {
  orderItemId: string
  qty: number
  size: string | null
  variantId: string | null
  toppings: PosCartTopping[]
}

/** Предзаполнение при правке позиции в корзине (создание заказа POS). */
export type PosProductModalCartEditDraft = {
  cartIndex: number
  qty: number
  size: string | null
  variantId: string | null
  toppings: PosCartTopping[]
}

type PosProductModalProps = {
  item: PosProductModalMenuItem | null
  onClose: () => void
  onAdd: (cartItem: PosCartItem) => void
  isAggregator?: boolean
  /** Если задано — режим правки строки заказа. */
  editDraft?: PosProductModalEditDraft | null
  /** Сохранение состава строки (асинхронно, ошибки см. родитель). */
  onEditSave?: (orderItemId: string, cartItem: PosCartItem) => Promise<void>
  /** Режим правки строки корзины на шаге меню / оформления. */
  cartEditDraft?: PosProductModalCartEditDraft | null
  onCartEditSave?: (
    cartIndex: number,
    cartItem: PosCartItem,
  ) => void | Promise<void>
  discountRules?: DiscountRule[]
}

export function PosProductModal({
  item,
  onClose,
  onAdd,
  isAggregator = false,
  editDraft,
  onEditSave,
  cartEditDraft,
  onCartEditSave,
  discountRules = [],
}: PosProductModalProps) {
  const [qty, setQty] = useState(1)
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(
    null,
  )
  const [variantRows, setVariantRows] = useState<MenuItemVariant[]>([])
  const [cartToppings, setCartToppings] = useState<PosCartTopping[]>([])
  const [groups, setGroups] = useState<UiGroup[]>([])
  const [groupsLoading, setGroupsLoading] = useState(false)
  const [groupsError, setGroupsError] = useState<string | null>(null)
  const [editSaving, setEditSaving] = useState(false)
  const [editSaveError, setEditSaveError] = useState<string | null>(null)

  const sortedVariants = useMemo(
    () => sortVariantsPos(variantRows),
    [variantRows],
  )

  const isOrderLineEdit = Boolean(editDraft && onEditSave)
  const isCartEdit = Boolean(cartEditDraft && onCartEditSave)
  const isEditMode = isOrderLineEdit || isCartEdit

  useEffect(() => {
    setEditSaveError(null)
    if (!item) return

    const fromItem = sortVariantsPos(item.variants ?? [])

    if (editDraft && isOrderLineEdit) {
      setQty(editDraft.qty)
      if (fromItem.length > 0) {
        setSelectedVariantId(
          resolvePosVariantSelection(
            fromItem,
            editDraft.variantId,
            editDraft.size,
          ),
        )
      }
      setCartToppings(migratePosCartToppingsFromLegacy(editDraft.toppings))
    } else if (cartEditDraft && isCartEdit) {
      setQty(cartEditDraft.qty)
      if (fromItem.length > 0) {
        setSelectedVariantId(
          resolvePosVariantSelection(
            fromItem,
            cartEditDraft.variantId,
            cartEditDraft.size,
          ),
        )
      }
      setCartToppings(migratePosCartToppingsFromLegacy(cartEditDraft.toppings))
    } else {
      setQty(1)
      if (fromItem.length > 0) {
        setSelectedVariantId(fromItem[0]!.id)
      } else setSelectedVariantId(null)
      setCartToppings([])
      setGroups([])
      setGroupsError(null)
    }
  }, [item, editDraft, cartEditDraft, isOrderLineEdit, isCartEdit])

  /** Когда строки заказа пришли с сервера без embed вариантов — подстройка после fetch. */
  useEffect(() => {
    if (!item?.has_sizes || sortedVariants.length === 0) return
    if (!(editDraft && isOrderLineEdit) && !(cartEditDraft && isCartEdit))
      return
    if (editDraft && isOrderLineEdit) {
      setSelectedVariantId(
        resolvePosVariantSelection(
          sortedVariants,
          editDraft.variantId,
          editDraft.size,
        ),
      )
      return
    }
    if (cartEditDraft && isCartEdit) {
      setSelectedVariantId(
        resolvePosVariantSelection(
          sortedVariants,
          cartEditDraft.variantId,
          cartEditDraft.size,
        ),
      )
    }
  }, [
    item?.has_sizes,
    sortedVariants,
    editDraft,
    cartEditDraft,
    isOrderLineEdit,
    isCartEdit,
  ])

  useEffect(() => {
    if (!item) return
    const draft =
      editDraft && isOrderLineEdit
        ? editDraft
        : cartEditDraft && isCartEdit
          ? cartEditDraft
          : null
    if (!draft || (!isOrderLineEdit && !isCartEdit) || groupsLoading || groups.length === 0) {
      return
    }

    const metaById = new Map<string, UiTopping>()
    for (const g of groups) {
      for (const t of g.toppings) metaById.set(t.id, t)
    }

    const rebuilt: PosCartTopping[] = []
    for (const d of migratePosCartToppingsFromLegacy(draft.toppings)) {
      const meta =
        d.id && !d.id.startsWith("legacy-")
          ? metaById.get(d.id)
          : [...metaById.values()].find((m) => m.name_ru === d.name_ru)
      if (!meta) continue
      const existing = rebuilt.find((x) => x.id === meta.id)
      if (existing) {
        existing.quantity += d.quantity
      } else {
        rebuilt.push({
          ...cartToppingFromTopping({
            id: meta.id,
            name_ru: meta.name_ru,
            name_ro: meta.name_ro,
            price: meta.price,
            aggregator_price_bani: meta.aggregator_price_bani,
            topping_group_id: meta.group_id,
          }),
          quantity: d.quantity,
        })
      }
    }
    setCartToppings(rebuilt)
  }, [
    item,
    editDraft,
    cartEditDraft,
    isOrderLineEdit,
    isCartEdit,
    groupsLoading,
    groups,
  ])

  useEffect(() => {
    if (!item) {
      setGroups([])
      setVariantRows([])
      setGroupsLoading(false)
      return
    }

    let cancelled = false
    setGroupsLoading(true)
    setGroupsError(null)

    setVariantRows(
      item.variants?.length ? sortVariantsPos(item.variants) : [],
    )

    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )

    void (async () => {
      const [vRes, toppingsRes] = await Promise.all([
        supabase
          .from("menu_item_variants")
          .select("*")
          .eq("menu_item_id", item.id)
          .order("sort_order", { ascending: true }),
        supabase
          .from("menu_item_topping_groups")
          .select(
            "free_count, topping_groups(id, name_ru, sort_order, max_selections, toppings(id, name_ru, name_ro, price, aggregator_price_bani, image_url, is_active, sort_order))",
          )
          .eq("menu_item_id", item.id),
      ])

      if (cancelled) return
      setGroupsLoading(false)

      if (!vRes.error && Array.isArray(vRes.data) && vRes.data.length > 0) {
        setVariantRows(vRes.data as MenuItemVariant[])
      } else if (!item.variants?.length) {
        setVariantRows([])
      }

      if (toppingsRes.error) {
        setGroupsError(toppingsRes.error.message)
        setGroups([])
        return
      }

      const rows = (toppingsRes.data ?? []) as Array<{
        free_count?: number | null
        topping_groups:
          | {
              id: string
              name_ru: string
              sort_order: number | null
              max_selections: number | null
              toppings: Array<{
                id: string
                name_ru: string
                name_ro: string | null
                price: number
                aggregator_price_bani: number | null
                image_url: string | null
                is_active: boolean | null
                sort_order: number | null
              }> | null
            }
          | Array<{
              id: string
              name_ru: string
              sort_order: number | null
              max_selections: number | null
              toppings: Array<{
                id: string
                name_ru: string
                name_ro: string | null
                price: number
                aggregator_price_bani: number | null
                image_url: string | null
                is_active: boolean | null
                sort_order: number | null
              }> | null
            }>
          | null
      }>

      const nextGroups: UiGroup[] = []
      for (const row of rows) {
        const g = normalizeOne(row.topping_groups)
        if (!g?.id) continue
        const freeCount =
          typeof row.free_count === "number" && Number.isFinite(row.free_count)
            ? Math.max(0, Math.floor(row.free_count))
            : 0
        const rawTops = g.toppings ?? []
        const toppings: UiTopping[] = rawTops
          .filter((t) => t.is_active !== false)
          .sort(
            (a, b) =>
              (a.sort_order ?? 0) - (b.sort_order ?? 0) ||
              a.name_ru.localeCompare(b.name_ru),
          )
          .map((t) => ({
            id: t.id,
            name_ru: t.name_ru,
            name_ro: t.name_ro?.trim() || t.name_ru,
            price: Math.round(t.price ?? 0),
            aggregator_price_bani:
              t.aggregator_price_bani != null
                ? Math.round(t.aggregator_price_bani)
                : null,
            image_url: t.image_url ?? null,
            group_id: g.id,
          }))
        if (toppings.length) {
          nextGroups.push({
            id: g.id,
            name_ru: g.name_ru,
            sort_order: g.sort_order ?? 0,
            max_selections: g.max_selections ?? null,
            free_count: freeCount,
            toppings,
          })
        }
      }
      nextGroups.sort(
        (a, b) =>
          a.sort_order - b.sort_order || a.name_ru.localeCompare(b.name_ru),
      )
      setGroups(nextGroups)
    })()

    return () => {
      cancelled = true
    }
  }, [item])

  const sizeUnitBani = useMemo(() => {
    if (!item) return 0
    if (!item.has_sizes || sortedVariants.length === 0) {
      return resolvePosCatalogUnitPriceBani(
        item.price ?? 0,
        item.aggregator_price_bani,
        isAggregator,
      )
    }
    if (!selectedVariantId) return 0
    const v = sortedVariants.find((x) => x.id === selectedVariantId)
    if (!v) {
      return resolvePosCatalogUnitPriceBani(
        item.price ?? 0,
        item.aggregator_price_bani,
        isAggregator,
      )
    }
    return resolvePosCatalogUnitPriceBani(
      v.price,
      v.aggregator_price_bani,
      isAggregator,
    )
  }, [item, sortedVariants, selectedVariantId, isAggregator])

  const toppingGroupFreeCounts = useMemo(
    () => Object.fromEntries(groups.map((g) => [g.id, g.free_count])),
    [groups],
  )

  const toppingsUnitBani = useMemo(
    () => calcPosToppingsCharge(cartToppings, toppingGroupFreeCounts, isAggregator),
    [cartToppings, toppingGroupFreeCounts, isAggregator],
  )

  const unitTotalBani = sizeUnitBani + toppingsUnitBani
  const lineTotalBani = unitTotalBani * qty

  const handleToppingAdd = useCallback((group: UiGroup, topping: UiTopping) => {
    setCartToppings((prev) =>
      posAddTopping(
        prev,
        {
          id: topping.id,
          name_ru: topping.name_ru,
          name_ro: topping.name_ro,
          price: topping.price,
          aggregator_price_bani: topping.aggregator_price_bani,
          topping_group_id: group.id,
        },
        group.toppings.map((x) => x.id),
        group.max_selections,
      ),
    )
  }, [])

  const handleToppingRemove = useCallback((toppingId: string) => {
    setCartToppings((prev) => posRemoveTopping(prev, toppingId))
  }, [])

  const canAdd =
    item &&
    (!item.has_sizes ||
      sortedVariants.length === 0 ||
      selectedVariantId !== null) &&
    unitTotalBani > 0

  const handlePrimaryAction = async () => {
    if (!item || !canAdd || editSaving) return
    let sizeSnap: string | null = null
    let vid: string | null = null
    if (item.has_sizes && sortedVariants.length > 0 && selectedVariantId) {
      const vsel = sortedVariants.find((x) => x.id === selectedVariantId)
      vid = selectedVariantId
      sizeSnap = vsel?.name_ru.trim() ?? null
    }
    const selectedVariant =
      item.has_sizes && sortedVariants.length > 0 && selectedVariantId
        ? sortedVariants.find((x) => x.id === selectedVariantId)
        : null
    const aggregatorUnitPriceBani =
      !item.has_sizes || sortedVariants.length === 0
        ? (item.aggregator_price_bani ?? undefined)
        : (selectedVariant?.aggregator_price_bani ?? undefined)
    const payload: PosCartItem = {
      menuItemId: item.id,
      category_id: item.category_id,
      name: item.name_ru,
      size: sizeSnap,
      variantId: vid,
      price: unitTotalBani,
      aggregatorUnitPriceBani,
      qty,
      imageUrl: item.image_url ?? undefined,
      toppings: cartToppings,
      toppingGroupFreeCounts,
    }
    if (isAggregator && aggregatorUnitPriceBani != null) {
      payload.price = getPosCartItemUnitPriceBani(payload, true)
    }
    if (isOrderLineEdit && editDraft && onEditSave) {
      setEditSaving(true)
      setEditSaveError(null)
      try {
        await onEditSave(editDraft.orderItemId, payload)
        onClose()
      } catch (err) {
        setEditSaveError(
          err instanceof Error ? err.message : "Не удалось сохранить",
        )
      } finally {
        setEditSaving(false)
      }
      return
    }
    if (isCartEdit && cartEditDraft && onCartEditSave) {
      setEditSaving(true)
      setEditSaveError(null)
      try {
        await onCartEditSave(cartEditDraft.cartIndex, payload)
        onClose()
      } catch (err) {
        setEditSaveError(
          err instanceof Error ? err.message : "Не удалось сохранить",
        )
      } finally {
        setEditSaving(false)
      }
      return
    }
    onAdd(payload)
    onClose()
  }

  return (
    <Dialog open={item !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="flex max-h-[min(90dvh,720px)] max-w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-md"
      >
        {item ? (
          <>
            <DialogClose asChild>
              <PosHeaderIconButton
                className="absolute top-3 right-3 z-10"
                aria-label="Закрыть"
              >
                <XIcon className="size-5" />
              </PosHeaderIconButton>
            </DialogClose>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-4 pb-2">
              {item.image_url ? (
                <div className="bg-muted relative mx-auto mb-3 aspect-square w-full max-w-[280px] overflow-hidden rounded-xl">
                  <Image
                    src={item.image_url}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 280px, 280px"
                  />
                </div>
              ) : null}
              <DialogHeader className="text-left">
                <DialogTitle className="text-lg font-semibold">
                  {item.name_ru}
                </DialogTitle>
              </DialogHeader>
              {item.description_ru?.trim() ? (
                <p className="text-muted-foreground mt-1 text-sm">
                  {item.description_ru}
                </p>
              ) : null}
              <p className="text-muted-foreground mt-2 text-sm">
                {!item.has_sizes
                  ? `${formatLei(item.price ?? 0)} MDL`
                  : sortedVariants.length === 0
                    ? `${formatLei(item.price ?? 0)} MDL`
                    : `от ${formatLei(
                        Math.min(...sortedVariants.map((v) => v.price)),
                      )} MDL`}
              </p>

              {item.has_sizes && sortedVariants.length > 0 ? (
                <div className="mt-4 flex flex-col gap-3 min-[380px]:grid min-[380px]:grid-cols-2 min-[380px]:gap-4">
                  {sortedVariants.map((v) => (
                    <Button
                      key={v.id}
                      type="button"
                      variant={selectedVariantId === v.id ? "default" : "outline"}
                      className="h-auto min-h-14 w-full min-w-0 justify-center whitespace-normal px-3 py-3 text-center text-sm leading-snug sm:min-h-[3.25rem] sm:text-base"
                      onClick={() => setSelectedVariantId(v.id)}
                    >
                      {v.name_ru} —{" "}
                      {(
                        itemPercentDisplayPriceBani(item.id, v.price, discountRules) /
                        100
                      ).toFixed(2)}{" "}
                      MDL
                    </Button>
                  ))}
                </div>
              ) : null}

              {groupsLoading ? (
                <div className="text-muted-foreground mt-4 flex items-center gap-2 text-sm">
                  <Loader2 className="size-4 animate-spin" />
                  Загрузка добавок…
                </div>
              ) : null}
              {groupsError ? (
                <p className="text-destructive mt-2 text-sm">{groupsError}</p>
              ) : null}

              {!groupsLoading && groups.length > 0
                ? groups.map((g) => {
                    const groupToppingIds = g.toppings.map((x) => x.id)
                    const selectedInGroup = getTotalQuantityInGroup(
                      cartToppings,
                      groupToppingIds,
                    )
                    const groupSelections = cartToppings
                      .filter((t) => groupToppingIds.includes(t.id))
                      .map((t) => ({
                        id: t.id,
                        price: t.price,
                        quantity: t.quantity,
                      }))
                    const freeUnitsRemaining = getFreeUnitsRemaining(
                      groupSelections,
                      g.free_count,
                    )
                    const groupLimitReached =
                      g.max_selections != null &&
                      selectedInGroup >= g.max_selections
                    const headerText =
                      g.free_count > 0
                        ? formatStorefrontToppingGroupHeader({
                            lang: "RU",
                            groupName: g.name_ru,
                            selectedCount: selectedInGroup,
                            maxSelections: g.max_selections,
                            freeCount: g.free_count,
                            selections: groupSelections,
                          })
                        : g.max_selections != null
                          ? `${g.name_ru} — выбрано ${selectedInGroup} из ${g.max_selections}`
                          : g.name_ru
                    const headerParts = headerText.split(" · ")
                    const headerTitle = headerParts[0] ?? headerText
                    const headerFreePart =
                      headerParts.length > 1 ? headerParts.slice(1).join(" · ") : null

                    return (
                      <div key={g.id} className="mt-4 space-y-1">
                        <p className="text-[13px] font-semibold leading-snug">
                          <span
                            className={cn(
                              groupLimitReached
                                ? "text-[#ccff00]"
                                : "text-[#242424]",
                            )}
                          >
                            {headerTitle}
                          </span>
                          {headerFreePart ? (
                            <>
                              {" · "}
                              <span className="text-[#4CAF50]">
                                {headerFreePart}
                              </span>
                            </>
                          ) : null}
                        </p>
                        <div
                          className={cn(
                            "grid grid-cols-4 gap-2",
                            g.toppings.length > 8 &&
                              "max-h-[320px] overflow-y-auto pr-1",
                          )}
                        >
                          {g.toppings.map((t) => {
                            const quantity =
                              cartToppings.find((x) => x.id === t.id)?.quantity ??
                              0
                            const addDisabled = groupLimitReached
                            const priceIsFree =
                              g.free_count > 0 && freeUnitsRemaining > 0
                            const priceLabel = priceIsFree
                              ? "Бесплатно"
                              : t.price > 0
                                ? `${formatLei(t.price)} MDL`
                                : "Бесплатно"

                            return (
                              <ToppingStepperCard
                                key={t.id}
                                variant="pos"
                                imageUrl={t.image_url}
                                name={t.name_ru}
                                quantity={quantity}
                                priceLabel={priceLabel}
                                priceIsFree={priceIsFree}
                                addDisabled={addDisabled}
                                onAdd={() => handleToppingAdd(g, t)}
                                onRemove={() => handleToppingRemove(t.id)}
                              />
                            )
                          })}
                        </div>
                      </div>
                    )
                  })
                : null}

              <div className="mt-5 flex items-center justify-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-10 min-h-10 min-w-10 shrink-0 rounded-full text-base"
                  aria-label="Меньше"
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                >
                  −
                </Button>
                <span className="w-10 min-w-10 text-center text-lg font-bold tabular-nums">
                  {qty}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-10 min-h-10 min-w-10 shrink-0 rounded-full text-base"
                  aria-label="Больше"
                  onClick={() => setQty((q) => q + 1)}
                >
                  +
                </Button>
              </div>
            </div>

            {isEditMode && editSaveError ? (
              <p className="text-destructive shrink-0 px-4 pt-2 pb-1 text-center text-sm">
                {editSaveError}
              </p>
            ) : null}

            <DialogFooter className="mx-0 mb-0 mt-0 shrink-0 border-t bg-background px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:flex-col">
              <Button
                type="button"
                className="inline-flex h-12 min-h-12 w-full items-center justify-center text-[15px]"
                disabled={!canAdd || editSaving}
                onClick={() => void handlePrimaryAction()}
              >
                {editSaving ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Сохранение…
                  </>
                ) : isEditMode ? (
                  `Сохранить — ${formatLei(lineTotalBani)} MDL`
                ) : (
                  `Добавить в заказ — ${formatLei(lineTotalBani)} MDL`
                )}
              </Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
