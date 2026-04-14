"use client"

import { CartRoot } from "@/components/client/cart/CartRoot"
import { DeliveryRoot } from "@/components/client/delivery-modal"
import { MainHeader } from "@/components/client/main-header"
import { MenuCategoryBar } from "@/components/client/menu-category-bar"
import { ProductModalRoot } from "@/components/client/product-modal/ProductModalRoot"
import { TopNav } from "@/components/client/top-nav"
import type { Category } from "@/types/database"
import { usePathname } from "next/navigation"

type ClientChromeProps = {
  categories: Category[]
  children: React.ReactNode
}

export function ClientChrome({ categories, children }: ClientChromeProps) {
  const pathname = usePathname()
  const isCheckoutFlow = pathname.startsWith("/checkout")

  if (isCheckoutFlow) {
    return (
      <>
        <ProductModalRoot />
        <DeliveryRoot />
        <CartRoot />
        <main className="flex-1">{children}</main>
      </>
    )
  }

  return (
    <>
      <TopNav />
      <MainHeader />
      <MenuCategoryBar categories={categories} />
      <ProductModalRoot />
      <DeliveryRoot />
      <CartRoot />
      <main className="flex-1">{children}</main>
    </>
  )
}
