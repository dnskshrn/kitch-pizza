export interface ToppingSelection {
  id: string
  price: number
  quantity: number
}

/**
 * Calculates the actual charge for a set of selected toppings,
 * given how many units are free for this product↔group combination.
 *
 * Strategy: cheapest units are free first.
 */
export function calcToppingGroupCharge(
  selections: ToppingSelection[],
  freeCount: number,
): number {
  if (freeCount <= 0) {
    return selections.reduce((sum, t) => sum + t.price * t.quantity, 0)
  }

  const units: number[] = []
  for (const t of selections) {
    for (let i = 0; i < t.quantity; i++) {
      units.push(t.price)
    }
  }
  units.sort((a, b) => a - b)

  return units.slice(freeCount).reduce((sum, p) => sum + p, 0)
}

/** Сколько бесплатных единиц ещё можно добавить в группу. */
export function getFreeUnitsRemaining(
  selections: ToppingSelection[],
  freeCount: number,
): number {
  const totalSelected = selections.reduce((sum, t) => sum + t.quantity, 0)
  return Math.max(0, freeCount - totalSelected)
}

/** Сумма к оплате по каждому topping id (cheapest-first). */
export function calcToppingChargesById(
  selections: ToppingSelection[],
  freeCount: number,
): Map<string, number> {
  type Unit = { id: string; price: number }
  const units: Unit[] = []
  for (const t of selections) {
    for (let i = 0; i < t.quantity; i++) {
      units.push({ id: t.id, price: t.price })
    }
  }
  units.sort((a, b) => a.price - b.price || a.id.localeCompare(b.id))

  const charges = new Map<string, number>()
  for (const t of selections) {
    charges.set(t.id, 0)
  }
  for (let i = freeCount; i < units.length; i++) {
    const u = units[i]!
    charges.set(u.id, (charges.get(u.id) ?? 0) + u.price)
  }
  return charges
}

export function formatStorefrontToppingGroupHeader(opts: {
  lang: "RU" | "RO"
  groupName: string
  selectedCount: number
  maxSelections: number | null
  freeCount: number
  selections: ToppingSelection[]
}): string {
  const { lang, groupName, selectedCount, maxSelections, freeCount, selections } =
    opts

  if (freeCount <= 0) {
    if (maxSelections != null) {
      return lang === "RO"
        ? `${groupName} — selectat ${selectedCount} din ${maxSelections}`
        : `${groupName} — выбрано ${selectedCount} из ${maxSelections}`
    }
    return groupName
  }

  const freeRemaining = getFreeUnitsRemaining(selections, freeCount)

  let title = groupName
  if (selectedCount > 0) {
    if (maxSelections != null) {
      title =
        lang === "RO"
          ? `${groupName} — selectat ${selectedCount} din ${maxSelections}`
          : `${groupName} — выбрано ${selectedCount} из ${maxSelections}`
    } else {
      title =
        lang === "RO"
          ? `${groupName} — selectat ${selectedCount}`
          : `${groupName} — выбрано ${selectedCount}`
    }
  }

  let freePart: string
  if (selectedCount === 0) {
    freePart =
      lang === "RO" ? `${freeCount} gratuit` : `${freeCount} бесплатно`
  } else if (freeRemaining > 0) {
    freePart =
      lang === "RO"
        ? `încă ${freeRemaining} gratuit`
        : `ещё ${freeRemaining} бесплатно`
  } else if (selectedCount <= freeCount) {
    freePart = lang === "RO" ? "toate gratuite" : "все бесплатно"
  } else {
    const paid = selectedCount - freeCount
    freePart =
      lang === "RO"
        ? `${freeCount} gratuit, ${paid} cu plată`
        : `${freeCount} бесплатно, ${paid} платно`
  }

  return `${title} · ${freePart}`
}
