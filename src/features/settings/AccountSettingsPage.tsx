import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { LogOut } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useAuthStore } from "@/stores/authStore"
import { listWorkspaces } from "@/lib/workspaceApi"
import type { Workspace } from "@/types/workspace"
import { fullName, initials } from "@/lib/userDisplay"

const roleLabels: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  labeler: "Labeler",
  reviewer: "Reviewer",
}

export function AccountSettingsPage() {
  const { user, logout } = useAuthStore()
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])

  useEffect(() => {
  listWorkspaces()
    .then((data) => {
      console.log("Workspaces:", data)
      setWorkspaces(data)
    })
    .catch((err) => {
      console.error("Workspace Error:", err)
    })
  }, [])

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="mx-auto grid max-w-4xl grid-cols-1 gap-8 md:grid-cols-[200px_1fr]">
        <div>
          <p className="mb-2 px-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            User Account
          </p>
          <div className="rounded-md bg-brand/10 px-2 py-1.5 text-sm font-medium text-brand">
            Profile
          </div>

          {workspaces.length > 0 && (
            <>
              <p className="mt-6 mb-2 px-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Workspace
              </p>
              <nav className="flex flex-col gap-0.5">
                {workspaces.map((ws) => (
                  <Link
                    key={ws.id}
                    to={`/settings/workspaces/${ws.id}/members`}
                    className="truncate rounded-md px-2 py-1.5 text-sm text-foreground hover:bg-accent"
                  >
                    {user?.first_name ?? "Workspace"}
                  </Link>
                ))}
              </nav>
            </>
          )}
        </div>

        <div>
          <h1 className="mb-1 text-2xl font-semibold text-foreground">Your Profile</h1>
          <p className="mb-6 text-sm text-muted-foreground">
            Manage your account details.
          </p>

          <div className="flex items-center justify-between rounded-lg border border-border p-5">
            <div className="flex items-center gap-4">
              <Avatar className="size-12">
                <AvatarFallback className="bg-brand/15 text-base text-brand">
                  {user ? initials(user) : "U"}
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium text-foreground">{user ? fullName(user) : ""}</p>
                  {user && <Badge variant="secondary">{roleLabels[user.role] ?? user.role}</Badge>}
                </div>
                <p className="text-sm text-muted-foreground">
                  @{user?.username} · {user?.email}
                </p>
              </div>
            </div>
            <Button variant="outline" onClick={logout}>
              <LogOut className="size-4" />
              Sign Out
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}