import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Boxes, Users, Plus, AlertTriangle } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { listWorkspaces } from "@/lib/workspaceApi"
import { useWorkspaceStore } from "@/stores/workspaceStore"
import { CreateWorkspaceDialog } from "./CreateWorkspaceDialog"
import type { Workspace } from "@/types/workspace"

export function WorkspacePage() {
  const navigate = useNavigate()
  const setActiveWorkspace = useWorkspaceStore((s) => s.setActiveWorkspace)
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  function refetch() {
    setIsLoading(true)
    listWorkspaces()
      .then(setWorkspaces)
      .catch(() => setError("Couldn't load workspaces."))
      .finally(() => setIsLoading(false))
  }

  useEffect(refetch, [])

  function openWorkspace(ws: Workspace) {
    setActiveWorkspace(ws.id)
    navigate("/projects")
  }

  return (
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
          <Button variant="brand" onClick={() => setDialogOpen(true)}>
            <Plus className="size-4" />
            New workspace
          </Button>
        </div>

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
              Create one to start uploading and annotating data.
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
                    <p className="font-medium text-foreground">{ws.name}</p>
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Users className="size-3" />
                      {ws.is_active ? "Active" : "Inactive"} · /{ws.slug}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <CreateWorkspaceDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={(ws) => setWorkspaces((prev) => [ws, ...prev])}
      />
    </div>
  )
}