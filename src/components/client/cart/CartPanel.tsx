"use client"

import { cn } from "@/lib/utils"
import { useEffect, useState, type ReactNode } from "react"

const EXIT_MS = 300

type CartPanelProps = {
  isOpen: boolean
  onClose: () => void
  children: ReactNode
}

export function CartPanel({ isOpen, onClose, children }: CartPanelProps) {
  const [rendered, setRendered] = useState(false)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setRendered(true)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setVisible(true))
      })
    } else {
      setVisible(false)
      const t = setTimeout(() => setRendered(false), EXIT_MS)
      return () => clearTimeout(t)
    }
  }, [isOpen])

  if (!rendered) return null

  return (
    <>
      <div
        role="presentation"
        className={cn(
          "fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 ease-out",
          visible ? "opacity-100" : "opacity-0",
        )}
        onClick={onClose}
      />
      <div
        className={cn(
          "storefront-modal-bg fixed right-0 top-0 z-50 flex h-[100dvh] w-[420px] max-w-[100vw] flex-col shadow-none transition-transform duration-300 ease-out",
          visible ? "translate-x-0" : "translate-x-full",
        )}
      >
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{children}</div>
      </div>
    </>
  )
}
