import { useNavigate, Link } from "react-router-dom"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { useAuthStore } from "@/stores/authStore"
import { fullName, initials, roleLabel } from "@/lib/userDisplay"
import { LogoMark } from "./Logo"
import { ThemeToggle } from "./ThemeToggle"

interface TopbarProps {
  /** Breadcrumb or page title content, rendered on the left, after the logo. */
  children?: React.ReactNode
}

export function Topbar({ children }: TopbarProps) {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()

  return (
    <header className="flex h-14 w-full shrink-0 items-center justify-between border-b border-topbar-border bg-topbar px-6 text-topbar-foreground">
      <div className="flex items-center gap-4">
        <Link to="/projects" className="flex items-center gap-2">
          <LogoMark />
          <span className="text-lg font-semibold tracking-tight text-topbar-foreground">
            Annomaster
          </span>
        </Link>
        {children && (
          <>
            <div className="h-6 w-px bg-topbar-border" />
            <div className="flex items-center gap-2 text-sm font-medium text-topbar-foreground">
              {children}
            </div>
          </>
        )}
      </div>

      <div className="flex items-center gap-4">
        <ThemeToggle />

        <div className="h-8 w-px bg-topbar-border" />

        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2.5 rounded-full py-1 pr-1 pl-2 hover:bg-topbar-accent">
            <div className="text-right leading-tight">
              <p className="text-sm font-semibold text-topbar-foreground">
                {user ? fullName(user) : ""}
              </p>
              <p className="text-xs text-topbar-muted">
                {user ? roleLabel(user.role) : ""}
              </p>
            </div>
            <Avatar className="size-8">
              <AvatarFallback className="bg-brand text-xs font-medium text-brand-foreground">
                {user ? initials(user) : "U"}
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <div className="px-2 py-1.5">
              <p className="text-sm font-medium">{user ? fullName(user) : ""}</p>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate("/settings/account")}>
              Account settings
            </DropdownMenuItem>
            <DropdownMenuItem onClick={logout}>Sign out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
