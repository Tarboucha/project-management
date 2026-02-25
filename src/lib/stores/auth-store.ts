import { create } from "zustand"
import type { Actor } from "@/generated/prisma/browser"
import { api } from "@/lib/utils/api-client"

interface AuthState {
  actor: Actor | null
  isLoading: boolean
  isInitialized: boolean
}

interface AuthActions {
  setActor: (actor: Actor | null) => void
  clearActor: () => void
  fetchActor: () => Promise<void>
  isAdmin: () => boolean
}

type AuthStore = AuthState & AuthActions

export const useAuthStore = create<AuthStore>((set, get) => ({
  actor: null,
  isLoading: true,
  isInitialized: false,

  setActor: (actor) => set({ actor, isInitialized: true }),

  clearActor: () => set({ actor: null, isInitialized: true }),

  fetchActor: async () => {
    set({ isLoading: true })

    const result = await api.get<{ actor: Actor }>("/api/auth/me", { maxRetries: 2 })

    if (result.success && result.data?.actor) {
      set({ actor: result.data.actor, isLoading: false, isInitialized: true })
    } else {
      set({ actor: null, isLoading: false, isInitialized: true })
    }
  },

  isAdmin: () => get().actor?.systemRole === "ADMIN",
}))
