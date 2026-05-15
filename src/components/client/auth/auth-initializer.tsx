"use client"

import { useAuthStore } from "@/lib/store/auth-store"
import { useEffect } from "react"

export function AuthInitializer() {
  const fetchMe = useAuthStore((s) => s.fetchMe)

  useEffect(() => {
    void fetchMe()
  }, [])

  return null
}
