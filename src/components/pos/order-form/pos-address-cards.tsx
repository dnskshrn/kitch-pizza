"use client"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { CustomerAddress } from "@/types/database"

interface PosAddressCardsProps {
  addresses: CustomerAddress[]
  selectedAddressId: string | null
  onSelect: (address: CustomerAddress) => void
  onNewAddress: () => void
}

function formatAddressDetails(address: CustomerAddress): string | null {
  const parts: string[] = []
  const entrance = address.entrance?.trim()
  const floor = address.floor?.trim()
  const apartment = address.apartment?.trim()
  const intercom = address.intercom?.trim()

  if (entrance) parts.push(`под. ${entrance}`)
  if (floor) parts.push(`эт. ${floor}`)
  if (apartment) parts.push(`кв. ${apartment}`)
  if (intercom) parts.push(`домофон ${intercom}`)

  return parts.length > 0 ? parts.join(", ") : null
}

function PosAddressCards({
  addresses,
  selectedAddressId,
  onSelect,
  onNewAddress,
}: PosAddressCardsProps) {
  if (addresses.length === 0) return null

  return (
    <div className="space-y-2">
      {addresses.map((address) => {
        const details = formatAddressDetails(address)
        const isSelected = selectedAddressId === address.id

        return (
          <button
            key={address.id}
            type="button"
            onClick={() => onSelect(address)}
            className={cn(
              "w-full cursor-pointer rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-accent/10",
              isSelected
                ? "border-2 border-[--color-accent]"
                : "border border-border",
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-[var(--color-text)]">
                  {address.address}
                </p>
                {details ? (
                  <p className="mt-0.5 text-xs text-[var(--color-text)]/70">
                    {details}
                  </p>
                ) : null}
              </div>
              {address.is_default ? (
                <Badge variant="secondary" className="shrink-0">
                  Основной
                </Badge>
              ) : null}
            </div>
          </button>
        )
      })}

      <button
        type="button"
        onClick={onNewAddress}
        className="mt-2 text-sm text-[--color-accent] underline"
      >
        + Новый адрес
      </button>
    </div>
  )
}

export { PosAddressCards }
