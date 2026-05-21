"use client"

import { ToppingStepperCard } from "@/components/topping-stepper-card"
import type { Topping } from "@/types/database"

export type ToppingCardProps = {
  topping: Topping
  quantity: number
  onAdd: () => void
  onRemove: () => void
  addDisabled: boolean
  name: string
  priceLabel: string
  priceIsFree?: boolean
  decreaseLabel: string
  increaseLabel: string
}

export function ToppingCard({
  topping,
  quantity,
  onAdd,
  onRemove,
  addDisabled,
  name,
  priceLabel,
  priceIsFree = false,
  decreaseLabel,
  increaseLabel,
}: ToppingCardProps) {
  return (
    <ToppingStepperCard
      variant="storefront"
      imageUrl={topping.image_url}
      name={name}
      quantity={quantity}
      priceLabel={priceLabel}
      priceIsFree={priceIsFree}
      addDisabled={addDisabled}
      onAdd={onAdd}
      onRemove={onRemove}
      decreaseLabel={decreaseLabel}
      increaseLabel={increaseLabel}
    />
  )
}
