import type { PromoCode } from "@/types/database"

/**
 * «Старая» цена (в бани) для зачёркивания; в БД не хранится.
 * `price` — актуальная цена в бани, `discountPercent` — скидка в процентах.
 */
export function calcCompareAt(price: number, discountPercent: number): number {
  return Math.round(price / (1 - discountPercent / 100))
}

/** Сумма скидки по промокоду в бани. */
export function calcPromoDiscount(promo: PromoCode, subtotalBani: number): number {
  if (promo.discount_type === "percent") {
    return Math.round((subtotalBani * promo.discount_value) / 100)
  }
  return Math.min(promo.discount_value, subtotalBani)
}
