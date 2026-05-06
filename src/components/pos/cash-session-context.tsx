"use client"

import * as React from "react"

export type CashSessionContextValue = {
  cashSessionId: string
  staffId: string
}

export const CashSessionContext =
  React.createContext<CashSessionContextValue | null>(null)

export function CashSessionProvider({
  cashSessionId,
  staffId,
  children,
}: CashSessionContextValue & { children: React.ReactNode }) {
  return (
    <CashSessionContext.Provider value={{ cashSessionId, staffId }}>
      {children}
    </CashSessionContext.Provider>
  )
}

export function useCashSession(): CashSessionContextValue | null {
  return React.useContext(CashSessionContext)
}
