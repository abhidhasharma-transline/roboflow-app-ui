import { NavLink } from "react-router-dom"
import {
  Bot,
  FolderKanban,
  Images,
  Workflow,
  Cpu,
  Server,
  BarChart3,
  Compass,
  Settings,
  Bell,
  ChevronRight,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { WorkspaceSwitcher } from "./WorkspaceSwitcher"

interface NavItem {
  label: string
  icon: typeof Bot
  path?: string
  hasSubmenu?: boolean
  /** Not built yet — rendered visible but non-interactive. */
  disabled?: boolean
}

const navItems: NavItem[] = [
  { label: "Agent", icon: Bot, disabled: true },
  { label: "Projects", icon: FolderKanban, path: "/projects" },
  { label: "Asset Library", icon: Images, disabled: true },
  { label: "Workflows", icon: Workflow, disabled: true },
  { label: "Models", icon: Cpu, hasSubmenu: true, disabled: true },
  { label: "Deployments", icon: Server, hasSubmenu: true, disabled: true },
  { label: "Vision Events", icon: BarChart3, disabled: true },
  { label: "Explore", icon: Compass, disabled: true },
  { label: "Settings", icon: Settings, path: "/settings/account" },
  { label: "Activity", icon: Bell, disabled: true },
]

export function IconRail({ expanded }: { expanded: boolean }) {
  if (!expanded) {
    // Collapsed: icon-only rail, used once you're inside a project.
    // No logo here (it lives in the global Topbar now) and no user
    // profile block (also in the Topbar) — just workspace switch + nav.
    return (
      <aside className="flex h-full w-14 shrink-0 flex-col items-center border-r border-sidebar-border bg-sidebar py-3">
        <div className="mb-2">
          <WorkspaceSwitcher collapsed />
        </div>

        <nav className="flex flex-col items-center gap-1">
          {navItems.map((item) =>
            item.disabled ? (
              <Tooltip key={item.label}>
                <TooltipTrigger asChild>
                  <span
                    className="flex size-9 cursor-not-allowed items-center justify-center rounded-md text-sidebar-muted/50"
                    aria-disabled
                  >
                    <item.icon className="size-4.5" />
                  </span>
                </TooltipTrigger>
                <TooltipContent side="right">
                  {item.label} — coming soon
                </TooltipContent>
              </Tooltip>
            ) : (
              <Tooltip key={item.label}>
                <TooltipTrigger asChild>
                  <NavLink
                    to={item.path!}
                    className={({ isActive }) =>
                      cn(
                        "flex size-9 items-center justify-center rounded-md text-sidebar-foreground hover:bg-sidebar-accent",
                        isActive &&
                          "bg-sidebar-accent text-sidebar-accent-foreground"
                      )
                    }
                  >
                    <item.icon className="size-4.5" />
                  </NavLink>
                </TooltipTrigger>
                <TooltipContent side="right">{item.label}</TooltipContent>
              </Tooltip>
            )
          )}
        </nav>
      </aside>
    )
  }

  // Expanded: full workspace-level nav with labels, used outside a project.
  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
      <div className="px-3 pt-3 pb-2">
        <WorkspaceSwitcher />
      </div>

      <nav className="flex flex-col gap-0.5 px-3">
        {navItems.map((item) =>
          item.disabled ? (
            <span
              key={item.label}
              className="flex cursor-not-allowed items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm text-sidebar-muted/50"
              aria-disabled
            >
              <item.icon className="size-4" />
              <span className="flex-1">{item.label}</span>
              {item.hasSubmenu && <ChevronRight className="size-3.5" />}
            </span>
          ) : (
            <NavLink
              key={item.label}
              to={item.path!}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent",
                  isActive &&
                    "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                )
              }
            >
              <item.icon className="size-4" />
              <span className="flex-1">{item.label}</span>
              {item.hasSubmenu && <ChevronRight className="size-3.5" />}
            </NavLink>
          )
        )}
      </nav>
    </aside>
  )
}
