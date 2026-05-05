"use client"

import {
  selectCartItemCount,
  selectCartSubtotal,
  useCartStore,
} from "@/lib/store/cart-store"
import { useLanguage } from "@/lib/store/language-store"
import { useProductModalStore } from "@/lib/store/product-modal-store"
import type { CartItem } from "@/types/cart"
import { useEffect, useState } from "react"
import { CartContent } from "./CartContent"
import { CartPanel } from "./CartPanel"
import { CartSheet } from "./CartSheet"

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

export function CartRoot({ brandSlug }: { brandSlug: string }) {
  const { t } = useLanguage()
  const isMobile = useIsMobileViewport()
  const isOpen = useCartStore((s) => s.isOpen)
  const items = useCartStore((s) => s.items)
  const closeCart = useCartStore((s) => s.closeCart)
  const removeItem = useCartStore((s) => s.removeItem)
  const updateQuantity = useCartStore((s) => s.updateQuantity)
  const itemCount = useCartStore(selectCartItemCount)
  const subtotal = useCartStore(selectCartSubtotal)
  const openForEdit = useProductModalStore((s) => s.openForEdit)

  const handleEditItem = (cartItem: CartItem) => {
    const isDesktop =
      typeof window !== "undefined" && window.innerWidth >= 768
    if (!isDesktop) {
      closeCart()
    }
    openForEdit(
      cartItem.menuItem,
      cartItem.selectedSize ?? undefined,
      cartItem.selectedToppingIds,
      cartItem.id,
      cartItem.variantId ?? undefined,
    )
  }

  const contentProps = {
    brandSlug,
    items,
    subtotal,
    itemCount,
    onClose: closeCart,
    onEditItem: handleEditItem,
    onRemoveItem: removeItem,
    onQuantityChange: updateQuantity,
  }

  return isMobile ? (
    <CartSheet isOpen={isOpen} onClose={closeCart} title={t.cart.total}>
      <CartContent {...contentProps} />
    </CartSheet>
  ) : (
    <CartPanel isOpen={isOpen} onClose={closeCart}>
      <CartContent {...contentProps} />
    </CartPanel>
  )
}
