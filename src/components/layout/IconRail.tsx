import { NavLink, useNavigate } from "react-router-dom"
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
  ChevronsUpDown,
  ChevronRight,
  UserCog,
  LogOut,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Logo, LogoMark } from "./Logo"
import { CreditsWidget } from "./CreditsWidget"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { useAuthStore } from "@/stores/authStore"
import { fullName, initials as computeInitials } from "@/lib/userDisplay"
import { useActiveWorkspace } from "@/hooks/useActiveWorkspace"

interface NavItem {
  label: string
  icon: typeof Bot
  path?: string
  hasSubmenu?: boolean
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

function useInitials() {
  const user = useAuthStore((s) => s.user)
  if (!user) return "U"
  return computeInitials(user)
}

/** Account Settings + Sign Out only — every other item from the real
 *  Roboflow menu (Docs, Community Forum, Changelog, Send Feedback, Report a
 *  Bug, Email Support, Chat, Talk with an Expert) is deliberately left out;
 *  this is an internal tool, not a product with a support funnel. */
function UserMenu({ trigger }: { trigger: React.ReactNode }) {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <div className="flex items-center gap-2.5 px-2 py-1.5">
          <Avatar className="size-8">
            <AvatarFallback className="bg-brand/15 text-xs text-brand">
              {user ? computeInitials(user) : "U"}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{user ? fullName(user) : ""}</p>
            <p className="truncate text-xs text-muted-foreground">@{user?.username}</p>
            <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
          </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate("/settings/account")}>
          <UserCog className="size-4" />
          Account Settings
        </DropdownMenuItem>
        <DropdownMenuItem onClick={logout}>
          <LogOut className="size-4" />
          Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function IconRail({ expanded }: { expanded: boolean }) {
  const initials = useInitials()
  const { name: workspaceName } = useActiveWorkspace()

  if (!expanded) {
    return (
      <aside className="flex h-screen w-14 shrink-0 flex-col items-center border-r border-sidebar-border bg-sidebar py-3">
        <NavLink to="/projects" className="mb-1">
          <LogoMark />
        </NavLink>
        <button className="mb-3 rounded-md p-1.5 text-sidebar-muted hover:bg-sidebar-accent">
          <ChevronsUpDown className="size-4" />
        </button>

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

        <div className="mt-auto flex flex-col items-center gap-2">
          <UserMenu
            trigger={
              <button>
                <Avatar className="size-7">
                  <AvatarFallback className="bg-brand/15 text-xs text-brand">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </button>
            }
          />
        </div>
      </aside>
    )
  }

  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
      <div className="p-4 pb-2">
        <Logo />
      </div>

      <div className="px-3 pb-2">
        <DropdownMenu>
          <DropdownMenuTrigger className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left hover:bg-sidebar-accent">
            <div className="flex-1 overflow-hidden">
              <p className="truncate text-sm font-medium text-sidebar-foreground">
                {workspaceName ?? "Loading…"}
              </p>
            </div>
            <ChevronsUpDown className="size-4 text-sidebar-muted" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuItem>{workspaceName ?? "Workspace"}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
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

      <div className="mt-auto flex flex-col gap-3 p-3">
        <UserMenu
          trigger={
            <button className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left hover:bg-sidebar-accent">
              <Avatar className="size-7">
                <AvatarFallback className="bg-brand/15 text-xs text-brand">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <UserLabel />
            </button>
          }
        />
        <CreditsWidget />
      </div>
    </aside>
  )
}

function UserLabel() {
  const user = useAuthStore((s) => s.user)
  if (!user) return null
  return <span className="truncate text-sm text-sidebar-foreground">{fullName(user)}</span>
}