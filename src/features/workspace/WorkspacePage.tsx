import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Boxes, Users, AlertTriangle } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { listWorkspaces, listMyInvitations } from "@/lib/workspaceApi"
import { useWorkspaceStore } from "@/stores/workspaceStore"
import { MyInvitationsPanel } from "./MyInvitationsPanel"
import type { Workspace, MyInvitation } from "@/types/workspace"

export function WorkspacePage() {
  const navigate = useNavigate()
  const setActiveWorkspace = useWorkspaceStore((s) => s.setActiveWorkspace)
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [invitations, setInvitations] = useState<MyInvitation[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  function refetch() {
    setIsLoading(true)
    Promise.all([listWorkspaces(), listMyInvitations()])
      .then(([ws, inv]) => {
        setWorkspaces(ws)
        setInvitations(inv)
      })
      .catch(() => setError("Couldn't load workspaces."))
      .finally(() => setIsLoading(false))
  }

  useEffect(refetch, [])

  function openWorkspace(ws: Workspace) {
  setActiveWorkspace(ws.id, ws.name) 
  navigate("/projects")
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-foreground">
            Your workspaces
          </h1>
          <p className="text-sm text-muted-foreground">
            Pick a workspace to see its projects.
          </p>
        </div>

        {!isLoading && (
          <MyInvitationsPanel invitations={invitations} onResolved={refetch} />
        )}

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading workspaces…</p>
        ) : error ? (
          <p className="flex items-center gap-1.5 text-sm text-destructive">
            <AlertTriangle className="size-4" />
            {error}
          </p>
        ) : workspaces.length === 0 ? (
          <div className="flex h-48 flex-col items-center justify-center rounded-lg border border-dashed border-border text-center">
            <p className="text-sm font-medium text-foreground">No workspaces yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              No workspace is available for your account.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {workspaces.map((ws) => (
              <Card
                key={ws.id}
                className="cursor-pointer py-4 transition-shadow hover:shadow-md"
                onClick={() => openWorkspace(ws)}
              >
                <CardContent className="flex items-center gap-4">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-brand text-brand-foreground">
                    <Boxes className="size-5" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-foreground">
                      {ws.name ?? `Workspace ${ws.id.slice(0, 8)}`}
                    </p>
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Users className="size-3" />
                      {ws.is_active ? "Active" : "Inactive"}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}