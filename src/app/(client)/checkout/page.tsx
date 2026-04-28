import { CheckoutView } from "./checkout-view"
import { getBrand } from "@/lib/get-brand"

export default async function CheckoutPage() {
  const brand = await getBrand()

  return (
    <CheckoutView
      brandName={brand.name}
      brandLogo={brand.logo}
      brandSlug={brand.slug}
    />
  )
}
