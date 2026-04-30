"use client"

import { Trash2 } from "lucide-react"
import { motion, type PanInfo, useAnimation } from "motion/react"
import type { ReactNode } from "react"

type SwipeToDeleteProps = {
  children: ReactNode
  onDelete: () => void
  disabled?: boolean
}

export function SwipeToDelete({
  children,
  disabled = false,
  onDelete,
}: SwipeToDeleteProps) {
  const controls = useAnimation()

  if (disabled) return <>{children}</>

  return (
    <div
      className="relative overflow-hidden rounded-lg bg-[#ef4444]"
      style={{ touchAction: "pan-y" }}
    >
      <button
        type="button"
        className="absolute inset-y-0 right-0 flex w-[72px] items-center justify-center rounded-r-lg text-white"
        aria-label="Удалить позицию"
        onClick={onDelete}
      >
        <Trash2 className="size-5" strokeWidth={2.5} aria-hidden />
      </button>
      <motion.div
        className="relative z-10 w-full rounded-lg"
        animate={controls}
        initial={{ x: 0 }}
        drag="x"
        dragConstraints={{ left: -72, right: 0 }}
        dragElastic={0.1}
        onDragEnd={async (
          _event: MouseEvent | TouchEvent | PointerEvent,
          info: PanInfo,
        ) => {
          if (info.offset.x < -48) {
            void controls.start({
              x: -72,
              transition: { type: "spring", stiffness: 500, damping: 40 },
            })
            return
          }

          void controls.start({
            x: 0,
            transition: { type: "spring", stiffness: 500, damping: 40 },
          })
        }}
      >
        {children}
      </motion.div>
    </div>
  )
}
