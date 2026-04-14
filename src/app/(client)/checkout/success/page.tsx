import { CheckoutSuccessView } from "@/components/client/checkout/checkout-success-view"
import { Suspense } from "react"

export default function CheckoutSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center text-[#808080]">
          Загрузка…
        </div>
      }
    >
      <CheckoutSuccessView />
    </Suspense>
  )
}
