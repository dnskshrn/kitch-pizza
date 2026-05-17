import { CheckoutView } from "./checkout-view"
import { getStorefrontCartPricingBootstrap } from "@/lib/actions/discounts"
import { getBrand } from "@/lib/get-brand"

export default async function CheckoutPage() {
  const brand = await getBrand()
  const pricingBootstrap = await getStorefrontCartPricingBootstrap()

  return (
    <CheckoutView
      brandName={brand.name}
      brandLogo={brand.logo}
      brandSlug={brand.slug}
      pricingBootstrap={pricingBootstrap}
    />
  )
}
