import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Boxes, ShieldCheck, UserPlus, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { useAuthStore } from "@/stores/authStore"
import { useWorkspaceStore } from "@/stores/workspaceStore"
import { useToastStore } from "@/stores/toastStore"
import { listWorkspaceMembers, updateWorkspaceMember, deleteWorkspace } from "@/lib/workspaceApi"
import { listProjectMembers } from "@/lib/projectApi"
import { useProjects } from "@/hooks/useProjects"
import { extractErrorMessage } from "@/lib/utils"
import { InviteMemberDialog } from "@/features/workspace/InviteMemberDialog"
import { MemberRow, type ProjectOverride } from "./MemberRow"
import type { Workspace, WorkspaceMember } from "@/types/workspace"
import type { WorkspaceRole } from "@/types/auth"

interface WorkspaceManagementCardProps {
  workspace: Workspace
  onDeleted: (workspaceId: string) => void
}

export function WorkspaceManagementCard({ workspace, onDeleted }: WorkspaceManagementCardProps) {
  const navigate = useNavigate()
  const currentUser = useAuthStore((s) => s.user)
  const setActiveWorkspace = useWorkspaceStore((s) => s.setActiveWorkspace)
  const addToast = useToastStore((s) => s.addToast)
  const isSuperAdmin = currentUser?.role === "super_admin"
  const canManage = isSuperAdmin || workspace.owner_id === currentUser?.id

  const { projects } = useProjects(workspace.id)
  const [members, setMembers] = useState<WorkspaceMember[]>([])
  const [overridesByUser, setOverridesByUser] = useState<Record<string, ProjectOverride[]>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  function openWorkspace() {
    setActiveWorkspace(workspace.id, workspace.name)
    navigate("/projects")
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      await deleteWorkspace(workspace.id)
      addToast({ variant: "success", title: "Workspace deleted", description: workspace.name })
      setDeleteOpen(false)
      onDeleted(workspace.id)
    } catch (err) {
      addToast({ variant: "error", title: "Couldn't delete workspace", description: extractErrorMessage(err) })
    } finally {
      setDeleting(false)
    }
  }

  function refetchMembers() {
    setIsLoading(true)
    listWorkspaceMembers(workspace.id)
      .then(setMembers)
      .finally(() => setIsLoading(false))
  }

  function refetchOverrides() {
    if (projects.length === 0) {
      setOverridesByUser({})
      return
    }
    Promise.all(
      projects.map((project) =>
        listProjectMembers(workspace.id, project.id).then((rows) => ({ project, rows }))
      )
    )
      .then((results) => {
        const map: Record<string, ProjectOverride[]> = {}
        for (const { project, rows } of results) {
          for (const row of rows) {
            if (row.role === "super_admin") continue
            if (!map[row.user_id]) map[row.user_id] = []
            map[row.user_id].push({
              project, role: row.role, permissions: row.permission_overrides,
              hasExplicitAccess: row.has_explicit_access,
            })
          }
        }
        setOverridesByUser(map)
      })
      .catch(() => {})
  }

  useEffect(refetchMembers, [workspace.id])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(refetchOverrides, [projects, workspace.id])

  async function handleRoleChange(userId: string, role: WorkspaceRole) {
    await updateWorkspaceMember(workspace.id, userId, { role })
    refetchMembers()
  }

  return (
    <Card className="py-5">
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={openWorkspace}
              className="text-base font-semibold text-foreground hover:text-brand hover:underline"
              title="Open this workspace"
            >
              {workspace.name}
            </button>
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Boxes className="size-3.5" />
              {projects.length} project{projects.length !== 1 && "s"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {isSuperAdmin && (
              <Badge variant="secondary">
                <ShieldCheck className="mr-1 size-3" />
                Super Admin
              </Badge>
            )}
            {canManage && (
              <Button size="sm" variant="brand" onClick={() => setInviteOpen(true)}>
                <UserPlus className="size-3.5" />
                Invite members
              </Button>
            )}
            {canManage && !workspace.is_personal && (
              <Button
                size="sm"
                variant="ghost"
                className="text-muted-foreground hover:text-destructive"
                onClick={() => setDeleteOpen(true)}
                title="Delete workspace"
                aria-label={`Delete ${workspace.name}`}
              >
                <Trash2 className="size-3.5" />
              </Button>
            )}
          </div>
        </div>

        {isLoading && members.length === 0 ? (
          <p className="text-sm text-muted-foreground">Loading members…</p>
        ) : members.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No members yet.{" "}
            {canManage && (
              <button onClick={() => setInviteOpen(true)} className="font-medium text-brand hover:underline">
                Invite your first member
              </button>
            )}
          </p>
        ) : (
          <div>
            {members.map((member) => (
              <MemberRow
                key={member.id}
                workspaceId={workspace.id}
                member={member}
                overrides={overridesByUser[member.user_id] ?? []}
                allProjects={projects}
                canManage={canManage}
                isSelf={member.user_id === currentUser?.id}
                isOwner={member.user_id === workspace.owner_id}
                onRoleChange={handleRoleChange}
                onRefetchOverrides={refetchOverrides}
                onRefetchMembers={refetchMembers}
              />
            ))}
          </div>
        )}
      </CardContent>

      <InviteMemberDialog
        workspaceId={workspace.id}
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        onInvited={refetchMembers}
      />

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete "{workspace.name}"?</DialogTitle>
            <DialogDescription>
              This permanently deletes every project in this workspace — their images, videos,
              and annotations included. Nothing is kept. This can't be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Deleting…" : "Delete workspace"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
