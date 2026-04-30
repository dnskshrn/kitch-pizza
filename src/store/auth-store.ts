import { create } from "zustand"

interface Profile {
  profileId: string
  phone: string
  name?: string
}

interface AuthStore {
  profile: Profile | null
  isOpen: boolean
  setProfile: (p: Profile | null) => void
  openAuth: () => void
  closeAuth: () => void
}

export const useAuthStore = create<AuthStore>((set) => ({
  profile: null,
  isOpen: false,
  setProfile: (profile) => set({ profile }),
  openAuth: () => set({ isOpen: true }),
  closeAuth: () => set({ isOpen: false }),
}))
