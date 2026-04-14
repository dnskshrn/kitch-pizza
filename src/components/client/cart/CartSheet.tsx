"use client"

import { Drawer } from "vaul"
import type { ReactNode } from "react"

type CartSheetProps = {
  isOpen: boolean
  onClose: () => void
  title: string
  children: ReactNode
}

export function CartSheet({ isOpen, onClose, title, children }: CartSheetProps) {
  return (
    <Drawer.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-black/50" />
        <Drawer.Content className="fixed bottom-0 left-0 right-0 z-50 flex max-h-[92dvh] flex-col rounded-t-[24px] bg-[#f2f2f2] outline-none">
          <Drawer.Title className="sr-only">{title}</Drawer.Title>
          <div
            className="mx-auto mb-0 mt-3 h-1 w-10 shrink-0 rounded-full bg-[#ccc]"
            aria-hidden
          />
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden px-0 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-0">
            {children}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
