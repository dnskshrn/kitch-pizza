"use client"

import { useAuthStore } from "@/store/auth-store"
import { useRouter } from "next/navigation"
import { useEffect } from "react"

export function AuthButton() {
  const router = useRouter()
  const profile = useAuthStore((state) => state.profile)
  const setProfile = useAuthStore((state) => state.setProfile)
  const openAuth = useAuthStore((state) => state.openAuth)

  useEffect(() => {
    let isMounted = true

    async function loadProfile() {
      try {
        const response = await fetch("/api/auth/me")
        if (!response.ok) return

        const data = (await response.json()) as {
          profile: { profileId: string; phone: string; name?: string } | null
        }
        if (isMounted) {
          setProfile(data.profile)
        }
      } catch {
        if (isMounted) {
          setProfile(null)
        }
      }
    }

    loadProfile()

    return () => {
      isMounted = false
    }
  }, [setProfile])

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
