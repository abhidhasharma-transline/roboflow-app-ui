import { useState } from "react"
import { Link } from "react-router-dom"
import { Folder, MoreVertical, Trash2 } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { deleteFolder } from "@/lib/projectApi"
import { extractErrorMessage } from "@/lib/utils"

export function FolderCard({
  folder,
  workspaceId,
  onDeleted,
}: {
  folder: { id: string; name: string; project_count: number }
  workspaceId: string
  onDeleted?: () => void
}) {
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  async function handleDelete() {
    setDeleting(true)
    setDeleteError(null)
    try {
      await deleteFolder(workspaceId, folder.id)
      setDeleteOpen(false)
      onDeleted?.()
    } catch (err) {
      setDeleteError(extractErrorMessage(err))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <Link
        to={`/projects/folders/${folder.id}`}
        className="group flex items-center gap-3 rounded-lg border border-border bg-card p-4 transition-all duration-200 hover:border-brand/30 hover:shadow-[0_0_18px_-6px_rgba(168,85,247,0.25)]"
      >
        <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <Folder className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">{folder.name}</p>
          <p className="text-xs text-muted-foreground">
            {folder.project_count} Project{folder.project_count !== 1 && "s"}
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger
            onClick={(e) => e.preventDefault()}
            className="rounded p-0.5 text-muted-foreground opacity-0 hover:bg-accent group-hover:opacity-100 data-[state=open]:opacity-100"
          >
            <MoreVertical className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48" onClick={(e) => e.preventDefault()}>
            <DropdownMenuItem
              onClick={() => setDeleteOpen(true)}
              variant="destructive"
            >
              <Trash2 className="size-4" />
              Delete Folder
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </Link>

      <Dialog open={deleteOpen} onOpenChange={deleting ? undefined : setDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete "{folder.name}"?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {folder.project_count > 0
              ? `${folder.project_count} project${folder.project_count !== 1 ? "s" : ""} inside will move back to the top level — nothing is deleted with the folder.`
              : "This folder is empty."}
          </p>
          {deleteError && <p className="text-sm text-destructive">{deleteError}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Deleting…" : "Delete Folder"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
