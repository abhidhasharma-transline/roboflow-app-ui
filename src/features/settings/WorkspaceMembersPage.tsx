import { useEffect, useState } from "react"
import { useParams, Link } from "react-router-dom"
import { ArrowLeft, UserPlus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  getWorkspace,
  listWorkspaceMembers,
  listWorkspaceInvitations,
  cancelInvitation,
} from "@/lib/workspaceApi"
import { InviteMemberDialog } from "@/features/workspace/InviteMemberDialog"
import { initials } from "@/lib/userDisplay"
import type { Workspace, WorkspaceMember, WorkspaceInvitation } from "@/types/workspace"

export function WorkspaceMembersPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>()
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [members, setMembers] = useState<WorkspaceMember[]>([])
  const [pendingInvites, setPendingInvites] = useState<WorkspaceInvitation[] | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)

  function refetch() {
    if (!workspaceId) return
    setIsLoading(true)
    Promise.all([
      getWorkspace(workspaceId),
      listWorkspaceMembers(workspaceId),
      // Owner-only on the backend — a 403 here just means "not the owner",
      // not a real error, so the pending-invites section is hidden rather
      // than shown as broken.
      listWorkspaceInvitations(workspaceId).catch(() => null),
    ])
      .then(([ws, mem, invites]) => {
        setWorkspace(ws)
        setMembers(mem)
        setPendingInvites(invites)
      })
      .finally(() => setIsLoading(false))
  }

  useEffect(refetch, [workspaceId])

  async function handleCancelInvite(invitationId: string) {
    if (!workspaceId) return
    await cancelInvitation(invitationId)
    setPendingInvites((prev) => prev?.filter((i) => i.id !== invitationId) ?? prev)
  }

  const isOwner = pendingInvites !== null // we could only fetch it if we're the owner

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

        <h1 className="mb-6 text-2xl font-semibold text-foreground">
          {workspace?.name ?? "Workspace"} Settings
        </h1>

        <div className="mb-8 flex items-start justify-between gap-4 rounded-lg border border-border p-5">
          <div>
            <h2 className="mb-1 text-base font-semibold text-foreground">
              Members and Roles
            </h2>
            <p className="text-sm text-muted-foreground">
              {isOwner
                ? "Invite users to this workspace by email. They'll become members after accepting."
                : "People with access to this workspace."}
            </p>
          </div>
          {isOwner && (
            <Button variant="brand" onClick={() => setDialogOpen(true)} className="shrink-0">
              <UserPlus className="size-4" />
              Invite Members
            </Button>
          )}
        </div>

        {isOwner && pendingInvites && pendingInvites.length > 0 && (
          <>
            <h2 className="mb-3 text-base font-semibold text-foreground">
              Pending Invitations
            </h2>
            <div className="mb-8 overflow-hidden rounded-lg border border-border">
              {pendingInvites.map((invite) => (
                <div
                  key={invite.id}
                  className="flex items-center justify-between border-b border-border px-4 py-3 text-sm last:border-0"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-foreground">{invite.email}</span>
                    <Badge variant="warning">Pending</Badge>
                  </div>
                  <button
                    onClick={() => handleCancelInvite(invite.id)}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive"
                  >
                    <X className="size-3.5" />
                    Cancel
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

        <h2 className="mb-3 text-base font-semibold text-foreground">
          Team Members with Access
        </h2>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading members…</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/40 text-left text-xs font-medium text-muted-foreground uppercase">
                <tr>
                  <th className="px-4 py-2.5">Name</th>
                  <th className="px-4 py-2.5">Joined</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar className="size-7">
                          <AvatarFallback className="bg-brand/15 text-xs text-brand">
                            {initials(m)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-foreground">{m.username}</p>
                          <p className="text-xs text-muted-foreground">{m.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(m.joined_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {workspaceId && (
        <InviteMemberDialog
          workspaceId={workspaceId}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onInvited={refetch}
        />
      )}
    </div>
  )
}
