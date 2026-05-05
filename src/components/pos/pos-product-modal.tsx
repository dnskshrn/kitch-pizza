"use client"

import { PosHeaderIconButton } from "@/components/pos/pos-header-icon-button"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { MenuItem, MenuItemVariant } from "@/types/database"
import type { PosCartItem } from "@/types/pos"
import { createBrowserClient } from "@supabase/ssr"
import { Loader2, XIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { nextSelectedByGroupWithCap } from "@/lib/topping-max-selection"
import Image from "next/image"
import { useEffect, useMemo, useState } from "react"

/** Поля меню, нужные для модалки POS (совместимо с выборкой из `menu_items`). */
export type PosProductModalMenuItem = Pick<
  MenuItem,
  "id" | "name_ru" | "description_ru" | "image_url" | "has_sizes" | "price"
> & {
  variants?: MenuItemVariant[] | null
}

type UiTopping = {
  id: string
  name_ru: string
  price: number
  image_url: string | null
}

type UiGroup = {
  id: string
  name_ru: string
  sort_order: number
  max_selections: number | null
  toppings: UiTopping[]
}

function formatLei(bani: number): string {
  return (bani / 100).toLocaleString("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
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
  toppings: { name: string; price: number }[]
}

/** Предзаполнение при правке позиции в корзине (создание заказа POS). */
export type PosProductModalCartEditDraft = {
  cartIndex: number
  qty: number
  size: string | null
  variantId: string | null
  toppings: { name: string; price: number }[]
}

type PosProductModalProps = {
  item: PosProductModalMenuItem | null
  onClose: () => void
  onAdd: (cartItem: PosCartItem) => void
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
}

export function PosProductModal({
  item,
  onClose,
  onAdd,
  editDraft,
  onEditSave,
  cartEditDraft,
  onCartEditSave,
}: PosProductModalProps) {
  const [qty, setQty] = useState(1)
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(
    null,
  )
  const [variantRows, setVariantRows] = useState<MenuItemVariant[]>([])
  const [selectedByGroup, setSelectedByGroup] = useState<Record<string, string[]>>(
    {},
  )
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

    let fromItem = sortVariantsPos(item.variants ?? [])

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
      setSelectedByGroup({})
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
      setSelectedByGroup({})
    } else {
      setQty(1)
      if (fromItem.length > 0) {
        setSelectedVariantId(fromItem[0]!.id)
      } else setSelectedVariantId(null)
      setSelectedByGroup({})
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
    const next: Record<string, string[]> = {}
    const snapNames = draft.toppings.map((t) => t.name)
    for (const g of groups) {
      const ids = g.toppings
        .filter((t) => snapNames.includes(t.name_ru))
        .map((t) => t.id)
      if (ids.length > 0) next[g.id] = ids
    }
    setSelectedByGroup(next)
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
            "topping_groups(id, name_ru, sort_order, max_selections, toppings(id, name_ru, price, image_url, is_active, sort_order))",
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
        topping_groups:
          | {
              id: string
              name_ru: string
              sort_order: number | null
              max_selections: number | null
              toppings: Array<{
                id: string
                name_ru: string
                price: number
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
                price: number
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
            price: Math.round(t.price ?? 0),
            image_url: t.image_url ?? null,
          }))
        if (toppings.length) {
          nextGroups.push({
            id: g.id,
            name_ru: g.name_ru,
            sort_order: g.sort_order ?? 0,
            max_selections: g.max_selections ?? null,
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
      return item.price ?? 0
    }
    if (!selectedVariantId) return 0
    const v = sortedVariants.find((x) => x.id === selectedVariantId)
    return v?.price ?? item.price ?? 0
  }, [item, sortedVariants, selectedVariantId])

  const toppingMetaById = useMemo(() => {
    const m = new Map<string, UiTopping>()
    for (const g of groups) {
      for (const t of g.toppings) m.set(t.id, t)
    }
    return m
  }, [groups])

  const toppingsUnitBani = useMemo(() => {
    let s = 0
    for (const ids of Object.values(selectedByGroup)) {
      for (const id of ids) {
        s += toppingMetaById.get(id)?.price ?? 0
      }
    }
    return s
  }, [selectedByGroup, toppingMetaById])

  const unitTotalBani = sizeUnitBani + toppingsUnitBani
  const lineTotalBani = unitTotalBani * qty

  const selectedToppingsPayload = useMemo(() => {
    const out: PosCartItem["toppings"] = []
    for (const ids of Object.values(selectedByGroup)) {
      for (const id of ids) {
        const t = toppingMetaById.get(id)
        if (t) out.push({ id: t.id, name: t.name_ru, price: t.price })
      }
    }
    return out
  }, [selectedByGroup, toppingMetaById])

  const toggleTopping = (groupId: string, toppingId: string) => {
    const g = groups.find((x) => x.id === groupId)
    if (!g) return
    setSelectedByGroup((prev) =>
      nextSelectedByGroupWithCap(prev, groupId, toppingId, g.max_selections),
    )
  }

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
    const payload: PosCartItem = {
      menuItemId: item.id,
      name: item.name_ru,
      size: sizeSnap,
      variantId: vid,
      price: unitTotalBani,
      qty,
      imageUrl: item.image_url ?? undefined,
      toppings: selectedToppingsPayload,
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
                      {v.name_ru} — {(v.price / 100).toFixed(2)} MDL
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
                ? groups.map((g) => (
                    <div key={g.id} className="mt-4 space-y-2">
                      <p className="text-sm font-medium">{g.name_ru}</p>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {g.toppings.map((t) => {
                          const sel = (selectedByGroup[g.id] ?? []).includes(t.id)
                          const priceLabel =
                            t.price > 0
                              ? `+ ${formatLei(t.price)} MDL`
                              : "бесплатно"
                          return (
                            <button
                              key={t.id}
                              type="button"
                              aria-pressed={sel}
                              onClick={() => toggleTopping(g.id, t.id)}
                              className={cn(
                                "flex flex-col overflow-hidden rounded-lg border-2 bg-card text-left transition-all outline-none select-none",
                                "focus-visible:ring-2 focus-visible:ring-ring/50",
                                "active:translate-y-px",
                                sel
                                  ? "border-primary shadow-sm"
                                  : "border-border hover:border-muted-foreground/35",
                              )}
                            >
                              <div className="bg-muted relative aspect-square w-full shrink-0">
                                {t.image_url ? (
                                  <Image
                                    src={t.image_url}
                                    alt=""
                                    fill
                                    className="object-cover"
                                    sizes="(max-width: 640px) 45vw, 120px"
                                  />
                                ) : (
                                  <div
                                    className="text-muted-foreground flex h-full items-center justify-center text-xs"
                                    aria-hidden
                                  >
                                    —
                                  </div>
                                )}
                              </div>
                              <div className="flex min-h-0 flex-1 flex-col gap-0.5 p-2">
                                <span className="line-clamp-2 text-xs leading-tight font-medium">
                                  {t.name_ru}
                                </span>
                                <span
                                  className={cn(
                                    "text-[11px] leading-tight tabular-nums",
                                    sel
                                      ? "text-primary font-medium"
                                      : "text-muted-foreground",
                                  )}
                                >
                                  {priceLabel}
                                </span>
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ))
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
