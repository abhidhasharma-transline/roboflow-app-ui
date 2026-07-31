import { Bell } from "lucide-react"
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
import { Logo } from "./Logo"

interface TopbarProps {
  /** Breadcrumb or page title content, rendered on the left, after the logo. */
  children?: React.ReactNode
}

export function Topbar({ children }: TopbarProps) {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()

  return (
    <header className="flex h-16 w-full shrink-0 items-center justify-between border-b border-border bg-background px-6">
    {/* <header className="flex h-16 w-full items-center justify-between bg-[#243248] border-b border-slate-700 text-white px-6">
    <header className=" flex h-16 items-center justify-between bg-gradient-to-r from-[#211B45] to-[#171327] border-b border-violet-900 text-white px-6"> */}
      <div className="flex items-center gap-4">
        <Link to="/projects">
          <Logo />
        </Link>
        {children && (
          <>
            <div className="h-6 w-px bg-border" />
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              {children}
            </div>
          </>
        )}
      </div>

      <div className="flex items-center gap-4">
        <button className="relative flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
          <Bell className="size-[18px]" />
        </button>

        <div className="h-8 w-px bg-border" />

        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2.5 rounded-full py-1 pr-1 pl-2 hover:bg-accent">
            <div className="text-right leading-tight">
              <p className="text-sm font-semibold text-foreground">
                {user ? fullName(user) : ""}
              </p>
              <p className="text-xs text-muted-foreground">
                {user ? roleLabel(user.role) : ""}
              </p>
            </div>
            <Avatar className="size-9">
              <AvatarFallback className="bg-brand/15 text-sm font-medium text-brand">
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
