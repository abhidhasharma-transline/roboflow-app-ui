import { Sun, Moon } from "lucide-react"
import { useThemeStore } from "@/stores/themeStore"

export function ThemeToggle() {
  const { theme, toggleTheme } = useThemeStore()

  return (
    <button
      onClick={toggleTheme}
      aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
      className="relative flex size-9 items-center justify-center rounded-full text-topbar-muted transition-colors hover:bg-topbar-accent hover:text-topbar-foreground"
    >
      {theme === "dark" ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
    </button>
  )
}
