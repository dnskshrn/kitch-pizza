"use client"

import { useState, useTransition, useRef, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { LogOut } from "lucide-react"
import {
  hasOpenShift,
  verifyCurrentStaffPin,
  logout,
} from "@/lib/actions/pos/auth"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

type PosLogoutButtonProps = {
  className?: string
}

export function PosLogoutButton({ className }: PosLogoutButtonProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [pin, setPin] = useState("")
  const [pinError, setPinError] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const pinInputRef = useRef<HTMLInputElement>(null)
  const submitLock = useRef(false)

  const performLogout = useCallback(() => {
    startTransition(async () => {
      await logout()
      router.push("/pos/login")
      router.refresh()
    })
  }, [router])

  useEffect(() => {
    if (!dialogOpen) return
    setPin("")
    setPinError(false)
    setVerifying(false)
    submitLock.current = false
    const id = requestAnimationFrame(() => {
      pinInputRef.current?.focus()
    })
    return () => cancelAnimationFrame(id)
  }, [dialogOpen])

  useEffect(() => {
    if (!dialogOpen || pin.length !== 4) {
      submitLock.current = false
      return
    }
    if (submitLock.current) return
    submitLock.current = true

    void (async () => {
      setVerifying(true)
      setPinError(false)
      const ok = await verifyCurrentStaffPin(pin)
      if (ok) {
        setDialogOpen(false)
        performLogout()
        return
      }
      setPinError(true)
      setPin("")
      setVerifying(false)
      submitLock.current = false
      requestAnimationFrame(() => {
        pinInputRef.current?.focus()
      })
    })()
  }, [pin, dialogOpen, performLogout])

  function handleClick() {
    if (pending || verifying) return
    startTransition(async () => {
      const open = await hasOpenShift()
      if (open) {
        setDialogOpen(true)
        return
      }
      await logout()
      router.push("/pos/login")
      router.refresh()
    })
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={pending || verifying}
        className={cn("gap-1.5", className)}
        onClick={handleClick}
      >
        <LogOut className="size-4" aria-hidden />
        Выйти
      </Button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Подтвердите выход</DialogTitle>
            <DialogDescription>
              Смена открыта. Введите PIN для выхода.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Input
              ref={pinInputRef}
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={pin}
              autoComplete="off"
              disabled={verifying || pending}
              aria-label="PIN"
              onChange={(e) => {
                const next = e.target.value.replace(/\D/g, "").slice(0, 4)
                setPin(next)
                if (pinError) setPinError(false)
              }}
              className="text-center text-2xl tracking-widest tabular-nums"
            />
            {pinError ? (
              <p className="text-center text-sm text-destructive" role="alert">
                Неверный PIN
              </p>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
