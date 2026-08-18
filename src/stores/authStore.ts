import { create } from "zustand"
import type { User } from "@/types/auth"
import { getMe } from "@/lib/authApi"

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isHydrating: boolean
  login: (user: User, token: string) => void
  logout: () => void
  hydrate: () => Promise<void>
  setUser: (user: User) => void
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: localStorage.getItem("auth_token"),
  isAuthenticated: !!localStorage.getItem("auth_token"),
  isHydrating: false,

  login: (user, token) => {
    localStorage.setItem("auth_token", token)
    set({ user, token, isAuthenticated: true })
  },

  logout: () => {
    localStorage.removeItem("auth_token")
    set({ user: null, token: null, isAuthenticated: false })
  },

  setUser: (user) => set({ user }),

  hydrate: async () => {
    const { token, user } = get()
    if (!token || user) return
    set({ isHydrating: true })
    try {
      const freshUser = await getMe()
      set({ user: freshUser, isAuthenticated: true })
    } catch {
      localStorage.removeItem("auth_token")
      set({ user: null, token: null, isAuthenticated: false })
    } finally {
      set({ isHydrating: false })
    }
  },
}))