import { useEffect, useMemo, useState } from "react"
import { Navigate, Link } from "react-router-dom"
import { ArrowLeft, UserPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"
import { useAuthStore } from "@/stores/authStore"
import { useToastStore } from "@/stores/toastStore"
import { listUsers } from "@/lib/authApi"
import { extractErrorMessage } from "@/lib/utils"
import { CreateUserDialog } from "./CreateUserDialog"
import { WorkspaceInvitationsCards } from "./WorkspaceInvitationsCards"
import { initials, fullName } from "@/lib/userDisplay"
import type { User } from "@/types/auth"

export function UsersSettingsPage() {
  const currentUser = useAuthStore((s) => s.user)
  const addToast = useToastStore((s) => s.addToast)
  const [users, setUsers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  // "All" by default — narrowing to one admin's own additions is the
  // secondary view, not the default one, since most Super Admins will want
  // to see everyone on the platform first.
  const [addedByFilter, setAddedByFilter] = useState<string>("all")

  function refetch() {
    setIsLoading(true)
    listUsers()
      .then(setUsers)
      .catch((err) => {
        // Previously failed silently — a rejected request left `users` at
        // its empty initial state with `isLoading` still cleared by
        // `.finally()`, rendering as an indistinguishable "no users on the
        // platform" table instead of surfacing that the request itself
        // never succeeded.
        addToast({ variant: "error", title: "Couldn't load users", description: extractErrorMessage(err) })
      })
      .finally(() => setIsLoading(false))
  }

  useEffect(refetch, [])

  // Resolved client-side against the SAME already-fetched list rather than
  // the backend joining/denormalizing a name onto every user row — the
  // creator is (almost) always already present in this exact array.
  const usersById = useMemo(() => new Map(users.map((u) => [u.id, u])), [users])
  const addedByOptions = useMemo(() => {
    const seen = new Map<string, string>()
    for (const u of users) {
      if (u.created_by && !seen.has(u.created_by)) {
        const creator = usersById.get(u.created_by)
        seen.set(u.created_by, creator ? fullName(creator) : "Unknown")
      }
    }
    return [...seen.entries()]
  }, [users, usersById])
  const visibleUsers = addedByFilter === "all" ? users : users.filter((u) => u.created_by === addedByFilter)

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

        {!isLoading && addedByOptions.length > 0 && (
          <div className="mb-4 flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Added by:</span>
            <Select value={addedByFilter} onValueChange={setAddedByFilter}>
              <SelectTrigger className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Everyone ({users.length})</SelectItem>
                {addedByOptions.map(([id, name]) => (
                  <SelectItem key={id} value={id}>
                    {name} ({users.filter((u) => u.created_by === id).length})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading users…</p>
        ) : visibleUsers.length === 0 ? (
          <p className="text-sm text-muted-foreground">No users match this filter.</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/40 text-left text-xs font-medium text-muted-foreground uppercase">
                <tr>
                  <th className="px-4 py-2.5">Name</th>
                  <th className="px-4 py-2.5">Added By</th>
                  <th className="px-4 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody>
                {visibleUsers.map((u) => {
                  const creator = u.created_by ? usersById.get(u.created_by) : null
                  return (
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
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {u.created_by ? (creator ? fullName(creator) : "Unknown") : "Self-registered"}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={u.is_activated ? "success" : "warning"}>
                          {u.is_activated ? "Active" : "Pending Activation"}
                        </Badge>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        <h2 className="mt-10 mb-3 text-base font-semibold text-foreground">
          Workspace Invitations
        </h2>
        <WorkspaceInvitationsCards />
      </div>

      <CreateUserDialog open={dialogOpen} onOpenChange={setDialogOpen} onCreated={refetch} />
    </div>
  )
}
