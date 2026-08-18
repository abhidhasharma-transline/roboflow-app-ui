import { useEffect, useState } from "react"
import { listWorkspaces } from "@/lib/workspaceApi"
import { useAuthStore } from "@/stores/authStore"
import { WorkspaceManagementCard } from "./WorkspaceManagementCard"
import type { Workspace } from "@/types/workspace"

export function WorkspacesOverviewPage() {
  const user = useAuthStore((s) => s.user)
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const isSuperAdmin = user?.role === "super_admin"

  useEffect(() => {
    listWorkspaces()
      .then(setWorkspaces)
      .catch((err) => console.error("Workspace Error:", err))
      .finally(() => setIsLoading(false))
  }, [])

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="w-full max-w-[1600px]">
        <h1 className="mb-1 text-2xl font-semibold text-foreground">Workspaces</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          {isSuperAdmin ? "Every workspace on the platform." : "Workspaces you're a member of."}
        </p>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading workspaces…</p>
        ) : workspaces.length === 0 ? (
          <div className="flex h-48 flex-col items-center justify-center rounded-lg border border-dashed border-border text-center">
            <p className="text-sm font-medium text-foreground">No workspaces yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              No workspace is available for your account.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {workspaces.map((workspace) => (
              <WorkspaceManagementCard key={workspace.id} workspace={workspace} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
