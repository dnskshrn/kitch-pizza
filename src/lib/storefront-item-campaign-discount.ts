import { calcCompareAt, discountRateFromEffectValue } from "@/lib/discount"
import { isRuleScheduleActive } from "@/lib/discount-engine"
import type { MenuItem } from "@/types/database"
import type { DiscountRule } from "@/types/promotions"

export type ItemCampaignDiscount = {
  discountedPriceBani: number
  originalPriceBani: number
  hasCampaign: boolean
}

type CampaignItemFields = Pick<MenuItem, "id" | "price" | "discount_percent">

export function getItemCampaignDiscount(
  item: CampaignItemFields,
  rules: DiscountRule[],
  unitPriceBani?: number | null,
  now: Date = new Date(),
): ItemCampaignDiscount {
  const shelfBani = unitPriceBani ?? item.price ?? 0

  const rule = [...rules]
    .sort((a, b) => b.priority - a.priority)
    .find(
      (r) =>
        r.effect_type === "item_percent" &&
        r.effect_value != null &&
        isRuleScheduleActive(r, now) &&
        r.target_item_ids?.includes(item.id),
    )

  if (rule?.effect_value != null) {
    const originalPriceBani = shelfBani
    const rate = discountRateFromEffectValue(rule.effect_value)
    const discountedPriceBani = Math.round(shelfBani * (1 - rate))
    return {
      discountedPriceBani,
      originalPriceBani,
      hasCampaign: discountedPriceBani < originalPriceBani,
    }
  }

  const discountPercent = item.discount_percent ?? 0
  const hasLegacyDiscount =
    discountPercent > 0 && discountPercent < 100 && shelfBani > 0

  return {
    discountedPriceBani: shelfBani,
    originalPriceBani: hasLegacyDiscount
      ? calcCompareAt(shelfBani, discountPercent)
      : shelfBani,
    hasCampaign: hasLegacyDiscount,
  }
}
