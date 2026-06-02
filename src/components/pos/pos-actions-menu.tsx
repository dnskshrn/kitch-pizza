"use client"

import { CloseShiftModal } from "@/components/pos/close-shift-modal"
import { CreateTransactionModal } from "@/components/pos/create-transaction-modal"
import { ShiftDataModal } from "@/components/pos/shift-data-modal"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { rawbtOpenDrawer } from "@/lib/rawbt"
import { MoreVertical } from "lucide-react"
import { useState } from "react"

type PosActionsMenuProps = {
  cashSessionId: string
  shiftLogId: string
  staffId: string
}

export function PosActionsMenu({
  cashSessionId,
  shiftLogId,
  staffId,
}: PosActionsMenuProps) {
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [closeShiftModalOpen, setCloseShiftModalOpen] = useState(false)
  const [transactionModalOpen, setTransactionModalOpen] = useState(false)
  const [shiftDataModalOpen, setShiftDataModalOpen] = useState(false)

  return (
    <>
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-[#242424] shadow-sm transition-colors hover:bg-zinc-50"
            aria-label="Действия"
          >
            <MoreVertical className="size-4" aria-hidden />
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-auto min-w-[12rem] p-1">
          <button
            type="button"
            onClick={() => {
              setPopoverOpen(false)
              setTransactionModalOpen(true)
            }}
            className="w-full rounded-md px-3 py-2 text-left text-sm text-[#242424] hover:bg-[#f2f2f2]"
          >
            Создать транзакцию
          </button>
          <button
            type="button"
            onClick={() => {
              setPopoverOpen(false)
              setShiftDataModalOpen(true)
            }}
            className="w-full rounded-md px-3 py-2 text-left text-sm text-[#242424] hover:bg-[#f2f2f2]"
          >
            Данные смены
          </button>
          <div className="mx-1 my-1 h-px bg-[#f2f2f2]" />
          <button
            type="button"
            onClick={() => {
              setPopoverOpen(false)
              setCloseShiftModalOpen(true)
            }}
            className="w-full rounded-md px-3 py-2 text-left text-sm text-[#242424] hover:bg-[#f2f2f2]"
          >
            Закрыть смену
          </button>
          <div className="mx-1 my-1 h-px bg-[#f2f2f2]" />
          <button
            type="button"
            onClick={() => {
              setPopoverOpen(false)
              rawbtOpenDrawer()
            }}
            className="w-full rounded-md px-3 py-2 text-left text-sm text-[#808080] hover:bg-[#f2f2f2]"
          >
            Открыть денежный ящик
          </button>
        </PopoverContent>
      </Popover>

      <CloseShiftModal
        open={closeShiftModalOpen}
        cashSessionId={cashSessionId}
        onClose={() => setCloseShiftModalOpen(false)}
      />
      <CreateTransactionModal
        open={transactionModalOpen}
        cashSessionId={cashSessionId}
        staffId={staffId}
        onClose={() => setTransactionModalOpen(false)}
      />
      <ShiftDataModal
        open={shiftDataModalOpen}
        shiftLogId={shiftLogId}
        onClose={() => setShiftDataModalOpen(false)}
      />
    </>
  )
}
