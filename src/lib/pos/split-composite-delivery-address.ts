/**
 * Витрина и старые заказы часто хранят подъезд/этаж/кв./домофон в одной строке
 * `delivery_address`. Для POS раскладываем их по полям, если отдельные колонки пусты.
 */
export type SplitCompositeDeliveryAddressResult = {
  streetLine: string
  entrance: string
  floor: string
  apartment: string
  intercom: string
}

function compactStreetLine(s: string): string {
  return s
    .split(",")
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
    .join(", ")
    .trim()
}

const FIELD_SPECS = [
  {
    key: "intercom" as const,
    re: /(?:^|[\s,.])(?:interfon|домофон|intercom)\s*[.:]?\s*([^\s,.]+)/i,
  },
  {
    key: "apartment" as const,
    re: /(?:^|[\s,.])(?:apartament|apart|квартира|apartment)\s*[.:]?\s*([^\s,.]+)/i,
  },
  {
    key: "floor" as const,
    re: /(?:^|[\s,.])(?:etaj|этаж|floor)\s*[.:]?\s*([^\s,.]+)/i,
  },
  {
    key: "entrance" as const,
    re: /(?:^|[\s,.])(?:scara|подъезд|entrance)\s*[.:]?\s*([^\s,.]+)/i,
  },
]

export function splitCompositeDeliveryAddress(
  raw: string,
): SplitCompositeDeliveryAddressResult {
  const empty: SplitCompositeDeliveryAddressResult = {
    streetLine: "",
    entrance: "",
    floor: "",
    apartment: "",
    intercom: "",
  }
  const full = raw.trim()
  if (!full) return empty

  const out = { ...empty, streetLine: full }
  let work = full

  for (let i = 0; i < 24; i++) {
    let hit = false
    for (const { key, re } of FIELD_SPECS) {
      if (out[key]) continue
      const m = work.match(re)
      if (!m?.[1]) continue
      out[key] = m[1].trim()
      work = work.replace(re, " ").replace(/\s+/g, " ").trim()
      hit = true
      break
    }
    if (!hit) break
  }

  out.streetLine = compactStreetLine(work)
  return out
}

type OrderAddressSlice = {
  delivery_mode: "delivery" | "pickup" | "aggregator"
  delivery_address: string | null
  address_entrance: string | null
  address_floor: string | null
  address_apartment: string | null
  address_intercom: string | null
}

/** Значения для полей адреса в форме POS (шаг «Детали»). */
export function posCheckoutAddressFieldsFromOrder(
  o: OrderAddressSlice,
): Pick<
  SplitCompositeDeliveryAddressResult,
  "entrance" | "floor" | "apartment" | "intercom"
> & { deliveryAddress: string } {
  if (o.delivery_mode === "pickup") {
    return {
      deliveryAddress: "",
      entrance: "",
      floor: "",
      apartment: "",
      intercom: "",
    }
  }

  const entrance = o.address_entrance?.trim() ?? ""
  const floor = o.address_floor?.trim() ?? ""
  const apartment = o.address_apartment?.trim() ?? ""
  const intercom = o.address_intercom?.trim() ?? ""
  const hasGranular =
    entrance !== "" ||
    floor !== "" ||
    apartment !== "" ||
    intercom !== ""

  if (hasGranular) {
    return {
      deliveryAddress: o.delivery_address?.trim() ?? "",
      entrance,
      floor,
      apartment,
      intercom,
    }
  }

  const split = splitCompositeDeliveryAddress(o.delivery_address?.trim() ?? "")
  return {
    deliveryAddress: split.streetLine,
    entrance: split.entrance,
    floor: split.floor,
    apartment: split.apartment,
    intercom: split.intercom,
  }
}
