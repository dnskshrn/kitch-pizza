"use client"

import { create } from "zustand"

export type AuthProfile = {
  id: string
  phone: string
  name: string | null
}

type MeResponse = {
  profile: {
    id?: string
    profileId?: string
    phone?: string
    name?: string | null
  } | null
}

function normalizeProfile(
  raw: NonNullable<MeResponse["profile"]>,
): AuthProfile | null {
  const id =
    typeof raw.id === "string"
      ? raw.id
      : typeof raw.profileId === "string"
        ? raw.profileId
        : null
  if (!id || typeof raw.phone !== "string") return null
  return {
    id,
    phone: raw.phone,
    name:
      raw.name !== undefined && raw.name !== null ? String(raw.name) : null,
  }
}

type AuthState = {
  profile: AuthProfile | null
  isAuthOpen: boolean
  isLoading: boolean
  welcomeBonusPending: boolean
  onAuthSuccess: (() => void) | null
  openAuth: () => void
  closeAuth: () => void
  dismissAuth: () => void
  setOnAuthSuccess: (cb: (() => void) | null) => void
  setProfile: (profile: AuthProfile | null) => void
  setWelcomeBonusPending: (pending: boolean) => void
  clearProfile: () => void
  fetchMe: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set, get) => ({
  profile: null,
  isAuthOpen: false,
  isLoading: false,
  welcomeBonusPending: false,
  onAuthSuccess: null,
  openAuth: () => set({ isAuthOpen: true }),
  closeAuth: () =>
    set((state) => {
      const cb = state.onAuthSuccess
      if (cb) cb()
      return { isAuthOpen: false, onAuthSuccess: null }
    }),
  dismissAuth: () => set({ isAuthOpen: false, onAuthSuccess: null }),
  setOnAuthSuccess: (cb) => set({ onAuthSuccess: cb }),
  setProfile: (profile) => set({ profile }),
  setWelcomeBonusPending: (pending) => set({ welcomeBonusPending: pending }),
  clearProfile: () => set({ profile: null }),
  fetchMe: async () => {
    set({ isLoading: true })
    try {
      const res = await fetch("/api/auth/me", { credentials: "include" })
      if (res.status === 401) {
        get().clearProfile()
        return
      }
      if (!res.ok) return

      const data = (await res.json()) as MeResponse
      const raw = data.profile
      if (!raw) {
        get().clearProfile()
        return
      }
      const next = normalizeProfile(raw)
      if (!next) {
        get().clearProfile()
        return
      }
      set({ profile: next })
    } catch {
      // сеть / парсинг — не трогаем профиль
    } finally {
      set({ isLoading: false })
    }
  },
}))
