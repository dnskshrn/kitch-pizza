"use client"

import type { DiscountRule } from "@/types/promotions"
import { createContext, useContext } from "react"

const StorefrontCampaignRulesContext = createContext<DiscountRule[]>([])

export function StorefrontCampaignRulesProvider({
  rules,
  children,
}: {
  rules: DiscountRule[]
  children: React.ReactNode
}) {
  return (
    <StorefrontCampaignRulesContext.Provider value={rules}>
      {children}
    </StorefrontCampaignRulesContext.Provider>
  )
}

export function useStorefrontCampaignRules(): DiscountRule[] {
  return useContext(StorefrontCampaignRulesContext)
}
