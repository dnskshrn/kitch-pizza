import { CheckoutSuccessView } from "@/components/client/checkout/checkout-success-view"
import { getBrand } from "@/lib/get-brand"
import { Suspense } from "react"

export default async function CheckoutSuccessPage() {
  const brand = await getBrand()

  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center text-[#808080]">
          Загрузка…
        </div>
      }
    >
      <CheckoutSuccessView
        brandName={brand.name}
        brandLogo={brand.logo}
        brandSlug={brand.slug}
      />
    </Suspense>
  )
}
