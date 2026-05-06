import { formatMoney, type Lang } from "@/lib/i18n/storefront"
import type { DeliveryMode } from "@/lib/store/delivery-store"
import type { DeliveryZone } from "@/types/database"

/** Мелкий текст под строкой «Доставка»; вне зоны и «укажите адрес» — взаимоисключающие. */
export type StorefrontDeliverySublineKind =
  | "addressCost"
  | "outOfZone"
  | null

export type StorefrontDeliveryLine = {
  amountLine: string
  sublineKind: StorefrontDeliverySublineKind
}

function amountDash(lang: Lang): string {
  return lang === "RO" ? "-- lei" : "-- лей"
}

/** Подпись суммы доставки в корзине / сводке checkout (валюта, зона, порог «бесплатно от»). */
export function getStorefrontDeliveryLineDisplay(input: {
  lang: Lang
  mode: DeliveryMode
  selectedZone: DeliveryZone | null
  deliveryFeeBani: number
  freeLabel: string
  /** Адрес привязан к точке вне полигонов доставки (`delivery-store.outOfZone`). */
  outOfZone: boolean
}): StorefrontDeliveryLine {
  const { lang, mode, selectedZone, deliveryFeeBani, freeLabel, outOfZone } =
    input
  if (mode === "pickup") {
    return { amountLine: freeLabel, sublineKind: null }
  }
  if (outOfZone) {
    return { amountLine: amountDash(lang), sublineKind: "outOfZone" }
  }
  if (!selectedZone) {
    return { amountLine: amountDash(lang), sublineKind: "addressCost" }
  }
  if (deliveryFeeBani === 0) {
    return { amountLine: freeLabel, sublineKind: null }
  }
  return {
    amountLine: formatMoney(deliveryFeeBani, lang),
    sublineKind: "addressCost",
  }
}
