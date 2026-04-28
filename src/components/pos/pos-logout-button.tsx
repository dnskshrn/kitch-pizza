"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { LogOut } from "lucide-react"
import { logout } from "@/lib/actions/pos/auth"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type PosLogoutButtonProps = {
  className?: string
}

export function PosLogoutButton({ className }: PosLogoutButtonProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={pending}
      className={cn("gap-1.5", className)}
      onClick={() => {
        startTransition(async () => {
          await logout()
          router.push("/pos/login")
          router.refresh()
        })
      }}
    >
      <LogOut className="size-4" aria-hidden />
      Выйти
    </Button>
  )
}
