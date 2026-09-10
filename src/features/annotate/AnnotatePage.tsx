import { useState, useEffect } from "react"
import { useParams, Link } from "react-router-dom"
import { ClipboardList, Upload, MoreVertical, Info, HelpCircle, Download, GitMerge, Search } from "lucide-react"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"
import { Progress } from "@/components/ui/progress"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { TagInput } from "@/components/shared/TagInput"
import {
  listBatches, listJobs, renameBatch, tagBatchImages, mergeBatches, downloadBatchImages,
  updateJobTitle, tagJobImages, moveJobToUnassigned, deleteJobAnnotations,
} from "@/lib/jobApi"
import { discardBatch } from "@/lib/uploadApi"
import { extractErrorMessage } from "@/lib/utils"
import { useWorkspaceStore } from "@/stores/workspaceStore"
import { useToastStore } from "@/stores/toastStore"
import { useProject } from "@/hooks/useProjects"
import { PageLoader } from "@/components/shared/PageLoader"
import type { BatchSummary, JobSummary } from "@/types/job"

function ColumnHelp({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger className="text-muted-foreground hover:text-foreground">
        <HelpCircle className="size-3.5" />
      </TooltipTrigger>
      <TooltipContent className="max-w-64 text-left">{text}</TooltipContent>
    </Tooltip>
  )
}

/** Mirrors Roboflow's "Merge Batches" dialog — combine several Unassigned
 *  batches into one. The batch with the most images stays and absorbs the
 *  rest; the others empty out and drop off the Unassigned column on their
 *  own (list_batches already hides any batch with unassigned_count === 0),
 *  so there's nothing here to delete. */
function MergeBatchesDialog({
  open,
  onOpenChange,
  currentBatch,
  allBatches,
  projectId,
  workspaceId,
  onMerged,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  currentBatch: BatchSummary
  allBatches: BatchSummary[]
  projectId: string
  workspaceId: string
  onMerged: () => void
}) {
  const [search, setSearch] = useState("")
  const [selectedIds, setSelectedIds] = useState<string[]>([currentBatch.id])
  const [merging, setMerging] = useState(false)
  const addToast = useToastStore((s) => s.addToast)

  useEffect(() => {
    if (open) {
      setSelectedIds([currentBatch.id])
      setSearch("")
    }
  }, [open, currentBatch.id])

  const filtered = allBatches.filter((b) =>
    b.name.toLowerCase().includes(search.trim().toLowerCase())
  )
  const selectedBatches = allBatches.filter((b) => selectedIds.includes(b.id))
  const totalImages = selectedBatches.reduce((sum, b) => sum + b.unassigned_count, 0)
  const target =
    selectedBatches.length > 0
      ? selectedBatches.reduce((max, b) => (b.unassigned_count > max.unassigned_count ? b : max))
      : null

  function toggle(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  async function handleMerge() {
    if (selectedIds.length < 2) return
    setMerging(true)
    try {
      await mergeBatches(workspaceId, projectId, selectedIds)
      onOpenChange(false)
      onMerged()
      addToast({ variant: "success", title: "Batches merged" })
    } catch (err) {
      addToast({ variant: "error", title: "Couldn't merge batches", description: extractErrorMessage(err) })
    } finally {
      setMerging(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={merging ? undefined : onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitMerge className="size-4" />
            Merge Batches
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Select batches to combine. The selected batch with the most images will remain and
          receive all images; the other selected batches will become empty and disappear from
          this board.
        </p>
        <div className="relative">
          <Search className="absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder="Search batches..."
            className="pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-foreground">
            {selectedIds.length} batch{selectedIds.length !== 1 && "es"} selected
          </span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="text-xs font-medium text-brand hover:underline"
              onClick={() => setSelectedIds(allBatches.map((b) => b.id))}
            >
              Select All
            </button>
            <button
              type="button"
              className="text-xs font-medium text-muted-foreground hover:underline"
              onClick={() => setSelectedIds([])}
            >
              Clear
            </button>
          </div>
        </div>
        <div className="max-h-64 overflow-y-auto rounded-md border border-border">
          {filtered.length === 0 ? (
            <p className="p-4 text-center text-sm text-muted-foreground">No batches found.</p>
          ) : (
            filtered.map((b) => (
              <label
                key={b.id}
                className={`flex cursor-pointer items-center gap-3 border-b border-border px-3 py-2.5 last:border-b-0 hover:bg-accent ${
                  selectedIds.includes(b.id) ? "bg-brand/5" : ""
                }`}
              >
                <Checkbox checked={selectedIds.includes(b.id)} onCheckedChange={() => toggle(b.id)} />
                <span className="flex-1 truncate text-sm text-foreground">{b.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {b.unassigned_count} image{b.unassigned_count !== 1 && "s"}
                </span>
              </label>
            ))
          )}
        </div>
        {selectedIds.length > 0 && (
          <div className="rounded-md bg-muted p-3 text-sm text-foreground">
            <span className="font-medium">
              {selectedIds.length} batch{selectedIds.length !== 1 && "es"}
            </span>{" "}
            with {totalImages} image{totalImages !== 1 && "s"} selected.
            {selectedIds.length > 1 && target && (
              <>
                {" "}
                Images will be merged into <span className="font-medium">{target.name}</span>, the
                selected batch with the most images.
              </>
            )}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={merging}>
            Cancel
          </Button>
          <Button variant="brand" onClick={handleMerge} disabled={merging || selectedIds.length < 2}>
            {merging ? "Merging…" : `Merge ${selectedIds.length} Batch${selectedIds.length !== 1 ? "es" : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function BatchCard({
  batch,
  allBatches,
  projectId,
  workspaceId,
  onChanged,
}: {
  batch: BatchSummary
  allBatches: BatchSummary[]
  projectId: string
  workspaceId: string
  onChanged: () => void
}) {
  const [renameOpen, setRenameOpen] = useState(false)
  const [renameValue, setRenameValue] = useState(batch.name)
  const [renameSaving, setRenameSaving] = useState(false)

  const [tagOpen, setTagOpen] = useState(false)
  const [tagDraft, setTagDraft] = useState<string[]>([])
  const [tagSaving, setTagSaving] = useState(false)

  const [mergeOpen, setMergeOpen] = useState(false)
  const [downloading, setDownloading] = useState(false)

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleRename(e: React.FormEvent) {
    e.preventDefault()
    if (!renameValue.trim()) return
    setRenameSaving(true)
    try {
      await renameBatch(workspaceId, projectId, batch.id, renameValue.trim())
      setRenameOpen(false)
      onChanged()
    } finally {
      setRenameSaving(false)
    }
  }

  async function handleApplyTags() {
    if (tagDraft.length === 0) return
    setTagSaving(true)
    try {
      await tagBatchImages(workspaceId, projectId, batch.id, tagDraft)
      setTagOpen(false)
      setTagDraft([])
    } finally {
      setTagSaving(false)
    }
  }

  const addToast = useToastStore((s) => s.addToast)
  const removeToast = useToastStore((s) => s.removeToast)

  async function handleDelete() {
    setDeleting(true)
    try {
      await discardBatch(workspaceId, projectId, batch.id)
      setDeleteOpen(false)
      onChanged()
      addToast({ variant: "success", title: "Batch deleted", description: batch.name })
    } catch {
      addToast({ variant: "error", title: "Couldn't delete batch", description: "Please try again." })
    } finally {
      setDeleting(false)
    }
  }

  async function handleDownload() {
    setDownloading(true)
    const loadingId = addToast({ variant: "loading", title: "Preparing download…", description: batch.name })
    try {
      await downloadBatchImages(workspaceId, projectId, batch.id, batch.name)
      removeToast(loadingId)
      addToast({ variant: "success", title: "Download ready", description: batch.name })
    } catch (err) {
      removeToast(loadingId)
      addToast({ variant: "error", title: "Couldn't download batch", description: extractErrorMessage(err) })
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="rounded-lg border border-border p-4">
      <div className="mb-2 flex items-start justify-between">
        <p className="text-sm font-medium text-foreground">
          {new Date(batch.created_at).toLocaleDateString("en-US", {
            month: "2-digit",
            day: "2-digit",
            year: "2-digit",
          })}{" "}
          — {batch.name}
        </p>
        <DropdownMenu>
          <DropdownMenuTrigger className="shrink-0 text-muted-foreground hover:text-foreground">
            <MoreVertical className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => {
                setRenameValue(batch.name)
                setRenameOpen(true)
              }}
            >
              Rename Batch
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTagOpen(true)}>Tag Images</DropdownMenuItem>
            <DropdownMenuItem onClick={handleDownload} disabled={downloading}>
              <Download className="size-3.5" />
              {downloading ? "Downloading…" : "Download"}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setMergeOpen(true)} disabled={allBatches.length < 2}>
              <GitMerge className="size-3.5" />
              Merge Batches
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setDeleteOpen(true)} variant="destructive">
              Delete Batch
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <p className="mb-3 text-sm text-foreground">
        {batch.unassigned_count} Unassigned Image{batch.unassigned_count !== 1 && "s"}
      </p>
      <Link
        to={`/projects/${projectId}/annotate/batch/${batch.id}`}
        className="text-sm font-medium text-brand hover:underline"
      >
        Annotate Images →
      </Link>

      <Dialog open={renameOpen} onOpenChange={renameSaving ? undefined : setRenameOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Rename batch</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleRename} className="flex flex-col gap-4">
            <Input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} autoFocus />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRenameOpen(false)} disabled={renameSaving}>
                Cancel
              </Button>
              <Button type="submit" variant="brand" disabled={renameSaving || !renameValue.trim()}>
                {renameSaving ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={tagOpen} onOpenChange={tagSaving ? undefined : setTagOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Tag all images in this batch</DialogTitle>
          </DialogHeader>
          <TagInput value={tagDraft} onChange={setTagDraft} placeholder="Type a tag and press Enter…" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setTagOpen(false)} disabled={tagSaving}>
              Cancel
            </Button>
            <Button variant="brand" onClick={handleApplyTags} disabled={tagSaving || tagDraft.length === 0}>
              {tagSaving ? "Applying…" : "Apply Tags"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={deleting ? undefined : setDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete this batch?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This permanently deletes all {batch.unassigned_count} unassigned image
            {batch.unassigned_count !== 1 && "s"} in this batch. This can't be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Deleting…" : "Delete Batch"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <MergeBatchesDialog
        open={mergeOpen}
        onOpenChange={setMergeOpen}
        currentBatch={batch}
        allBatches={allBatches}
        projectId={projectId}
        workspaceId={workspaceId}
        onMerged={onChanged}
      />
    </div>
  )
}

function ActiveJobCard({
  job,
  projectId,
  workspaceId,
  onChanged,
  canManageImages,
  canAnnotate,
  mode = "annotating",
}: {
  job: JobSummary
  projectId: string
  workspaceId: string
  onChanged: () => void
  canManageImages: boolean
  canAnnotate: boolean
  /** "review" jobs are already 100% annotated by definition (that's what
   *  routed them here) — Annotated/Unannotated would always read "N / 0",
   *  telling the viewer nothing. Approved/Pending is the number that
   *  actually matters for a job sitting in the Review column. */
  mode?: "annotating" | "review"
}) {
  const percent =
    job.total_images === 0
      ? 0
      : Math.round(((mode === "review" ? job.approved_count : job.annotated_count) / job.total_images) * 100)

  const labelerText =
    job.assignments.length === 0
      ? null
      : job.assignments.length === 1
        ? job.assignments[0].name
        : `${job.assignments[0].name} +${job.assignments.length - 1} more`

  const [renameOpen, setRenameOpen] = useState(false)
  const [renameValue, setRenameValue] = useState(job.title)
  const [renameSaving, setRenameSaving] = useState(false)

  const [tagOpen, setTagOpen] = useState(false)
  const [tagDraft, setTagDraft] = useState<string[]>([])
  const [tagSaving, setTagSaving] = useState(false)

  const [moveOpen, setMoveOpen] = useState(false)
  const [moving, setMoving] = useState(false)

  const [deleteAnnOpen, setDeleteAnnOpen] = useState(false)
  const [deletingAnn, setDeletingAnn] = useState(false)

  async function handleRename(e: React.FormEvent) {
    e.preventDefault()
    if (!renameValue.trim()) return
    setRenameSaving(true)
    try {
      await updateJobTitle(workspaceId, projectId, job.id, renameValue.trim())
      setRenameOpen(false)
      onChanged()
    } finally {
      setRenameSaving(false)
    }
  }

  async function handleApplyTags() {
    if (tagDraft.length === 0) return
    setTagSaving(true)
    try {
      await tagJobImages(workspaceId, projectId, job.id, tagDraft)
      setTagOpen(false)
      setTagDraft([])
    } finally {
      setTagSaving(false)
    }
  }

  const addToast = useToastStore((s) => s.addToast)

  async function handleMove() {
    setMoving(true)
    try {
      await moveJobToUnassigned(workspaceId, projectId, job.id)
      setMoveOpen(false)
      onChanged()
      addToast({ variant: "success", title: "Moved to unassigned", description: job.title })
    } catch (err) {
      addToast({ variant: "error", title: "Couldn't move to unassigned", description: extractErrorMessage(err) })
    } finally {
      setMoving(false)
    }
  }

  async function handleDeleteAnnotations() {
    setDeletingAnn(true)
    try {
      await deleteJobAnnotations(workspaceId, projectId, job.id)
      setDeleteAnnOpen(false)
      onChanged()
      addToast({ variant: "success", title: "Annotations deleted", description: job.title })
    } catch {
      addToast({ variant: "error", title: "Couldn't delete annotations", description: "Please try again." })
    } finally {
      setDeletingAnn(false)
    }
  }

  return (
    <div className="rounded-lg border border-border p-4">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-foreground">{job.title}</p>
          <p className="text-xs text-muted-foreground">
            Uploaded on{" "}
            {new Date(job.batch_created_at).toLocaleDateString("en-US", {
              month: "2-digit",
              day: "2-digit",
              year: "2-digit",
            })}{" "}
            at{" "}
            {new Date(job.batch_created_at).toLocaleTimeString("en-US", {
              hour: "numeric",
              minute: "2-digit",
              hour12: true,
            }).toLowerCase()}
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger className="shrink-0 text-muted-foreground hover:text-foreground">
            <MoreVertical className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => {
                setRenameValue(job.title)
                setRenameOpen(true)
              }}
            >
              Rename Job
            </DropdownMenuItem>
            {canManageImages && <DropdownMenuItem onClick={() => setTagOpen(true)}>Tag Images</DropdownMenuItem>}
            {canAnnotate && (
              <DropdownMenuItem onClick={() => setMoveOpen(true)}>Move to unassigned</DropdownMenuItem>
            )}
            {canManageImages && (
              <DropdownMenuItem onClick={() => setDeleteAnnOpen(true)} variant="destructive">
                Delete all annotations
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {labelerText && (
        <p className="mb-3 text-sm text-foreground">
          <span className="font-medium">Labeler:</span> {labelerText}
        </p>
      )}

      <div className="mb-1.5 flex items-center gap-1.5">
        <Progress value={percent} className="flex-1" />
        <Tooltip>
          <TooltipTrigger className="shrink-0 text-muted-foreground hover:text-foreground">
            <Info className="size-3.5" />
          </TooltipTrigger>
          <TooltipContent>
            Uploaded{" "}
            {new Date(job.batch_created_at).toLocaleDateString("en-US", {
              month: "short", day: "numeric", year: "numeric",
            })}{" "}
            (
            {new Date(job.batch_created_at).toLocaleTimeString("en-US", {
              hour: "numeric", minute: "2-digit", hour12: true,
            })}
            )
          </TooltipContent>
        </Tooltip>
      </div>

      <p className="mb-1 text-sm font-medium text-foreground">
        {job.total_images} Image{job.total_images !== 1 && "s"}
      </p>
      <div className="mb-3 flex items-center gap-1.5 text-xs text-muted-foreground">
        <div className="flex flex-col gap-0.5">
          {mode === "review" ? (
            <>
              <span className="flex items-center gap-1.5">
                <span
                  className={`size-1.5 rounded-full ${
                    job.approved_count > 0 ? "bg-brand" : "border border-muted-foreground"
                  }`}
                />
                {job.approved_count} Approved
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-1.5 rounded-full border border-muted-foreground" />
                {job.pending_review_count} Awaiting Review
              </span>
            </>
          ) : (
            <>
              <span className="flex items-center gap-1.5">
                <span
                  className={`size-1.5 rounded-full ${
                    job.annotated_count > 0 ? "bg-brand" : "border border-muted-foreground"
                  }`}
                />
                {job.annotated_count} Annotated
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-1.5 rounded-full border border-muted-foreground" />
                {job.unannotated_count} Unannotated
              </span>
            </>
          )}
        </div>
        <span
          className="shrink-0"
          title={
            mode === "review"
              ? "Approved = a reviewer signed off. Awaiting Review = still needs a verdict."
              : "Annotated = images with at least one label saved. Unannotated = still to do."
          }
        >
          <Info className="size-3.5" />
        </span>
      </div>

      <div className="text-right">
        <Link
          to={`/projects/${projectId}/annotate/job/${job.id}`}
          className="text-sm font-medium text-brand hover:underline"
        >
          {mode === "review" ? "Review Images →" : canAnnotate ? "Start Annotating →" : "Review Images →"}
        </Link>
      </div>

      <Dialog open={renameOpen} onOpenChange={renameSaving ? undefined : setRenameOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Rename job</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleRename} className="flex flex-col gap-4">
            <Input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} autoFocus />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRenameOpen(false)} disabled={renameSaving}>
                Cancel
              </Button>
              <Button type="submit" variant="brand" disabled={renameSaving || !renameValue.trim()}>
                {renameSaving ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={tagOpen} onOpenChange={tagSaving ? undefined : setTagOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Tag all images in this job</DialogTitle>
          </DialogHeader>
          <TagInput value={tagDraft} onChange={setTagDraft} placeholder="Type a tag and press Enter…" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setTagOpen(false)} disabled={tagSaving}>
              Cancel
            </Button>
            <Button variant="brand" onClick={handleApplyTags} disabled={tagSaving || tagDraft.length === 0}>
              {tagSaving ? "Applying…" : "Apply Tags"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={moveOpen} onOpenChange={moving ? undefined : setMoveOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Move images back to unassigned?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This job will be removed and its {job.total_images} image{job.total_images !== 1 && "s"} will
            go back to the Unassigned column as a batch.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoveOpen(false)} disabled={moving}>
              Cancel
            </Button>
            <Button variant="brand" onClick={handleMove} disabled={moving}>
              {moving ? "Moving…" : "Move to unassigned"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteAnnOpen} onOpenChange={deletingAnn ? undefined : setDeleteAnnOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete all annotations in this job?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            All annotations on this job's images will be permanently deleted. Images revert to labeled
            (unannotated). This can't be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteAnnOpen(false)} disabled={deletingAnn}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteAnnotations} disabled={deletingAnn}>
              {deletingAnn ? "Deleting…" : "Delete all annotations"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function DatasetJobCard({
  job,
  projectId,
  workspaceId,
  onChanged,
  canManageImages,
  canAnnotate,
}: {
  job: JobSummary
  projectId: string
  workspaceId: string
  onChanged: () => void
  canManageImages: boolean
  canAnnotate: boolean
}) {
  const labelerText =
    job.assignments.length === 0
      ? null
      : job.assignments.length === 1
        ? job.assignments[0].name
        : `${job.assignments[0].name} +${job.assignments.length - 1} more`

  const [renameOpen, setRenameOpen] = useState(false)
  const [renameValue, setRenameValue] = useState(job.title)
  const [renameSaving, setRenameSaving] = useState(false)

  const [tagOpen, setTagOpen] = useState(false)
  const [tagDraft, setTagDraft] = useState<string[]>([])
  const [tagSaving, setTagSaving] = useState(false)

  const [moveOpen, setMoveOpen] = useState(false)
  const [moving, setMoving] = useState(false)

  const addToast = useToastStore((s) => s.addToast)

  async function handleRename(e: React.FormEvent) {
    e.preventDefault()
    if (!renameValue.trim()) return
    setRenameSaving(true)
    try {
      await updateJobTitle(workspaceId, projectId, job.id, renameValue.trim())
      setRenameOpen(false)
      onChanged()
    } finally {
      setRenameSaving(false)
    }
  }

  async function handleApplyTags() {
    if (tagDraft.length === 0) return
    setTagSaving(true)
    try {
      await tagJobImages(workspaceId, projectId, job.id, tagDraft)
      setTagOpen(false)
      setTagDraft([])
    } finally {
      setTagSaving(false)
    }
  }

  async function handleMove() {
    setMoving(true)
    try {
      await moveJobToUnassigned(workspaceId, projectId, job.id)
      setMoveOpen(false)
      onChanged()
      addToast({ variant: "success", title: "Moved to unassigned", description: job.title })
    } catch (err) {
      addToast({ variant: "error", title: "Couldn't move to unassigned", description: extractErrorMessage(err) })
    } finally {
      setMoving(false)
    }
  }

  return (
    <div className="rounded-lg border border-border p-4">
      <div className="mb-2 flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-foreground">{job.title}</p>
        <DropdownMenu>
          <DropdownMenuTrigger className="shrink-0 text-muted-foreground hover:text-foreground">
            <MoreVertical className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => {
                setRenameValue(job.title)
                setRenameOpen(true)
              }}
            >
              Rename Job
            </DropdownMenuItem>
            {canManageImages && <DropdownMenuItem onClick={() => setTagOpen(true)}>Tag Images</DropdownMenuItem>}
            {canAnnotate && (
              <DropdownMenuItem onClick={() => setMoveOpen(true)}>Move to unassigned</DropdownMenuItem>
            )}
            <DropdownMenuItem disabled title="Coming soon — no export pipeline yet">
              <Download className="size-3.5" />
              Download
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {labelerText && (
        <p className="mb-3 text-sm text-foreground">
          <span className="font-medium">Labeler:</span> {labelerText}
        </p>
      )}

      <p className="mb-1 text-sm font-medium text-foreground">
        {job.total_images} Image{job.total_images !== 1 && "s"}
      </p>

      <div className="text-right">
        <Link
          to={`/projects/${projectId}/annotate/job/${job.id}`}
          className="text-sm font-medium text-brand hover:underline"
        >
          View Images →
        </Link>
      </div>

      <Dialog open={renameOpen} onOpenChange={renameSaving ? undefined : setRenameOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Rename job</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleRename} className="flex flex-col gap-4">
            <Input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} autoFocus />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRenameOpen(false)} disabled={renameSaving}>
                Cancel
              </Button>
              <Button type="submit" variant="brand" disabled={renameSaving || !renameValue.trim()}>
                {renameSaving ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={tagOpen} onOpenChange={tagSaving ? undefined : setTagOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Tag all images in this job</DialogTitle>
          </DialogHeader>
          <TagInput value={tagDraft} onChange={setTagDraft} placeholder="Type a tag and press Enter…" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setTagOpen(false)} disabled={tagSaving}>
              Cancel
            </Button>
            <Button variant="brand" onClick={handleApplyTags} disabled={tagSaving || tagDraft.length === 0}>
              {tagSaving ? "Applying…" : "Apply Tags"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={moveOpen} onOpenChange={moving ? undefined : setMoveOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Move images back to unassigned?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This job will be removed and its {job.total_images} image{job.total_images !== 1 && "s"} will
            go back to the Unassigned column as a batch.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoveOpen(false)} disabled={moving}>
              Cancel
            </Button>
            <Button variant="brand" onClick={handleMove} disabled={moving}>
              {moving ? "Moving…" : "Move to unassigned"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export function AnnotatePage() {
  const { projectId } = useParams()
  const workspaceId = useWorkspaceStore((s) => s.activeWorkspaceId)
  const addToast = useToastStore((s) => s.addToast)
  const { project } = useProject(projectId)
  // A Reviewer can't assign work or manage images (upload/tag/delete) — see
  // ProjectSidebar.tsx for the same flags. Unassigned batches have nothing
  // a Reviewer can act on (nothing annotated yet to review, can't assign
  // either), so that whole column is hidden rather than shown empty-handed.
  const canAnnotate = project?.my_permissions?.annotate !== false
  const canManageImages = project?.my_permissions?.label_images !== false
  const [unassignedBatches, setUnassignedBatches] = useState<BatchSummary[]>([])
  const [activeJobs, setActiveJobs] = useState<JobSummary[]>([])
  const [datasetJobs, setDatasetJobs] = useState<JobSummary[]>([])
  const [loading, setLoading] = useState(true)

  // Split the one "annotating" list the backend gives us: a job flips into
  // the Review column once needs_review says so (fully labeled, something
  // still awaiting a verdict, project actually has a reviewer) — everything
  // else (including a project with no reviewer at all) stays in Annotating.
  const annotatingJobs = activeJobs.filter((j) => !j.needs_review)
  const reviewJobs = activeJobs.filter((j) => j.needs_review)

  function refetch() {
    if (!workspaceId || !projectId) return
    // Promise.all fails closed — one endpoint erroring (e.g. a permissions
    // bug that only a non-admin role hits) used to blank out ALL THREE
    // columns with zero indication anything went wrong, since none of the
    // three .then()s ever ran. allSettled applies whichever calls actually
    // succeeded and surfaces a toast only for the one(s) that didn't.
    Promise.allSettled([
      listBatches(workspaceId, projectId, "unassigned"),
      listJobs(workspaceId, projectId, undefined, "annotating"),
      listJobs(workspaceId, projectId, undefined, "dataset"),
    ])
      .then(([batches, jobs, dataset]) => {
        if (batches.status === "fulfilled") setUnassignedBatches(batches.value)
        if (jobs.status === "fulfilled") setActiveJobs(jobs.value)
        if (dataset.status === "fulfilled") setDatasetJobs(dataset.value)
        if (batches.status === "rejected" || jobs.status === "rejected" || dataset.status === "rejected") {
          addToast({
            variant: "error",
            title: "Couldn't load some of this board",
            description: "Part of the Annotate board failed to load — try refreshing.",
          })
        }
      })
      .finally(() => setLoading(false))
  }

  useEffect(refetch, [workspaceId, projectId])

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="flex items-center gap-2.5 text-2xl font-semibold text-foreground">
          <ClipboardList className="size-6" />
          Annotate
        </h1>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Sort By:</span>
          <Select defaultValue="newest">
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest</SelectItem>
              <SelectItem value="oldest">Oldest</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <PageLoader />
      ) : (
        <div className={`grid grid-cols-1 gap-5 ${canAnnotate ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
          {/* Unassigned — real batches. Nothing here is actionable for a
              Reviewer (can't annotate yet, can't assign), so it's hidden
              rather than shown as a dead-end empty column. */}
          {canAnnotate && (
          <div className="flex flex-col rounded-xl border border-border">
            <div className="border-b border-border p-4 text-center">
              <h2 className="flex items-center justify-center gap-1.5 text-base font-semibold text-foreground">
                Unassigned
                <ColumnHelp text="These are uploaded images that are auto-batched for easy assignment to users. These are images with no annotations and no assigned labelers." />
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {unassignedBatches.length} Batch{unassignedBatches.length !== 1 && "es"}
              </p>
            </div>
            <div className="flex flex-1 flex-col gap-3 p-4">
              {unassignedBatches.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-3 py-10 text-center">
                  <Link
                    to={`/projects/${projectId}/upload`}
                    className="flex items-center gap-1.5 text-sm font-medium text-brand hover:underline"
                  >
                    <Upload className="size-3.5" />
                    Upload More Images
                  </Link>
                </div>
              ) : (
                unassignedBatches.map((b) => (
                  <BatchCard
                    key={b.id}
                    batch={b}
                    allBatches={unassignedBatches}
                    projectId={projectId!}
                    workspaceId={workspaceId!}
                    onChanged={refetch}
                  />
                ))
              )}
            </div>
          </div>
          )}

          {/* Annotating — real active jobs */}
          <div className="flex flex-col rounded-xl border border-border">
            <div className="border-b border-border p-4 text-center">
              <h2 className="flex items-center justify-center gap-1.5 text-base font-semibold text-foreground">
                Annotating
                <ColumnHelp text="Once a batch is assigned to a user for annotation, it will appear as an annotation job here. Moving a job back to unassigned sends its images back to the Unassigned column as a batch." />
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {annotatingJobs.length} Job{annotatingJobs.length !== 1 && "s"}
              </p>
            </div>
            <div className="flex flex-1 flex-col gap-3 p-4">
              {annotatingJobs.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-3 py-10 text-center">
                  <p className="text-sm text-muted-foreground">
                    Images currently being labeled show up here.
                  </p>
                </div>
              ) : (
                annotatingJobs.map((job) => (
                  <ActiveJobCard
                    key={job.id}
                    job={job}
                    projectId={projectId!}
                    workspaceId={workspaceId!}
                    onChanged={refetch}
                    canManageImages={canManageImages}
                    canAnnotate={canAnnotate}
                  />
                ))
              )}
            </div>
          </div>

          {/* Review — fully-annotated jobs still awaiting a reviewer's
              verdict. Split out of Annotating so the review backlog is
              visible project-wide at a glance instead of hiding inside
              each job's own sidebar. */}
          <div className="flex flex-col rounded-xl border border-border">
            <div className="border-b border-border p-4 text-center">
              <h2 className="flex items-center justify-center gap-1.5 text-base font-semibold text-foreground">
                Review
                <ColumnHelp text="Jobs that are fully annotated but still have images awaiting a reviewer's approval or rejection. Once every image is approved, use 'Add to Dataset' to move it to the Dataset column." />
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {reviewJobs.length} Job{reviewJobs.length !== 1 && "s"}
              </p>
            </div>
            <div className="flex flex-1 flex-col gap-3 p-4">
              {reviewJobs.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-3 py-10 text-center">
                  <p className="text-sm text-muted-foreground">
                    Fully annotated jobs awaiting review show up here.
                  </p>
                </div>
              ) : (
                reviewJobs.map((job) => (
                  <ActiveJobCard
                    key={job.id}
                    job={job}
                    projectId={projectId!}
                    workspaceId={workspaceId!}
                    onChanged={refetch}
                    canManageImages={canManageImages}
                    canAnnotate={canAnnotate}
                    mode="review"
                  />
                ))
              )}
            </div>
          </div>

          {/* Dataset — real dataset-stage jobs */}
          <div className="flex flex-col rounded-xl border border-border">
            <div className="border-b border-border p-4 text-center">
              <h2 className="flex items-center justify-center gap-1.5 text-base font-semibold text-foreground">
                Dataset
                <ColumnHelp text="Approved annotated images are added here to build your training dataset." />
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {datasetJobs.length} Job{datasetJobs.length !== 1 && "s"}
              </p>
            </div>
            <div className="flex flex-1 flex-col gap-3 p-4">
              {datasetJobs.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-3 py-10 text-center">
                  <p className="text-sm text-muted-foreground">
                    Approve annotated images to add them to your dataset.
                  </p>
                </div>
              ) : (
                datasetJobs.map((job) => (
                  <DatasetJobCard
                    key={job.id}
                    job={job}
                    projectId={projectId!}
                    workspaceId={workspaceId!}
                    onChanged={refetch}
                    canManageImages={canManageImages}
                    canAnnotate={canAnnotate}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
