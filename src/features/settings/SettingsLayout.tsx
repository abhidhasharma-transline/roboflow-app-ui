import { NavLink, Outlet } from "react-router-dom"
import { cn } from "@/lib/utils"

const TABS = [
  { to: "/settings/account", label: "Profile" },
  { to: "/settings/workspaces", label: "Workspaces" },
]

export function SettingsLayout() {
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="px-8">
        <nav className="flex gap-6">
          {TABS.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              className={({ isActive }) =>
                cn(
                  "border-b-2 px-1 py-3 text-sm font-medium transition-colors",
                  isActive
                    ? "border-brand text-brand"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                )
              }
            >
              {tab.label}
            </NavLink>
          ))}
        </nav>
      </div>
      <Outlet />
    </div>
  )
}
