"use client"

import { fetchToppingsForMenuItem } from "@/lib/data/storefront-item-toppings"
import {
  formatMoney,
  formatWeightGrams,
  pickLocalizedDescription,
  pickLocalizedName,
  type Lang,
} from "@/lib/i18n/storefront"
import { useCartStore } from "@/lib/store/cart-store"
import { useLanguage } from "@/lib/store/language-store"
import { useProductModalStore } from "@/lib/store/product-modal-store"
import type { MenuItem, Topping } from "@/types/database"
import { cn } from "@/lib/utils"
import { X } from "lucide-react"
import Image from "next/image"
import { useCallback, useEffect, useMemo, useState } from "react"
import { Drawer } from "vaul"
import {
  getItemSizeLabel,
  SizeSelector,
  type PizzaSize,
} from "./SizeSelector"
import { ToppingCard } from "./ToppingCard"

const DESKTOP_EXIT_MS = 300

function getBasePriceBani(item: MenuItem, size: PizzaSize): number {
  if (item.has_sizes) {
    const p = size === "l" ? item.size_l_price : item.size_s_price
    return p ?? 0
  }
  return item.price ?? 0
}

function totalBani(
  item: MenuItem,
  size: PizzaSize,
  toppings: Topping[],
  selectedIds: string[],
): number {
  let sum = getBasePriceBani(item, size)
  for (const id of selectedIds) {
    const t = toppings.find((x) => x.id === id)
    if (t) sum += t.price
  }
  return sum
}

/** Плашка «размер + вес» для шапки модалки; null — не показывать. */
function getWeightPillLabel(
  item: MenuItem,
  selectedSize: PizzaSize,
  lang: Lang,
): string | null {
  if (!item.has_sizes) {
    if (item.weight_grams == null) return null
    const portion = item.size_l_label?.trim()
    if (portion) return `${portion}, ${formatWeightGrams(item.weight_grams, lang)}`
    return formatWeightGrams(item.weight_grams, lang)
  }
  const sw = item.size_s_weight
  const lw = item.size_l_weight
  if (sw == null && lw == null) return null
  const activeLabel = getItemSizeLabel(item, selectedSize)
  const active = selectedSize === "l" ? lw : sw
  if (active != null) return `${activeLabel}, ${formatWeightGrams(active, lang)}`
  return activeLabel
}

function useIsMobileViewport() {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(max-width: 767px)").matches
      : false,
  )
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)")
    const fn = () => setIsMobile(mq.matches)
    setIsMobile(mq.matches)
    mq.addEventListener("change", fn)
    return () => mq.removeEventListener("change", fn)
  }, [])
  return isMobile
}

function DesktopModalShell({
  visible,
  children,
  onClose,
  closeLabel,
}: {
  visible: boolean
  children: React.ReactNode
  onClose: () => void
  closeLabel: string
}) {
  return (
    <div
      className={cn(
        "fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 transition-opacity duration-300 ease-out",
        visible ? "opacity-100" : "opacity-0",
      )}
      role="presentation"
      onClick={onClose}
    >
      <div
        className={cn(
          "storefront-modal-surface relative z-[70] h-[620px] w-full max-w-[1120px] origin-center overflow-hidden rounded-[24px] transition-all duration-300 ease-out",
          visible
            ? "translate-y-0 scale-100 opacity-100"
            : "translate-y-3 scale-[0.96] opacity-0",
        )}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="storefront-modal-surface absolute right-7 top-7 z-20 flex size-11 cursor-pointer items-center justify-center rounded-full text-[#242424] transition-all duration-200 hover:bg-gray-200 active:scale-[0.93]"
          aria-label={closeLabel}
        >
          <X size={22} strokeWidth={2.5} />
        </button>
        {children}
      </div>
    </div>
  )
}

export function ProductModalRoot() {
  const storeItem = useProductModalStore((s) => s.item)
  const isOpen = useProductModalStore((s) => s.isOpen)
  const close = useProductModalStore((s) => s.close)
  const editingCartItemId = useProductModalStore((s) => s.editingCartItemId)
  const isMobile = useIsMobileViewport()

  const [modalItem, setModalItem] = useState<MenuItem | null>(null)
  const [visible, setVisible] = useState(false)
  const [rendered, setRendered] = useState(false)

  const { lang, t } = useLanguage()
  const [toppings, setToppings] = useState<Topping[]>([])
  const [selectedSize, setSelectedSize] = useState<PizzaSize>("l")
  const [selectedToppingIds, setSelectedToppingIds] = useState<string[]>([])

  useEffect(() => {
    if (isOpen && storeItem) {
      setModalItem(storeItem)
    }
  }, [isOpen, storeItem])

  useEffect(() => {
    if (isOpen) {
      setRendered(true)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setVisible(true))
      })
    } else {
      setVisible(false)
      const timer = setTimeout(() => {
        setRendered(false)
        setModalItem(null)
      }, DESKTOP_EXIT_MS)
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen || !storeItem) return
    let cancelled = false
    ;(async () => {
      const list = await fetchToppingsForMenuItem(storeItem.id)
      if (cancelled) return
      setToppings(list)
      const pm = useProductModalStore.getState()
      if (pm.editingCartItemId) {
        if (storeItem.has_sizes) {
          const iz = pm.initialSize
          setSelectedSize(iz === "s" || iz === "l" ? iz : "l")
        }
        setSelectedToppingIds(pm.initialToppingIds ?? [])
      } else {
        setSelectedSize("l")
        setSelectedToppingIds([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [isOpen, storeItem, editingCartItemId])

  const toggleTopping = useCallback((id: string) => {
    setSelectedToppingIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }, [])

  const panelItem = modalItem ?? (isOpen ? storeItem : null)

  const handleAddToCart = useCallback(() => {
    if (!panelItem) return
    const cartSize = panelItem.has_sizes ? selectedSize : null
    const pm = useProductModalStore.getState()
    const shouldReopenCart = pm.returnToCart
    const reopenCartAfterSave =
      shouldReopenCart &&
      typeof window !== "undefined" &&
      window.innerWidth < 768
    if (pm.editingCartItemId) {
      useCartStore.getState().removeItem(pm.editingCartItemId)
    }
    useCartStore.getState().addItem(panelItem, cartSize, selectedToppingIds, toppings)
    close()
    if (reopenCartAfterSave) {
      window.setTimeout(() => {
        useCartStore.getState().openCart()
      }, 50)
    }
  }, [close, panelItem, selectedSize, selectedToppingIds, toppings])

  const addToCartLabel = t.product.addToCart
  const closeLabel = t.product.close

  const totalLabel = useMemo(() => {
    if (!panelItem) return ""
    return formatMoney(
      totalBani(panelItem, selectedSize, toppings, selectedToppingIds),
      lang,
    )
  }, [panelItem, selectedSize, toppings, selectedToppingIds, lang])

  const weightPillLabel = useMemo(() => {
    if (!panelItem) return null
    return getWeightPillLabel(panelItem, selectedSize, lang)
  }, [panelItem, selectedSize, lang])

  const titleName = panelItem
    ? pickLocalizedName(panelItem, lang)
    : ""

  const descriptionText = panelItem
    ? pickLocalizedDescription(panelItem, lang)
    : null

  const imageBlock =
    panelItem && (
      <div className="relative mx-auto aspect-square w-full max-w-[450px] shrink-0 md:absolute md:bottom-[20px] md:left-[20px] md:top-[20px] md:mx-0 md:w-auto md:max-w-none">
        {panelItem.image_url ? (
          <Image
            src={panelItem.image_url}
            alt=""
            fill
            className="object-contain"
            sizes="(max-width: 768px) 100vw, 580px"
            priority
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center text-sm text-zinc-400"
            aria-hidden
          >
            {t.common.noPhoto}
          </div>
        )}
      </div>
    )

  const addToCartButton =
    panelItem && (
      <button
        type="button"
        onClick={handleAddToCart}
        className="storefront-modal-cta w-full cursor-pointer rounded-full py-3.5 text-[16px] font-bold transition-all duration-200 hover:brightness-110 active:scale-[0.98] active:brightness-95"
      >
        {addToCartLabel} · {totalLabel}
      </button>
    )

  const modalScrollBody =
    panelItem && (
      <div className="flex flex-col gap-4 px-1 pt-1 pb-1 md:px-0 md:pt-2">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-bold leading-tight text-[#242424]">
              {pickLocalizedName(panelItem, lang)}
            </h2>
            {weightPillLabel ? (
              <span className="storefront-modal-field inline-flex shrink-0 items-center rounded-full border border-[#ccc] px-3 py-1 text-sm font-medium text-[rgba(36,36,36,0.5)]">
                {weightPillLabel}
              </span>
            ) : null}
          </div>
          {descriptionText ? (
            <p className="mt-2 text-sm leading-relaxed text-zinc-600">
              {descriptionText}
            </p>
          ) : null}
        </div>
        {panelItem.has_sizes ? (
          <SizeSelector
            selectedSize={selectedSize}
            onSizeChange={setSelectedSize}
            item={panelItem}
          />
        ) : null}
        {toppings.length > 0 ? (
          <div className="grid grid-cols-3 gap-1.5">
            {toppings.map((t) => (
              <ToppingCard
                key={t.id}
                topping={t}
                selected={selectedToppingIds.includes(t.id)}
                onToggle={() => toggleTopping(t.id)}
                name={pickLocalizedName(t, lang)}
                priceLabel={formatMoney(t.price, lang)}
              />
            ))}
          </div>
        ) : null}
      </div>
    )

  if (isMobile) {
    if (!isOpen || !storeItem) return null

    return (
      <Drawer.Root
        open={isOpen}
        onOpenChange={(open) => {
          if (!open) close()
        }}
      >
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 z-[60] bg-black/50" />
          <Drawer.Content className="storefront-modal-surface fixed bottom-0 left-0 right-0 z-[70] flex max-h-[92dvh] flex-col rounded-t-[24px] outline-none">
            <Drawer.Title className="sr-only">{titleName}</Drawer.Title>
            <div
              className="mx-auto mb-0 mt-3 h-1 w-10 shrink-0 rounded-full bg-[#ccc]"
              aria-hidden
            />
            <button
              type="button"
              onClick={close}
              className="storefront-modal-surface absolute right-5 top-5 z-10 flex size-11 cursor-pointer items-center justify-center rounded-full text-[#242424] transition-all duration-200 hover:bg-black/10 active:scale-[0.95]"
              aria-label={closeLabel}
            >
              <X size={22} strokeWidth={2.5} />
            </button>
            <div className="flex min-h-0 min-w-0 flex-1 flex-col px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2">
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]">
                {imageBlock}
                <div className="storefront-modal-bg storefront-modal-card-radius mt-4 rounded-[20px] p-4">
                  {modalScrollBody}
                </div>
              </div>
              <div className="storefront-modal-surface shrink-0 border-t border-[#ebebeb] pt-3">
                {addToCartButton}
              </div>
            </div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    )
  }

  if (!rendered || !panelItem) return null

  return (
    <DesktopModalShell visible={visible} onClose={close} closeLabel={closeLabel}>
      {imageBlock}
      <div
        className="storefront-modal-bg storefront-modal-card-radius absolute bottom-[20px] right-[20px] top-[20px] flex w-[min(450px,calc(100%-40px))] flex-col overflow-hidden rounded-[20px] p-5 md:w-[450px]"
        style={{ maxHeight: "calc(100% - 40px)" }}
      >
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]">
            {modalScrollBody}
          </div>
          <div className="shrink-0 pt-3 md:pt-4">{addToCartButton}</div>
        </div>
      </div>
    </DesktopModalShell>
  )
}
