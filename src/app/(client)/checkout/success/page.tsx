import { CheckoutSuccessView } from "@/components/client/checkout/checkout-success-view"
import { CheckoutSkeleton } from "@/components/client/storefront-skeletons"
import { getBrandId } from "@/lib/get-brand-id"
import { getBrand } from "@/lib/get-brand"
import { createServiceSupabaseClient } from "@/lib/supabase/server"
import { Suspense } from "react"

export const dynamic = "force-dynamic"

type SuccessPageProps = {
  searchParams: Record<string, string | string[] | undefined>
}

function pickOrderSearchParam(
  searchParams: SuccessPageProps["searchParams"],
): string | undefined {
  const raw = searchParams.order
  if (typeof raw === "string") return raw
  if (
    Array.isArray(raw) &&
    raw.length > 0 &&
    typeof raw[0] === "string"
  ) {
    return raw[0]
  }
  return undefined
}

async function loadOrderTotalsForSuccess(
  orderParam: string | undefined,
): Promise<{ totalBani: number; bonusesRedeemedPoints: number } | null> {
  if (!orderParam) return null
  const parsed = Number.parseInt(orderParam.trim(), 10)
  if (!Number.isFinite(parsed) || parsed < 1) return null

  try {
    const brandId = await getBrandId()
    const supabase = createServiceSupabaseClient()
    const { data, error } = await supabase
      .from("orders")
      .select("total, bonuses_redeemed")
      .eq("brand_id", brandId)
      .eq("order_number", parsed)
      .maybeSingle()

    if (error || !data) return null

    const totalBani =
      typeof (data as { total: unknown }).total === "number"
        ? (data as { total: number }).total
        : 0
    const rawBonus = (data as { bonuses_redeemed?: unknown }).bonuses_redeemed
    const bonusesRedeemedPoints =
      typeof rawBonus === "number" && Number.isFinite(rawBonus)
        ? Math.max(0, Math.floor(rawBonus))
        : 0

    return { totalBani, bonusesRedeemedPoints }
  } catch {
    return null
  }
}

export default async function CheckoutSuccessPage({
  searchParams,
}: SuccessPageProps) {
  const brand = await getBrand()
  const orderTotals = await loadOrderTotalsForSuccess(
    pickOrderSearchParam(searchParams),
  )

  return (
    <Suspense fallback={<CheckoutSkeleton brandSlug={brand.slug} />}>
      <CheckoutSuccessView
        brandName={brand.name}
        brandLogo={brand.logo}
        brandSlug={brand.slug}
        orderTotals={orderTotals}
      />
    </Suspense>
  )
}
