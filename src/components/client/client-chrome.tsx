"use client"

import { AuthModal } from "@/components/client/auth/auth-modal"
import { CartRoot } from "@/components/client/cart/CartRoot"
import { DeliveryRoot } from "@/components/client/delivery-modal"
import { MainHeader } from "@/components/client/main-header"
import { MenuCategoryBar } from "@/components/client/menu-category-bar"
import { ProductModalRoot } from "@/components/client/product-modal/ProductModalRoot"
import { StorefrontHaptics } from "@/components/client/storefront-haptics"
import { TopNav } from "@/components/client/top-nav"
import type { Category } from "@/types/database"
import { usePathname } from "next/navigation"
import { useEffect } from "react"

type ClientChromeProps = {
  brandSlug: string
  categories: Category[]
  children: React.ReactNode
}

function hasBoutiqueStorefront(brandSlug: string): boolean {
  return brandSlug === "the-spot" || brandSlug === "losos"
}

export function ClientChrome({
  brandSlug,
  categories,
  children,
}: ClientChromeProps) {
  const pathname = usePathname()
  const isCheckoutFlow = pathname.startsWith("/checkout")
  const isBoutiqueStorefront = hasBoutiqueStorefront(brandSlug)

  useEffect(() => {
    const previousBrand = document.body.dataset.brand
    document.body.dataset.brand = brandSlug

    return () => {
      if (previousBrand) {
        document.body.dataset.brand = previousBrand
      } else {
        delete document.body.dataset.brand
      }
    }
  }, [brandSlug])

  if (isCheckoutFlow) {
    return (
      <>
        <StorefrontHaptics />
        <ProductModalRoot />
        <DeliveryRoot />
        <CartRoot />
        <AuthModal />
        <main className="flex-1">{children}</main>
      </>
    )
  }

  return (
    <>
      <StorefrontHaptics />
      {isBoutiqueStorefront ? null : <TopNav />}
      <MainHeader brandSlug={brandSlug} />
      {isBoutiqueStorefront ? null : (
        <MenuCategoryBar brandSlug={brandSlug} categories={categories} />
      )}
      <ProductModalRoot />
      <DeliveryRoot />
      <CartRoot />
      <AuthModal />
      <main className="flex-1">{children}</main>
    </>
  )
}
