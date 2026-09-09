import { useEffect, useState } from "react"
import { Trash2, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useToastStore } from "@/stores/toastStore"
import { PageLoader } from "@/components/shared/PageLoader"
import { listTrashedVersions, restoreVersion, type ProjectVersion } from "@/lib/versionApi"

export function VersionTrashDialog({
  workspaceId,
  projectId,
  open,
  onOpenChange,
  onRestored,
}: {
  workspaceId: string
  projectId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onRestored: (v: ProjectVersion) => void
}) {
  const addToast = useToastStore((s) => s.addToast)
  const [trashed, setTrashed] = useState<ProjectVersion[]>([])
  const [loading, setLoading] = useState(true)
  const [restoringId, setRestoringId] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    listTrashedVersions(workspaceId, projectId)
      .then(setTrashed)
      .finally(() => setLoading(false))
  }, [open, workspaceId, projectId])

  async function handleRestore(v: ProjectVersion) {
    setRestoringId(v.id)
    try {
      const restored = await restoreVersion(workspaceId, projectId, v.id)
      setTrashed((prev) => prev.filter((t) => t.id !== v.id))
      onRestored(restored)
      addToast({ variant: "success", title: "Version restored", description: restored.name })
    } catch {
      addToast({ variant: "error", title: "Couldn't restore version", description: "Please try again." })
    } finally {
      setRestoringId(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trash2 className="size-4" />
            Trash
          </DialogTitle>
        </DialogHeader>
        <p className="-mt-2 text-sm text-muted-foreground">
          Deleted versions stay here until you restore or permanently remove them.
        </p>

        <div className="max-h-80 overflow-y-auto">
          {loading ? (
            <PageLoader />
          ) : trashed.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Trash is empty.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {trashed.map((v) => (
                <div key={v.id} className="flex items-center justify-between rounded-md border border-border p-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{v.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {v.image_count} image{v.image_count !== 1 && "s"} · {v.class_count} class{v.class_count !== 1 && "es"}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRestore(v)}
                    disabled={restoringId === v.id}
                  >
                    <RotateCcw className="size-3.5" />
                    {restoringId === v.id ? "Restoring…" : "Restore"}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
      </DialogContent>
    </Dialog>
  )
}
