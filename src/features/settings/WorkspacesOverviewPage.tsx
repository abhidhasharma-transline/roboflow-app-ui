import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Boxes, Users as UsersIcon, ShieldCheck } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { useAuthStore } from "@/stores/authStore"
import { listWorkspaces, listWorkspaceMembers } from "@/lib/workspaceApi"
import { listProjects, listFolders } from "@/lib/projectApi"
import { grantedPermissions, PERMISSION_LABELS } from "@/lib/permissions"
import { roleLabel } from "@/lib/userDisplay"
import type { Workspace, WorkspaceMember } from "@/types/workspace"

interface WorkspaceSummary {
  workspace: Workspace
  projectCount: number
  memberCount: number
  myMembership: WorkspaceMember | null
}

export function WorkspacesOverviewPage() {
  const user = useAuthStore((s) => s.user)
  const navigate = useNavigate()
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [summaries, setSummaries] = useState<WorkspaceSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const isSuperAdmin = user?.role === "super_admin"

  useEffect(() => {
    listWorkspaces()
      .then(setWorkspaces)
      .catch((err) => console.error("Workspace Error:", err))
  }, [])

  useEffect(() => {
    if (workspaces.length === 0) {
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    Promise.all(
      workspaces.map(async (workspace) => {
        const [rootProjects, folders, members] = await Promise.all([
          listProjects(workspace.id),
          listFolders(workspace.id),
          listWorkspaceMembers(workspace.id),
        ])
        const projectCount =
          rootProjects.length + folders.reduce((sum, f) => sum + f.project_count, 0)
        const myMembership = members.find((m) => m.user_id === user?.id) ?? null
        return { workspace, projectCount, memberCount: members.length, myMembership }
      })
    )
      .then(setSummaries)
      .catch((err) => console.error("Workspace summary error:", err))
      .finally(() => setIsLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaces])

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="mx-auto max-w-4xl">
        <h1 className="mb-1 text-2xl font-semibold text-foreground">Workspaces</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          {isSuperAdmin
            ? "Every workspace on the platform."
            : "Workspaces you're a member of."}
        </p>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading workspaces…</p>
        ) : summaries.length === 0 ? (
          <div className="flex h-48 flex-col items-center justify-center rounded-lg border border-dashed border-border text-center">
            <p className="text-sm font-medium text-foreground">No workspaces yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              No workspace is available for your account.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {summaries.map(({ workspace, projectCount, memberCount, myMembership }) => (
              <Card
                key={workspace.id}
                className="cursor-pointer py-4 transition-shadow hover:shadow-md"
                onClick={() => navigate(`/settings/workspaces/${workspace.id}/members`)}
              >
                <CardContent className="flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium text-foreground">{workspace.name}</p>
                    {isSuperAdmin && !myMembership ? (
                      <Badge variant="secondary">
                        <ShieldCheck className="mr-1 size-3" />
                        Super Admin — full access
                      </Badge>
                    ) : myMembership ? (
                      <Badge variant="secondary">{roleLabel(myMembership.role)}</Badge>
                    ) : null}
                  </div>

                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Boxes className="size-3.5" />
                      {projectCount} project{projectCount !== 1 && "s"}
                    </span>
                    <span className="flex items-center gap-1">
                      <UsersIcon className="size-3.5" />
                      {memberCount} member{memberCount !== 1 && "s"}
                    </span>
                  </div>

                  {myMembership && (
                    <div className="flex flex-wrap gap-1">
                      {grantedPermissions(myMembership.role, myMembership.permission_overrides).map(
                        (key) => (
                          <Badge key={key} variant="outline" className="text-[11px]">
                            {PERMISSION_LABELS[key]}
                          </Badge>
                        )
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
