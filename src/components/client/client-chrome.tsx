"use client"

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

export function ClientChrome({
  brandSlug,
  categories,
  children,
}: ClientChromeProps) {
  const pathname = usePathname()
  const isCheckoutFlow = pathname.startsWith("/checkout")

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
        <main className="flex-1">{children}</main>
      </>
    )
  }

  return (
    <>
      <StorefrontHaptics />
      {brandSlug === "the-spot" ? null : <TopNav />}
      <MainHeader brandSlug={brandSlug} />
      {brandSlug === "the-spot" ? null : (
        <MenuCategoryBar brandSlug={brandSlug} categories={categories} />
      )}
      <ProductModalRoot />
      <DeliveryRoot />
      <CartRoot />
      <main className="flex-1">{children}</main>
    </>
  )
}
