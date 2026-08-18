import { create } from "zustand"

type Theme = "light" | "dark"

function getStoredTheme(): Theme {
  return localStorage.getItem("theme") === "dark" ? "dark" : "light"
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark")
}

interface ThemeState {
  theme: Theme
  toggleTheme: () => void
  setTheme: (theme: Theme) => void
}

// Apply immediately on module load, before first paint, so there's no flash.
applyTheme(getStoredTheme())

export const useThemeStore = create<ThemeState>((set) => ({
  theme: getStoredTheme(),

  setTheme: (theme) => {
    localStorage.setItem("theme", theme)
    applyTheme(theme)
    set({ theme })
  },

  toggleTheme: () => {
    set((state) => {
      const next: Theme = state.theme === "dark" ? "light" : "dark"
      localStorage.setItem("theme", next)
      applyTheme(next)
      return { theme: next }
    })
  },
}))
