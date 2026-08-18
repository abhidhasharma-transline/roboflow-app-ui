import { useEffect, useState } from "react"
import { Navigate, Link } from "react-router-dom"
import { ArrowLeft, UserPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { useAuthStore } from "@/stores/authStore"
import { listUsers } from "@/lib/authApi"
import { CreateUserDialog } from "./CreateUserDialog"
import { initials, fullName } from "@/lib/userDisplay"
import type { User } from "@/types/auth"

export function UsersSettingsPage() {
  const currentUser = useAuthStore((s) => s.user)
  const [users, setUsers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)

  function refetch() {
    setIsLoading(true)
    listUsers()
      .then(setUsers)
      .finally(() => setIsLoading(false))
  }

  useEffect(refetch, [])

  if (currentUser && currentUser.role !== "super_admin") {
    return <Navigate to="/settings/account" replace />
  }

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="mx-auto max-w-3xl">
        <Link
          to="/settings/account"
          className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Account Settings
        </Link>

        <div className="mb-8 flex items-start justify-between gap-4 rounded-lg border border-border p-5">
          <div>
            <h2 className="mb-1 text-base font-semibold text-foreground">Users</h2>
            <p className="text-sm text-muted-foreground">
              Every account on the platform. Self-registration is closed — new
              accounts are created here and activate via an emailed link.
            </p>
          </div>
          <Button variant="brand" onClick={() => setDialogOpen(true)} className="shrink-0">
            <UserPlus className="size-4" />
            Add User
          </Button>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading users…</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/40 text-left text-xs font-medium text-muted-foreground uppercase">
                <tr>
                  <th className="px-4 py-2.5">Name</th>
                  <th className="px-4 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar className="size-7">
                          <AvatarFallback className="bg-brand/15 text-xs text-brand">
                            {initials(u)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-foreground">{fullName(u)}</p>
                            {u.role === "super_admin" && (
                              <Badge variant="secondary">Super Admin</Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            @{u.username} · {u.email}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={u.is_activated ? "success" : "warning"}>
                        {u.is_activated ? "Active" : "Pending Activation"}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <CreateUserDialog open={dialogOpen} onOpenChange={setDialogOpen} onCreated={refetch} />
    </div>
  )
}
