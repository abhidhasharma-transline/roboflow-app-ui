import { useEffect, useState } from "react"
import { Boxes, ShieldCheck, UserPlus } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useAuthStore } from "@/stores/authStore"
import { listWorkspaceMembers, updateWorkspaceMember } from "@/lib/workspaceApi"
import { listProjectMembers } from "@/lib/projectApi"
import { useProjects } from "@/hooks/useProjects"
import { InviteMemberDialog } from "@/features/workspace/InviteMemberDialog"
import { MemberRow, type ProjectOverride } from "./MemberRow"
import type { Workspace, WorkspaceMember } from "@/types/workspace"
import type { WorkspaceRole } from "@/types/auth"

interface WorkspaceManagementCardProps {
  workspace: Workspace
}

export function WorkspaceManagementCard({ workspace }: WorkspaceManagementCardProps) {
  const currentUser = useAuthStore((s) => s.user)
  const isSuperAdmin = currentUser?.role === "super_admin"
  const canManage = isSuperAdmin || workspace.owner_id === currentUser?.id

  const { projects } = useProjects(workspace.id)
  const [members, setMembers] = useState<WorkspaceMember[]>([])
  const [overridesByUser, setOverridesByUser] = useState<Record<string, ProjectOverride[]>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [inviteOpen, setInviteOpen] = useState(false)

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
            map[row.user_id].push({ project, role: row.role, permissions: row.permission_overrides })
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
            <h2 className="text-base font-semibold text-foreground">{workspace.name}</h2>
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
          </div>
        </div>

        {isLoading ? (
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
                selfIsSuperAdmin={member.user_id === currentUser?.id && isSuperAdmin}
                onRoleChange={handleRoleChange}
                onRefetchOverrides={refetchOverrides}
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
    </Card>
  )
}
