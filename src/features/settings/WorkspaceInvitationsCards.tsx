import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { listAllInvitations, type PlatformInvitation } from "@/lib/workspaceApi"

const STATUS_BADGE: Record<PlatformInvitation["status"], "success" | "warning" | "secondary" | "destructive"> = {
  accepted: "success",
  pending: "warning",
  rejected: "destructive",
  expired: "secondary",
}

const STATUS_LABEL: Record<PlatformInvitation["status"], string> = {
  accepted: "Accepted",
  pending: "Pending",
  rejected: "Rejected",
  expired: "Expired",
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

/** Every workspace invitation ever sent, any status, grouped one card per
 *  workspace — shown directly on the page (not behind a modal), same card
 *  style Settings already uses for a workspace's own member list
 *  (WorkspaceManagementCard). */
export function WorkspaceInvitationsCards() {
  const [invitations, setInvitations] = useState<PlatformInvitation[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    listAllInvitations()
      .then(setInvitations)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading invitations…</p>
  }
  if (invitations.length === 0) {
    return <p className="text-sm text-muted-foreground">No invitations have been sent yet.</p>
  }

  const byWorkspace = invitations.reduce<Record<string, { name: string; rows: PlatformInvitation[] }>>(
    (acc, inv) => {
      if (!acc[inv.workspace_id]) acc[inv.workspace_id] = { name: inv.workspace_name, rows: [] }
      acc[inv.workspace_id].rows.push(inv)
      return acc
    },
    {}
  )
  const groups = Object.values(byWorkspace).sort((a, b) => a.name.localeCompare(b.name))

  return (
    <div className="flex flex-col gap-4">
      {groups.map((group) => (
        <Card key={group.name} className="py-5">
          <CardContent className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-base font-semibold text-foreground">{group.name}</p>
              <span className="text-xs text-muted-foreground">
                {group.rows.length} invitation{group.rows.length !== 1 && "s"}
              </span>
            </div>
            <div className="flex flex-col gap-2">
              {group.rows.map((inv) => (
                <div
                  key={inv.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {inv.invitee_name ?? inv.email}
                    </p>
                    {inv.invitee_name && (
                      <p className="truncate text-xs text-muted-foreground">{inv.email}</p>
                    )}
                    <p className="text-xs text-muted-foreground capitalize">
                      {inv.role} · invited by {inv.invited_by_name} · {formatDate(inv.created_at)}
                    </p>
                  </div>
                  <Badge variant={STATUS_BADGE[inv.status]} className="shrink-0">
                    {STATUS_LABEL[inv.status]}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
