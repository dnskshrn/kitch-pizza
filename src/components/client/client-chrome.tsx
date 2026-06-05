"use client"

import { AuthInitializer } from "@/components/client/auth/auth-initializer"
import { AuthModal } from "@/components/client/auth/AuthModal"
import { CartRoot } from "@/components/client/cart/CartRoot"
import { DeliveryRoot } from "@/components/client/delivery-modal"
import { MainHeader } from "@/components/client/main-header"
import { MenuCategoryBar } from "@/components/client/menu-category-bar"
import { ProductModalRoot } from "@/components/client/product-modal/ProductModalRoot"
import { StorefrontCampaignRulesProvider } from "@/components/client/storefront-campaign-rules-context"
import type { DiscountRule } from "@/types/promotions"
import { StorefrontHaptics } from "@/components/client/storefront-haptics"
import type { Category } from "@/types/database"
import { htmlLang } from "@/lib/i18n/storefront"
import { useLanguageStore } from "@/lib/store/language-store"
import { usePathname } from "next/navigation"
import { useEffect } from "react"

type ClientChromeProps = {
  brandSlug: string
  categories: Category[]
  itemPercentCampaignRules: DiscountRule[]
  children: React.ReactNode
}

function hasBoutiqueStorefront(brandSlug: string): boolean {
  return (
    brandSlug === "the-spot" ||
    brandSlug === "losos" ||
    brandSlug === "kitch-pizza"
  )
}

export function ClientChrome({
  brandSlug,
  categories,
  itemPercentCampaignRules,
  children,
}: ClientChromeProps) {
  const pathname = usePathname()
  /** Включая `/losos/checkout`, `/thespot/checkout` и вложенные пути (`/checkout/success`). */
  const isCheckoutFlow = pathname.split("/").includes("checkout")
  const isBoutiqueStorefront = hasBoutiqueStorefront(brandSlug)

  useEffect(() => {
    document.documentElement.lang = htmlLang(useLanguageStore.getState().lang)
    return useLanguageStore.subscribe((s) => {
      document.documentElement.lang = htmlLang(s.lang)
    })
  }, [])

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

  return (
    <StorefrontCampaignRulesProvider rules={itemPercentCampaignRules}>
      <AuthInitializer />
      <AuthModal />
      {isCheckoutFlow ? (
        <>
          <StorefrontHaptics />
          <ProductModalRoot />
          <DeliveryRoot />
          <CartRoot brandSlug={brandSlug} />
          <main className="flex-1">{children}</main>
        </>
      ) : (
        <>
          <StorefrontHaptics />
          <MainHeader brandSlug={brandSlug} />
          {isBoutiqueStorefront ? null : (
            <MenuCategoryBar brandSlug={brandSlug} categories={categories} />
          )}
          <ProductModalRoot />
          <DeliveryRoot />
          <CartRoot brandSlug={brandSlug} />
          <main className="flex-1">{children}</main>
        </>
      )}
    </StorefrontCampaignRulesProvider>
  )
}
