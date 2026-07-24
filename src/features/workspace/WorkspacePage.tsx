import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Boxes, Users, Plus } from "lucide-react"
import { Topbar } from "@/components/layout/Topbar"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { mockGetWorkspaces } from "@/lib/mockApi"
import { useWorkspaceStore } from "@/stores/workspaceStore"
import type { Workspace } from "@/types/project"

export function WorkspacePage() {
  const navigate = useNavigate()
  const setActiveWorkspace = useWorkspaceStore((s) => s.setActiveWorkspace)
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    mockGetWorkspaces()
      .then(setWorkspaces)
      .finally(() => setIsLoading(false))
  }, [])

  function openWorkspace(ws: Workspace) {
    setActiveWorkspace(ws.id)
    navigate("/projects")
  }

  return (
    <>
      <Topbar>Workspaces</Topbar>
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-3xl">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-foreground">
                Your workspaces
              </h1>
              <p className="text-sm text-muted-foreground">
                Pick a workspace to see its projects.
              </p>
            </div>
            <Button variant="brand">
              <Plus className="size-4" />
              New workspace
            </Button>
          </div>

          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading workspaces…</p>
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
                      <p className="font-medium text-foreground">{ws.name}</p>
                      <p className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Users className="size-3" />
                        {ws.memberCount} members · {ws.planTier}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
