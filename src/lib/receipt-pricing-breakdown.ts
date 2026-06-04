import type { AppliedDiscount } from "@/types/promotions"

export type ReceiptPricingBreakdown = {
  subtotalMdl: number
  itemDiscountMdl: number
  promoDiscountMdl: number
  promoCode: string | null
  bonusRedeemedMdl: number
  deliveryFeeMdl: number
  showDelivery: boolean
  totalMdl: number
}

function baniToMdl(bani: number): number {
  return Math.round(bani) / 100
}

function splitDiscountsFromApplied(applied: AppliedDiscount[]): {
  itemDiscountBani: number
  promoDiscountBani: number
} {
  let itemDiscountBani = 0
  let promoDiscountBani = 0

  for (const entry of applied) {
    if (entry.effect_type === "item_percent") {
      itemDiscountBani += entry.discount_bani
    } else {
      promoDiscountBani += entry.discount_bani
    }
  }

  return { itemDiscountBani, promoDiscountBani }
}

export function buildReceiptPricingBreakdown(input: {
  subtotalBani?: number | null
  itemDiscountBani?: number | null
  promoDiscountBani?: number | null
  promoCode?: string | null
  bonusRedeemedMdl?: number | null
  deliveryFeeBani?: number | null
  showDelivery: boolean
  totalBani: number
  goodsSubtotalBani?: number | null
  appliedDiscounts?: AppliedDiscount[]
  legacyDiscountBani?: number | null
}): ReceiptPricingBreakdown {
  let itemDiscountBani = Math.max(0, Math.round(input.itemDiscountBani ?? 0))
  let promoDiscountBani = Math.max(0, Math.round(input.promoDiscountBani ?? 0))

  if (itemDiscountBani === 0 && promoDiscountBani === 0 && input.appliedDiscounts?.length) {
    const split = splitDiscountsFromApplied(input.appliedDiscounts)
    itemDiscountBani = split.itemDiscountBani
    promoDiscountBani = split.promoDiscountBani
  }

  if (itemDiscountBani === 0 && promoDiscountBani === 0) {
    const legacy = Math.max(0, Math.round(input.legacyDiscountBani ?? 0))
    if (input.promoCode?.trim()) {
      promoDiscountBani = legacy
    } else {
      itemDiscountBani = legacy
    }
  }

  let subtotalBani = Math.max(0, Math.round(input.subtotalBani ?? 0))
  if (subtotalBani <= 0) {
    const goods = Math.max(0, Math.round(input.goodsSubtotalBani ?? 0))
    subtotalBani = goods + itemDiscountBani
  }

  const bonusRedeemedMdl = Math.max(
    0,
    Math.floor(Number(input.bonusRedeemedMdl ?? 0) || 0),
  )

  return {
    subtotalMdl: baniToMdl(subtotalBani),
    itemDiscountMdl: baniToMdl(itemDiscountBani),
    promoDiscountMdl: baniToMdl(promoDiscountBani),
    promoCode: input.promoCode?.trim() || null,
    bonusRedeemedMdl,
    deliveryFeeMdl: baniToMdl(input.deliveryFeeBani ?? 0),
    showDelivery: input.showDelivery,
    totalMdl: baniToMdl(input.totalBani),
  }
}
