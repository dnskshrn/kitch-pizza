"use client"

import { useAuthStore } from "@/lib/store/auth-store"
import { useRouter } from "next/navigation"

export function AuthButton() {
  const router = useRouter()
  const profile = useAuthStore((state) => state.profile)
  const openAuth = useAuthStore((state) => state.openAuth)

  return (
    <button
      type="button"
      onClick={() => {
        if (profile) {
          router.push("/account")
          return
        }

        openAuth()
      }}
      style={{
        border: "1px solid var(--color-accent)",
        borderRadius: "999px",
        background: "transparent",
        color: "var(--color-text)",
        cursor: "pointer",
        fontSize: "12px",
        fontWeight: 700,
        padding: "7px 12px",
      }}
    >
      {profile ? `${profile.phone.slice(0, 6)}…` : "Войти"}
    </button>
  )
}
