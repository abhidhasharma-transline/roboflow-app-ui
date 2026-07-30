import { Bell, HelpCircle } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { useAuthStore } from "@/stores/authStore"
import { fullName, initials } from "@/lib/userDisplay"

interface TopbarProps {
  /** Breadcrumb or page title content, rendered on the left */
  children?: React.ReactNode
}

export function Topbar({ children }: TopbarProps) {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const initialsText = user ? initials(user) : "U"
  // const initials = user?.username?.slice(0, 2).toUpperCase()

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-background px-5">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        {children}
      </div>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon">
          <HelpCircle className="size-4" />
        </Button>
        <Button variant="ghost" size="icon">
          <Bell className="size-4" />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger>
            <Avatar className="size-8">
              <AvatarFallback className="bg-brand/15 text-brand">
                {initialsText}
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <div className="px-2 py-1.5">
              {/* <p className="text-sm font-medium">{user?.username}</p> */}
              <p className="text-sm font-medium">{user ? fullName(user) : ""}</p>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate("/settings/account")}>
              Account settings
            </DropdownMenuItem>
            <DropdownMenuItem onClick={logout}>
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}