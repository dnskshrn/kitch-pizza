"use client"

import { useStorefrontCampaignRules } from "@/components/client/storefront-campaign-rules-context"
import {
  fetchStorefrontMenuItemToppingGroups,
  type StorefrontMenuItemToppingGroup,
} from "@/lib/data/storefront-item-toppings"
import { fetchStorefrontMenuItemVariants } from "@/lib/data/storefront-item-variants"
import {
  formatMoney,
  formatWeightGrams,
  pickLocalizedDescription,
  pickLocalizedName,
  type Lang,
} from "@/lib/i18n/storefront"
import { useStoreOpen } from "@/hooks/use-store-open"
import { showStoreClosedModal } from "@/lib/store/store-closed-store"
import { useCartStore } from "@/lib/store/cart-store"
import { useLanguage } from "@/lib/store/language-store"
import {
  buildCartToppingsFromSelection,
  cartToppingFromTopping,
  expandSelectedToppingIds,
  getTotalQuantityInGroup,
} from "@/lib/cart-toppings"
import {
  calcToppingGroupCharge,
  formatStorefrontToppingGroupHeader,
  getFreeUnitsRemaining,
} from "@/lib/topping-pricing"
import { useProductModalStore } from "@/lib/store/product-modal-store"
import { getItemCampaignDiscount } from "@/lib/storefront-item-campaign-discount"
import type { CartTopping } from "@/types/cart"
import type { MenuItem, MenuItemVariant, Topping } from "@/types/database"
import { menuItemImageAlt } from "@/lib/seo/menu-item-image-alt"
import { cn } from "@/lib/utils"
import { X } from "lucide-react"
import Image from "next/image"
import { useCallback, useEffect, useMemo, useState } from "react"
import { Drawer } from "vaul"
import { pickVariantLabel, VariantSelector } from "./SizeSelector"
import { ToppingCard } from "./ToppingCard"

const DESKTOP_EXIT_MS = 300

function sortVariants(list: MenuItemVariant[]): MenuItemVariant[] {
  return [...list].sort((a, b) => a.sort_order - b.sort_order || a.name_ru.localeCompare(b.name_ru))
}

function getBasePriceBani(
  item: MenuItem,
  variantsEffective: MenuItemVariant[],
  selectedVariantId: string | null,
): number {
  if (!item.has_sizes || variantsEffective.length === 0) {
    return item.price ?? 0
  }
  if (!selectedVariantId) return item.price ?? 0
  const v = variantsEffective.find((x) => x.id === selectedVariantId)
  return v?.price ?? item.price ?? 0
}

function totalBani(
  item: MenuItem,
  variantsEffective: MenuItemVariant[],
  selectedVariantId: string | null,
  cartToppings: CartTopping[],
  toppingSections: StorefrontMenuItemToppingGroup[],
): number {
  let sum = getBasePriceBani(item, variantsEffective, selectedVariantId)
  const assignedIds = new Set<string>()

  for (const section of toppingSections) {
    const ids = new Set(section.toppings.map((t) => t.id))
    const selections = cartToppings
      .filter((t) => ids.has(t.id))
      .map((t) => {
        assignedIds.add(t.id)
        return { id: t.id, price: t.price, quantity: t.quantity }
      })
    sum += calcToppingGroupCharge(selections, section.free_count)
  }

  for (const t of cartToppings) {
    if (!assignedIds.has(t.id)) {
      sum += t.price * t.quantity
    }
  }
  return sum
}

/** Плашка «размер + вес» для шапки модалки; null — не показывать. */
function getWeightPillLabel(
  item: MenuItem,
  variantsEffective: MenuItemVariant[],
  selectedVariantId: string | null,
  lang: Lang,
): string | null {
  if (!item.has_sizes) {
    if (item.weight_grams == null) return null
    return formatWeightGrams(item.weight_grams, lang)
  }
  const v =
    variantsEffective.find((x) => x.id === selectedVariantId) ??
    variantsEffective[0]
  if (!v) return null
  const label = pickVariantLabel(v, lang)
  if (v.weight_grams != null) {
    return `${label}, ${formatWeightGrams(v.weight_grams, lang)}`
  }
  return label
}

function includedItemDotColor(entry: {
  name_ru: string
  name_ro: string
}): string {
  const hay = `${entry.name_ru} ${entry.name_ro}`.toLowerCase()
  if (hay.includes("васаби") || hay.includes("wasabi")) return "#4CAF50"
  if (hay.includes("имбирь") || hay.includes("ghimbir")) return "#FF9800"
  if (hay.includes("соус") || hay.includes("sos")) return "#5D4037"
  if (
    hay.includes("палочки") ||
    hay.includes("bețisoare") ||
    hay.includes("betisoare")
  ) {
    return "#9E9E9E"
  }
  return "#9E9E9E"
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

function resolveInitialVariantId(
  variantsSorted: MenuItemVariant[],
  initialVariantId: string | undefined | null,
  legacySize: "s" | "l" | null | undefined,
): string | null {
  if (variantsSorted.length === 0) return null
  if (initialVariantId && variantsSorted.some((v) => v.id === initialVariantId)) {
    return initialVariantId
  }
  if (legacySize === "s") return variantsSorted[0]!.id
  if (legacySize === "l") {
    return variantsSorted[Math.min(1, variantsSorted.length - 1)]!.id
  }
  return variantsSorted[0]!.id
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
  const campaignRules = useStorefrontCampaignRules()
  const { isOpen: storeOpen } = useStoreOpen()
  const [toppingSections, setToppingSections] = useState<
    StorefrontMenuItemToppingGroup[]
  >([])
  const toppings = useMemo(
    () => toppingSections.flatMap((s) => s.toppings),
    [toppingSections],
  )
  const [variants, setVariants] = useState<MenuItemVariant[]>([])
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null)
  /** После асинхронной подгрузки вариантов для позиции с размерами (защита от «0 lei» до гидратации). */
  const [sizesVariantsHydrated, setSizesVariantsHydrated] = useState(false)
  const [cartToppings, setCartToppings] = useState<CartTopping[]>([])

  const variantsEffective = useMemo(() => {
    const fromState = variants.length ? variants : (modalItem?.variants ?? [])
    return sortVariants(fromState)
  }, [variants, modalItem?.variants])

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
        setVariants([])
        setSelectedVariantId(null)
        setSizesVariantsHydrated(false)
      }, DESKTOP_EXIT_MS)
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen || !storeItem) return
    let cancelled = false
    void (async () => {
      if (storeItem.has_sizes) {
        setSizesVariantsHydrated(false)
      }

      const pm = useProductModalStore.getState()
      let loadedVariants =
        storeItem.variants?.length ?? 0 ? sortVariants(storeItem.variants ?? []) : []

      if (loadedVariants.length === 0) {
        const fetched = await fetchStorefrontMenuItemVariants(storeItem.id)
        if (cancelled) return
        loadedVariants = sortVariants(fetched ?? [])
      } else if (!cancelled) {
        void 0
      }

      const groups = await fetchStorefrontMenuItemToppingGroups(storeItem.id)
      if (cancelled) return
      setToppingSections(groups)
      setVariants(loadedVariants)

      const initVid = pm.initialVariantId
      const initSize = pm.initialSize
      if (storeItem.has_sizes && loadedVariants.length > 0) {
        const id = resolveInitialVariantId(loadedVariants, initVid, initSize)
        setSelectedVariantId(id)
      } else {
        setSelectedVariantId(null)
      }

      if (storeItem.has_sizes && !cancelled) {
        setSizesVariantsHydrated(true)
      }

      const allToppings = groups.flatMap((s) => s.toppings)
      if (pm.editingCartItemId) {
        setCartToppings(
          buildCartToppingsFromSelection(pm.initialToppingIds ?? [], allToppings),
        )
      } else {
        setCartToppings([])
      }
    })()

    return () => {
      cancelled = true
    }
  }, [isOpen, storeItem, editingCartItemId])

  const addTopping = useCallback(
    (
      topping: Topping,
      groupToppingIds: readonly string[],
      groupMaxSelections: number | null,
    ) => {
      setCartToppings((prev) => {
        const totalInGroup = getTotalQuantityInGroup(prev, groupToppingIds)
        if (
          groupMaxSelections != null &&
          totalInGroup >= groupMaxSelections
        ) {
          return prev
        }

        const existing = prev.find((t) => t.id === topping.id)
        if (existing) {
          return prev.map((t) =>
            t.id === topping.id ? { ...t, quantity: t.quantity + 1 } : t,
          )
        }
        return [...prev, { ...cartToppingFromTopping(topping), quantity: 1 }]
      })
    },
    [],
  )

  const removeTopping = useCallback((toppingId: string) => {
    setCartToppings((prev) => {
      const existing = prev.find((t) => t.id === toppingId)
      if (!existing) return prev
      if (existing.quantity > 1) {
        return prev.map((t) =>
          t.id === toppingId ? { ...t, quantity: t.quantity - 1 } : t,
        )
      }
      return prev.filter((t) => t.id !== toppingId)
    })
  }, [])

  const panelItem = modalItem ?? (isOpen ? storeItem : null)

  const handleAddToCart = useCallback(() => {
    if (!storeOpen) {
      showStoreClosedModal()
      return
    }
    if (!panelItem) return
    if (panelItem.has_sizes) {
      const selectedVariant = selectedVariantId
        ? variantsEffective.find((x) => x.id === selectedVariantId)
        : undefined
      if (!selectedVariant || selectedVariant.price === 0) return
    }
    const showVariants =
      panelItem.has_sizes && variantsEffective.length > 0
    const pm = useProductModalStore.getState()
    const shouldReopenCart = pm.returnToCart
    const reopenCartAfterSave =
      shouldReopenCart &&
      typeof window !== "undefined" &&
      window.innerWidth < 768
    if (pm.editingCartItemId) {
      useCartStore.getState().removeItem(pm.editingCartItemId)
    }

    const chosenVariant =
      showVariants && selectedVariantId
        ? variantsEffective.find((v) => v.id === selectedVariantId)
        : undefined
    const snap = chosenVariant ? pickVariantLabel(chosenVariant, lang) : null

    const itemForCart: MenuItem =
      variantsEffective.length > 0 && showVariants
        ? { ...panelItem, variants: variantsEffective }
        : panelItem

    const toppingGroupFreeCounts = Object.fromEntries(
      toppingSections.map((s) => [s.id, s.free_count]),
    )
    const toppingGroupLabels = Object.fromEntries(
      toppingSections.map((s) => [
        s.id,
        { name_ru: s.name_ru, name_ro: s.name_ro },
      ]),
    )

    useCartStore.getState().addItem(
      itemForCart,
      null,
      expandSelectedToppingIds(cartToppings),
      toppings,
      showVariants && selectedVariantId && chosenVariant
        ? {
            variantId: selectedVariantId,
            variantNameSnapshot: snap,
            toppingGroupFreeCounts,
            toppingGroupLabels,
          }
        : {
            variantId: null,
            variantNameSnapshot: null,
            toppingGroupFreeCounts,
            toppingGroupLabels,
          },
    )
    close()
    if (reopenCartAfterSave && storeOpen) {
      window.setTimeout(() => {
        useCartStore.getState().openCart()
      }, 50)
    }
  }, [
    close,
    lang,
    panelItem,
    cartToppings,
    selectedVariantId,
    storeOpen,
    toppings,
    toppingSections,
    variantsEffective,
  ])

  const addToCartLabel = t.product.addToCart
  const closeLabel = t.product.close

  const priceDisplay = useMemo(() => {
    if (!panelItem) {
      return {
        totalLabel: "",
        compareLabel: null as string | null,
        hasCampaign: false,
      }
    }

    const rawTotalBani = totalBani(
      panelItem,
      variantsEffective,
      selectedVariantId,
      cartToppings,
      toppingSections,
    )
    const baseBani = getBasePriceBani(
      panelItem,
      variantsEffective,
      selectedVariantId,
    )
    const campaign = getItemCampaignDiscount(
      panelItem,
      campaignRules,
      baseBani,
    )
    const displayTotalBani = campaign.hasCampaign
      ? rawTotalBani - baseBani + campaign.discountedPriceBani
      : rawTotalBani

    return {
      totalLabel: formatMoney(displayTotalBani, lang),
      compareLabel: campaign.hasCampaign
        ? formatMoney(rawTotalBani, lang)
        : null,
      hasCampaign: campaign.hasCampaign,
    }
  }, [
    panelItem,
    selectedVariantId,
    cartToppings,
    toppingSections,
    lang,
    variantsEffective,
    campaignRules,
  ])

  const weightPillLabel = useMemo(() => {
    if (!panelItem) return null
    return getWeightPillLabel(panelItem, variantsEffective, selectedVariantId, lang)
  }, [panelItem, variantsEffective, selectedVariantId, lang])

  const selectedVariantResolved =
    panelItem?.has_sizes && selectedVariantId
      ? variantsEffective.find((v) => v.id === selectedVariantId)
      : undefined

  const addToCartDisabled = useMemo(() => {
    if (!panelItem?.has_sizes) return false
    if (!sizesVariantsHydrated) return true
    if (selectedVariantId == null) return true
    if (selectedVariantResolved == null) return true
    if (selectedVariantResolved.price === 0) return true
    if (
      getBasePriceBani(panelItem, variantsEffective, selectedVariantId) === 0
    ) {
      return true
    }
    return false
  }, [
    panelItem,
    sizesVariantsHydrated,
    selectedVariantId,
    selectedVariantResolved,
    variantsEffective,
  ])

  const titleName = panelItem ? pickLocalizedName(panelItem, lang) : ""

  const descriptionText = panelItem ? pickLocalizedDescription(panelItem, lang) : null

  const includedItems = (panelItem?.included_items ?? []).filter(
    (e) => e.name_ru.trim() || e.name_ro.trim(),
  )

  const imageBlock =
    panelItem && (
      <div className="relative mx-auto aspect-square w-[70%] max-w-[315px] shrink-0 md:absolute md:bottom-[20px] md:left-[20px] md:top-[20px] md:mx-0 md:w-auto md:max-w-none">
        {panelItem.image_url ? (
          <Image
            src={panelItem.image_url}
            alt={menuItemImageAlt(panelItem.name_ro)}
            fill
            className="object-contain"
            sizes="(max-width: 768px) 70vw, 580px"
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
        disabled={addToCartDisabled}
        className="storefront-modal-cta w-full cursor-pointer rounded-full py-3.5 text-[16px] font-bold transition-all duration-200 hover:brightness-110 active:scale-[0.98] active:brightness-95 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50"
      >
        {addToCartLabel}
        {priceDisplay.compareLabel ? (
          <>
            {" · "}
            <span className="font-normal line-through opacity-70">
              {priceDisplay.compareLabel}
            </span>{" "}
            {priceDisplay.totalLabel}
          </>
        ) : (
          <> · {priceDisplay.totalLabel}</>
        )}
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
            <p className="mt-2 text-sm leading-relaxed text-zinc-600">{descriptionText}</p>
          ) : null}
        </div>
        {includedItems.length > 0 ? (
          <div className="flex flex-col gap-2">
            <p className="text-[15px] font-semibold leading-snug text-[#242424]">
              {lang === "RO" ? "Inclus în comandă" : "Входит в заказ"}
            </p>
            <div className="flex flex-wrap gap-2">
              {includedItems.map((entry, idx) => (
                <span
                  key={`${entry.name_ru}-${entry.name_ro}-${idx}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#ccc] bg-transparent px-2.5 py-1 text-xs font-medium text-[#242424]"
                >
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{
                      backgroundColor: includedItemDotColor(entry),
                    }}
                    aria-hidden
                  />
                  {pickLocalizedName(entry, lang)}
                </span>
              ))}
            </div>
          </div>
        ) : null}
        {panelItem.has_sizes && variantsEffective.length > 0 ? (
          <VariantSelector
            variants={variantsEffective}
            selectedVariantId={selectedVariantId}
            onVariantChange={setSelectedVariantId}
            lang={lang}
          />
        ) : null}
        {toppingSections.length > 0 ? (
          <div className="flex flex-col gap-4">
            {toppingSections.map((section) => {
              const groupToppingIds = section.toppings.map((x) => x.id)
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
                section.free_count,
              )
              const groupLimitReached =
                section.max_selections != null &&
                selectedInGroup >= section.max_selections
              const groupName = pickLocalizedName(section, lang)
              const headerText =
                section.free_count > 0
                  ? formatStorefrontToppingGroupHeader({
                      lang,
                      groupName,
                      selectedCount: selectedInGroup,
                      maxSelections: section.max_selections,
                      freeCount: section.free_count,
                      selections: groupSelections,
                    })
                  : section.max_selections != null
                    ? lang === "RO"
                      ? `${groupName} — selectat ${selectedInGroup} din ${section.max_selections}`
                      : `${groupName} — выбрано ${selectedInGroup} из ${section.max_selections}`
                    : groupName
              const freePriceLabel = lang === "RO" ? "Gratuit" : "Бесплатно"

              return (
                <div key={section.id} className="flex flex-col gap-2">
                  <h3
                    className={cn(
                      "text-[15px] font-semibold leading-snug",
                      groupLimitReached
                        ? "storefront-modal-accent"
                        : "text-[#242424]",
                    )}
                  >
                    {headerText}
                  </h3>
                  <div
                    className={cn(
                      "grid grid-cols-3 gap-2",
                      section.toppings.length > 6 &&
                        "max-h-[320px] overflow-y-auto pr-1",
                    )}
                  >
                    {section.toppings.map((topping) => {
                      const quantity =
                        cartToppings.find((x) => x.id === topping.id)?.quantity ??
                        0
                      const addDisabled =
                        section.max_selections != null &&
                        selectedInGroup >= section.max_selections

                      return (
                        <ToppingCard
                          key={topping.id}
                          topping={topping}
                          quantity={quantity}
                          onAdd={() =>
                            addTopping(topping, groupToppingIds, section.max_selections)
                          }
                          onRemove={() => removeTopping(topping.id)}
                          addDisabled={addDisabled}
                          name={pickLocalizedName(topping, lang)}
                          priceLabel={
                            section.free_count > 0 && freeUnitsRemaining > 0
                              ? freePriceLabel
                              : formatMoney(topping.price, lang)
                          }
                          priceIsFree={
                            section.free_count > 0 && freeUnitsRemaining > 0
                          }
                          decreaseLabel={t.cart.decrease}
                          increaseLabel={t.cart.increase}
                        />
                      )
                    })}
                  </div>
                </div>
              )
            })}
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
