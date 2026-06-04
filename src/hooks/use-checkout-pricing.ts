"use client"

import type { CartItem } from "@/types/cart"
import type { PricingResult } from "@/lib/pricing"
import { useEffect, useMemo, useRef, useState } from "react"

function cartItemsToPricingPayload(items: CartItem[]) {
  return items.map((ci) => ({
    menu_item_id: ci.menuItem.id,
    quantity: ci.quantity,
    ...(ci.variantId ? { variant_id: ci.variantId } : {}),
  }))
}

export type UseCheckoutPricingArgs = {
  brandSlug: string
  items: CartItem[]
  deliveryMode: "delivery" | "pickup"
  deliveryFeeBani: number
  promoCode: string | null
  bonusesToRedeem: number
  enabled: boolean
}

export function useCheckoutPricing({
  brandSlug,
  items,
  deliveryMode,
  deliveryFeeBani,
  promoCode,
  bonusesToRedeem,
  enabled,
}: UseCheckoutPricingArgs) {
  const [pricing, setPricing] = useState<PricingResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const requestSeq = useRef(0)

  const itemsKey = useMemo(
    () =>
      items
        .map(
          (ci) =>
            `${ci.menuItem.id}:${ci.quantity}:${ci.variantId ?? ""}`,
        )
        .join("|"),
    [items],
  )

  useEffect(() => {
    if (!enabled || items.length === 0) {
      setPricing(null)
      setError(null)
      setLoading(false)
      return
    }

    const seq = ++requestSeq.current
    const controller = new AbortController()

    const timer = window.setTimeout(async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/${brandSlug}/checkout/pricing`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            items: cartItemsToPricingPayload(items),
            delivery_fee: deliveryFeeBani,
            delivery_mode: deliveryMode,
            ...(promoCode ? { promo_code: promoCode } : {}),
            ...(bonusesToRedeem > 0
              ? { bonuses_to_redeem: bonusesToRedeem }
              : {}),
          }),
        })

        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as {
            error?: string
          } | null
          throw new Error(body?.error ?? "Pricing request failed")
        }

        const data = (await res.json()) as PricingResult
        if (seq !== requestSeq.current) return
        setPricing(data)
      } catch (e) {
        if (controller.signal.aborted) return
        if (seq !== requestSeq.current) return
        setError(e instanceof Error ? e.message : "Pricing request failed")
      } finally {
        if (seq === requestSeq.current) setLoading(false)
      }
    }, 300)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [
    brandSlug,
    itemsKey,
    deliveryMode,
    deliveryFeeBani,
    promoCode,
    bonusesToRedeem,
    enabled,
    items.length,
  ])

  return { pricing, loading, error }
}
