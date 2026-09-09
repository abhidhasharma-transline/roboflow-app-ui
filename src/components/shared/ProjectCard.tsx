import { useState } from "react"
import { Link } from "react-router-dom"
import { Scan, Lock, MoreVertical, Copy, Pencil, FolderInput, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
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
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"
import { renameProject, deleteProject, moveProject, listFolders } from "@/lib/projectApi"
import type { Project, ProjectFolder } from "@/types/project"

const typeLabels: Record<Project["annotation_type"], string> = {
  object_detection: "Object Detection",
  classification: "Classification",
  segmentation: "Segmentation",
  keypoint: "Keypoint Detection",
}

function timeAgo(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (days < 1) return "today"
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months} month${months === 1 ? "" : "s"} ago`
  const years = Math.floor(months / 12)
  return `${years} year${years === 1 ? "" : "s"} ago`
}

const ROOT = "__root__"

interface ProjectCardProps {
  project: Project
  workspaceId: string
  onChanged?: () => void
}

export function ProjectCard({ project, workspaceId, onChanged }: ProjectCardProps) {
  const [renameOpen, setRenameOpen] = useState(false)
  const [renameValue, setRenameValue] = useState("")
  const [renameSaving, setRenameSaving] = useState(false)
  const [renameError, setRenameError] = useState<string | null>(null)

  const [moveOpen, setMoveOpen] = useState(false)
  const [folders, setFolders] = useState<ProjectFolder[]>([])
  const [loadingFolders, setLoadingFolders] = useState(false)
  const [selectedFolderId, setSelectedFolderId] = useState<string>(ROOT)
  const [moveSaving, setMoveSaving] = useState(false)
  const [moveError, setMoveError] = useState<string | null>(null)

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  function openRename() {
    setRenameValue(project.name)
    setRenameError(null)
    setRenameOpen(true)
  }

  async function handleRename(e: React.FormEvent) {
    e.preventDefault()
    if (!renameValue.trim()) return
    setRenameSaving(true)
    setRenameError(null)
    try {
      await renameProject(workspaceId, project.id, renameValue.trim())
      onChanged?.()
      setRenameOpen(false)
    } catch (err) {
      setRenameError(extractErrorMessage(err))
    } finally {
      setRenameSaving(false)
    }
  }

  function openMove() {
    setSelectedFolderId(project.folder_id ?? ROOT)
    setMoveError(null)
    setMoveOpen(true)
    setLoadingFolders(true)
    listFolders(workspaceId)
      .then(setFolders)
      .finally(() => setLoadingFolders(false))
  }

  async function handleMove() {
    setMoveSaving(true)
    setMoveError(null)
    try {
      await moveProject(workspaceId, project.id, selectedFolderId === ROOT ? null : selectedFolderId)
      onChanged?.()
      setMoveOpen(false)
    } catch (err) {
      setMoveError(extractErrorMessage(err))
    } finally {
      setMoveSaving(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    setDeleteError(null)
    try {
      await deleteProject(workspaceId, project.id)
      onChanged?.()
      setDeleteOpen(false)
    } catch (err) {
      setDeleteError(extractErrorMessage(err))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <Link
        to={`/projects/${project.id}/upload`}
        className="group block overflow-hidden rounded-lg border border-border bg-card transition-all duration-200 hover:border-brand/30 hover:shadow-[0_0_18px_-6px_rgba(168,85,247,0.25)]"
      >
        <div className="flex aspect-[16/9] items-center justify-center overflow-hidden bg-muted">
          {project.thumbnail_url ? (
            <img
              src={project.thumbnail_url}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <Scan className="size-8 text-muted-foreground/30" />
          )}
        </div>

        <div className="p-3">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <Badge variant="secondary" className="gap-1 font-normal">
              <Scan className="size-3" />
              {typeLabels[project.annotation_type]}
            </Badge>
            <DropdownMenu>
              <DropdownMenuTrigger
                onClick={(e) => e.preventDefault()}
                className="rounded p-0.5 text-muted-foreground opacity-0 hover:bg-accent group-hover:opacity-100 data-[state=open]:opacity-100"
              >
                <MoreVertical className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48" onClick={(e) => e.preventDefault()}>
                <DropdownMenuItem onClick={() => navigator.clipboard.writeText(project.id)}>
                  <Copy className="size-4" />
                  Copy Project Id
                </DropdownMenuItem>
                <DropdownMenuItem onClick={openRename}>
                  <Pencil className="size-4" />
                  Rename Project
                </DropdownMenuItem>
                <DropdownMenuItem onClick={openMove}>
                  <FolderInput className="size-4" />
                  Move Project
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setDeleteOpen(true)} variant="destructive">
                  <Trash2 className="size-4" />
                  Move to Trash
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <h3 className="truncate text-sm font-semibold text-foreground">
            {project.name}
          </h3>
          {project.description && (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {project.description}
            </p>
          )}
          <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
            <Lock className="size-3" />
            Private · Created {timeAgo(project.created_at)}
          </p>
        </div>
      </Link>

      {/* Rename */}
      <Dialog open={renameOpen} onOpenChange={renameSaving ? undefined : setRenameOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Rename project</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleRename} className="flex flex-col gap-4">
            <Input
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              autoFocus
            />
            {renameError && <p className="text-sm text-destructive">{renameError}</p>}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setRenameOpen(false)}
                disabled={renameSaving}
              >
                Cancel
              </Button>
              <Button type="submit" variant="brand" disabled={renameSaving || !renameValue.trim()}>
                {renameSaving ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Move */}
      <Dialog open={moveOpen} onOpenChange={moveSaving ? undefined : setMoveOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Move "{project.name}"</DialogTitle>
          </DialogHeader>
          <Select value={selectedFolderId} onValueChange={setSelectedFolderId} disabled={loadingFolders}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder={loadingFolders ? "Loading…" : undefined} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ROOT}>No Folder</SelectItem>
              {folders.map((f) => (
                <SelectItem key={f.id} value={f.id}>
                  {f.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {moveError && <p className="text-sm text-destructive">{moveError}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoveOpen(false)} disabled={moveSaving}>
              Cancel
            </Button>
            <Button variant="brand" onClick={handleMove} disabled={moveSaving || loadingFolders}>
              {moveSaving ? "Moving…" : "Move"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete */}
      <Dialog open={deleteOpen} onOpenChange={deleting ? undefined : setDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Move "{project.name}" to trash?</DialogTitle>
          </DialogHeader>
          {deleteError && <p className="text-sm text-destructive">{deleteError}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Moving…" : "Move to Trash"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function extractErrorMessage(err: unknown): string {
  if (typeof err === "object" && err !== null && "response" in err) {
    const resp = (err as { response?: { data?: { detail?: unknown } } }).response
    const detail = resp?.data?.detail
    if (typeof detail === "string") return detail
  }
  return "Something went wrong — please try again."
}
