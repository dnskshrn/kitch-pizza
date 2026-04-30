import { CheckoutSuccessView } from "@/components/client/checkout/checkout-success-view"
import { CheckoutSkeleton } from "@/components/client/storefront-skeletons"
import { getBrand } from "@/lib/get-brand"
import { Suspense } from "react"

export default async function CheckoutSuccessPage() {
  const brand = await getBrand()

  return (
    <Suspense fallback={<CheckoutSkeleton brandSlug={brand.slug} />}>
      <CheckoutSuccessView
        brandName={brand.name}
        brandLogo={brand.logo}
        brandSlug={brand.slug}
      />
    </Suspense>
  )
}
