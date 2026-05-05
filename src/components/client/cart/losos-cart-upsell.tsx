"use client"

import { LOSOS_BRAND_SLUG } from "@/brands"
import {
  formatMoney,
  pickLocalizedName,
  type Lang,
} from "@/lib/i18n/storefront"
import { isSameCartConfiguration } from "@/lib/cart-helpers"
import { useCartStore } from "@/lib/store/cart-store"
import { useLanguage } from "@/lib/store/language-store"
import { createClient } from "@/lib/supabase/client"
import type { Category, MenuItem, MenuItemVariant } from "@/types/database"
import {
  pickVariantLabel,
  VariantSelector,
} from "@/components/client/product-modal/SizeSelector"
import { Minus, Plus, X } from "lucide-react"
import Image from "next/image"
import { useCallback, useEffect, useMemo, useState } from "react"
import { cn } from "@/lib/utils"

function localizedCategoryName(cat: Category, lang: Lang): string {
  return lang === "RO"
    ? cat.name_ro?.trim() || cat.name_ru.trim()
    : cat.name_ru.trim() || cat.name_ro?.trim() || ""
}

function sortVariants(
  vars: MenuItemVariant[] | null | undefined,
): MenuItemVariant[] {
  return [...(vars ?? [])].sort((a, b) => a.sort_order - b.sort_order)
}

function normalizeMenuRows(raw: unknown): MenuItem[] {
  if (!Array.isArray(raw)) return []
  return raw.map((entry) => {
    const row = entry as MenuItem & {
      menu_item_variants?: MenuItemVariant[] | null
      menu_categories?: unknown
    }
    const variants = sortVariants(row.menu_item_variants)
    const stripped = { ...row } as Record<string, unknown>
    delete stripped.menu_item_variants
    delete stripped.menu_categories
    return { ...(stripped as unknown as MenuItem), variants }
  })
}

function UpsellMenuRow({
  item,
  lang,
  addLabel,
}: {
  item: MenuItem
  lang: Lang
  addLabel: string
}) {
  const { t } = useLanguage()
  const cartItems = useCartStore((s) => s.items)
  const addItem = useCartStore((s) => s.addItem)
  const updateQuantity = useCartStore((s) => s.updateQuantity)
  const variantsSorted = useMemo(
    () => sortVariants(item.variants),
    [item.variants],
  )
  const showVariants = item.has_sizes && variantsSorted.length > 0
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null)

  useEffect(() => {
    setSelectedVariantId(null)
  }, [item.id])

  const chosenVariant =
    showVariants && selectedVariantId
      ? variantsSorted.find((v) => v.id === selectedVariantId)
      : undefined
  const snap = chosenVariant ? pickVariantLabel(chosenVariant, lang) : null

  const itemForCart: MenuItem =
    variantsSorted.length > 0 ? { ...item, variants: variantsSorted } : item

  const unitBani: number | null = showVariants
    ? chosenVariant != null
      ? chosenVariant.price
      : null
    : item.price ?? 0

  const readyToAdd = showVariants ? Boolean(chosenVariant) : true

  const variantIdForCart = showVariants ? (selectedVariantId ?? null) : null

  const quantityLine = useMemo(
    () =>
      cartItems.find((entry) =>
        isSameCartConfiguration(entry, item, null, variantIdForCart, []),
      ),
    [cartItems, item, variantIdForCart],
  )

  const lineQty = quantityLine?.quantity ?? 0

  function handleAdd() {
    if (!readyToAdd) return
    if (showVariants && (!selectedVariantId || !chosenVariant)) return

    addItem(
      itemForCart,
      null,
      [],
      [],
      showVariants && selectedVariantId && chosenVariant
        ? { variantId: selectedVariantId, variantNameSnapshot: snap }
        : { variantId: null, variantNameSnapshot: null },
    )
  }

  const name = pickLocalizedName(item, lang)

  const priceLabel =
    unitBani != null ? formatMoney(unitBani, lang) : "—"

  return (
    <div className="storefront-modal-card-radius flex min-h-[80px] w-full items-center gap-6 bg-[var(--color-surface)] px-3 py-4 shadow-none">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="relative size-12 shrink-0 overflow-hidden rounded-[var(--radius-input)] bg-[var(--color-bg)]">
          {item.image_url ? (
            <Image
              src={item.image_url}
              alt=""
              fill
              className="object-cover"
              sizes="48px"
            />
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-base font-bold leading-none text-[var(--color-text)]">
            {name}
          </p>
          {showVariants ? (
            <div className="mt-2">
              <VariantSelector
                variants={variantsSorted}
                selectedVariantId={selectedVariantId}
                onVariantChange={setSelectedVariantId}
                lang={lang}
              />
            </div>
          ) : null}
        </div>
      </div>
      {readyToAdd && lineQty > 0 && quantityLine ? (
        <div className="storefront-modal-field inline-flex shrink-0 items-center gap-0 rounded-full p-0.5">
          <button
            type="button"
            onClick={() => updateQuantity(quantityLine.id, -1)}
            className="flex size-8 items-center justify-center rounded-full text-[var(--color-text)] transition-colors hover:bg-black/5"
            aria-label={t.cart.decrease}
          >
            <Minus className="size-4" strokeWidth={2.5} />
          </button>
          <span className="min-w-[2ch] px-1 text-center text-sm font-semibold tabular-nums">
            {lineQty}
          </span>
          <button
            type="button"
            onClick={() => updateQuantity(quantityLine.id, 1)}
            className="flex size-8 items-center justify-center rounded-full text-[var(--color-text)] transition-colors hover:bg-black/5"
            aria-label={t.cart.increase}
          >
            <Plus className="size-4" strokeWidth={2.5} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={!readyToAdd}
          onClick={handleAdd}
          aria-label={`${addLabel}, ${priceLabel}`}
          className="inline-flex shrink-0 items-center justify-center rounded-full bg-[var(--color-accent-soft)] px-4 py-2 text-sm font-medium leading-[1.2] text-[var(--color-accent-text)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {unitBani != null ? (
            <span className="tabular-nums">{priceLabel}</span>
          ) : (
            <span className="text-[var(--color-muted)]">···</span>
          )}
        </button>
      )}
    </div>
  )
}

/** Горизонтальный ряд карточек категорий в основной области корзины. */
export function LososUpsellCategoryStrip({
  cartIsOpen,
  lang,
  addToOrderHeading,
  onPickCategory,
}: {
  cartIsOpen: boolean
  lang: Lang
  addToOrderHeading: string
  onPickCategory: (category: Category) => void
}) {
  const [categories, setCategories] = useState<Category[]>([])

  const fetchUpsellCategories = useCallback(async () => {
    const supabase = createClient()
    const { data: brandRow, error: bErr } = await supabase
      .from("brands")
      .select("id")
      .eq("slug", LOSOS_BRAND_SLUG)
      .maybeSingle()

    const brandId = (brandRow as { id?: string } | null)?.id
    if (bErr || !brandId) {
      setCategories([])
      return
    }

    const { data, error } = await supabase
      .from("menu_categories")
      .select("*")
      .eq("brand_id", brandId)
      .eq("show_in_upsell", true)
      .eq("is_active", true)
      .order("sort_order", { ascending: true })

    if (error || !data) {
      setCategories([])
      return
    }

    setCategories(data as Category[])
  }, [])

  useEffect(() => {
    if (!cartIsOpen) return
    let cancelled = false
    ;(async () => {
      await fetchUpsellCategories()
    })().catch(() => {
      if (!cancelled) setCategories([])
    })
    return () => {
      cancelled = true
    }
  }, [cartIsOpen, fetchUpsellCategories])

  if (!cartIsOpen) return null

  if (categories.length === 0) return null

  return (
    <section className="mt-4 shrink-0 pb-4 pt-1">
      <p className="mb-2 text-xs font-normal text-[var(--color-muted)]">
        {addToOrderHeading}
      </p>
      <div className="-mx-1 flex gap-2 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch]">
        {categories.map((cat) => {
          const title = localizedCategoryName(cat, lang)
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => onPickCategory(cat)}
              className="storefront-modal-card-radius w-[104px] shrink-0 cursor-pointer border-0 bg-[var(--color-surface)] p-2 text-left shadow-none transition-opacity hover:opacity-90 active:opacity-80"
            >
              <div
                className="relative mx-auto size-20 shrink-0 overflow-hidden bg-[var(--color-bg)]"
                style={{ borderRadius: "var(--radius-input)" }}
              >
                {cat.image_url ? (
                  <Image
                    src={cat.image_url}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="80px"
                  />
                ) : null}
              </div>
              <p className="mt-2 line-clamp-2 text-center text-xs font-bold leading-tight text-[var(--color-text)]">
                {title}
              </p>
            </button>
          )
        })}
      </div>
    </section>
  )
}

/** Слайд-панель внутри контейнера корзины (не портал, не Vaul). */
export function LososUpsellSlidePanel({
  upsellCategory,
  onClose,
  lang,
}: {
  upsellCategory: Category | null
  onClose: () => void
  lang: Lang
}) {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [itemsLoading, setItemsLoading] = useState(false)

  const open = Boolean(upsellCategory)
  const title = upsellCategory ? localizedCategoryName(upsellCategory, lang) : ""
  const addLabel = lang === "RO" ? "Adaugă" : "Добавить"
  const closeLabel = lang === "RO" ? "Închide" : "Закрыть"

  useEffect(() => {
    if (!upsellCategory) {
      setMenuItems([])
      return
    }

    let cancelled = false
    setItemsLoading(true)
    ;(async () => {
      try {
        const supabase = createClient()
        const { data, error } = await supabase
          .from("menu_items")
          .select("*, menu_item_variants(*), menu_categories(*)")
          .eq("category_id", upsellCategory.id)
          .eq("is_active", true)
          .order("sort_order", { ascending: true })

        if (cancelled) return
        if (error || !data) {
          setMenuItems([])
          return
        }
        setMenuItems(normalizeMenuRows(data))
      } catch {
        if (!cancelled) setMenuItems([])
      } finally {
        if (!cancelled) setItemsLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [upsellCategory])

  return (
    <div
      className={cn(
        "absolute bottom-0 left-0 right-0 z-10 flex h-1/2 min-h-0 flex-col overflow-hidden rounded-t-2xl bg-[var(--color-bg)] shadow-[0_-4px_20px_rgba(0,0,0,0.08)] transition-transform duration-300 ease-out",
        open ? "translate-y-0 pointer-events-auto" : "translate-y-full pointer-events-none",
      )}
      aria-hidden={!open}
    >
      <div
        className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-[#cccccc]"
        aria-hidden
      />
      <div className="flex min-h-0 flex-1 flex-col gap-3 px-6 pb-6 pt-2.5">
        <header className="flex shrink-0 items-center justify-between gap-3 pt-3">
          <h2 className="min-w-0 flex-1 text-left text-xl font-bold leading-[1.2] text-[var(--color-text)]">
            {open ? title : "\u00a0"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="storefront-modal-surface flex size-9 shrink-0 items-center justify-center rounded-full text-[var(--color-text)] transition-colors hover:opacity-80"
            aria-label={closeLabel}
          >
            <X className="size-5" strokeWidth={2.5} />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]">
          {!open ? null : itemsLoading ? (
            <p className="py-8 text-center text-sm text-[var(--color-muted)]">
              {lang === "RO" ? "Se încarcă…" : "Загрузка…"}
            </p>
          ) : menuItems.length === 0 ? (
            <p className="py-8 text-center text-sm text-[var(--color-muted)]">
              {lang === "RO" ? "Nu există poziții" : "Нет позиций"}
            </p>
          ) : (
            <div className="flex flex-col gap-2.5 pb-2">
              {menuItems.map((row) => (
                <UpsellMenuRow
                  key={row.id}
                  item={row}
                  lang={lang}
                  addLabel={addLabel}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
