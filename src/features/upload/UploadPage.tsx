import { useEffect, useRef, useState } from "react"
import { useParams } from "react-router-dom"
import {
  Upload,
  Image as ImageIcon,
  BoxSelect,
  Video,
  FileText,
  AlertTriangle,
  X,
  ArrowLeft,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import {
  Dialog,
  DialogHeader,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { TagInput } from "@/components/shared/TagInput"
import { VideoExtractor } from "./VideoExtractor"
import { BatchReview } from "./BatchReview"
import { uploadImages, discardBatch } from "@/lib/uploadApi"
import { useWorkspaceStore } from "@/stores/workspaceStore"
import { useUnsavedUploadStore } from "@/stores/unsavedUploadStore"
import { useUnsavedUploadGuard } from "@/hooks/useUnsavedUploadGuard"
import type { UploadImagesResponse } from "@/types/upload"

const VIDEO_EXTENSIONS = /\.(mp4|mov)$/i

function defaultBatchName() {
  const now = new Date()
  const date = now.toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "2-digit",
  })
  const time = now
    .toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })
    .toLowerCase()
  return `Uploaded on ${date} at ${time}`
}

type Stage =
  | { kind: "idle" }
  | { kind: "selected"; files: File[]; folderName?: string }
  | { kind: "committing"; percent: number; label: string }
  | { kind: "video-modal"; file: File }
  | { kind: "review"; batchId: string }
  | { kind: "error"; message: string }

function LocalThumb({ file, onRemove }: { file: File; onRemove: () => void }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    const objectUrl = URL.createObjectURL(file)
    setUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [file])

  return (
    <div className="group relative aspect-[4/3] overflow-hidden rounded-md border border-border bg-muted">
      {url && <img src={url} alt={file.name} className="size-full object-cover" />}
      <button
        onClick={onRemove}
        className="absolute top-1.5 right-1.5 rounded-full bg-black/60 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
      >
        <X className="size-3" />
      </button>
    </div>
  )
}

export function UploadPage() {
  const { projectId } = useParams()
  const workspaceId = useWorkspaceStore((s) => s.activeWorkspaceId)
  const { pendingBatch, setPendingBatch, clearPendingBatch } = useUnsavedUploadStore()
  useUnsavedUploadGuard()

  const [batchName, setBatchName] = useState(defaultBatchName)
  const [tags, setTags] = useState<string[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [stage, setStage] = useState<Stage>({ kind: "idle" })
  const [rowErrors, setRowErrors] = useState<UploadImagesResponse["errors"]>([])
  const [discardOpen, setDiscardOpen] = useState(false)
  const [discarding, setDiscarding] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  // Browsers don't fire `change` on an <input type=file> if the same file(s)
  // are re-selected without first clearing its value — clear it right before
  // opening the dialog so re-picking the same folder/files always fires.
  function openPicker(ref: React.RefObject<HTMLInputElement | null>) {
    if (ref.current) ref.current.value = ""
    ref.current?.click()
  }

  async function commitImages(files: File[], folderName?: string) {
    if (!workspaceId || !projectId) {
      setStage({ kind: "error", message: "No active workspace/project — select a workspace first." })
      return
    }
    setRowErrors([])
    setStage({ kind: "committing", percent: 0, label: "Processing files…" })
    try {
      const res = await uploadImages(
        workspaceId,
        projectId,
        files,
        { batchName, tagNames: tags, folderName },
        (percent) => setStage({ kind: "committing", percent, label: "Processing files…" })
      )
      setRowErrors(res.errors)
      setPendingBatch({ workspaceId, projectId, batchId: res.batch_id })
      setStage({ kind: "review", batchId: res.batch_id })
    } catch (err) {
      setStage({ kind: "error", message: extractErrorMessage(err) })
    }
  }

  function handleFiles(fileList: FileList, folderName?: string) {
    const files = Array.from(fileList)
    const videoFile = files.find((f) => f.type.startsWith("video/") || VIDEO_EXTENSIONS.test(f.name))
    const imageFiles = files.filter((f) => f !== videoFile)

    if (videoFile) {
      setStage({ kind: "video-modal", file: videoFile })
      return
    }

    if (imageFiles.length === 0) return
    setStage((prev) =>
      prev.kind === "selected"
        ? { kind: "selected", files: [...prev.files, ...imageFiles], folderName: prev.folderName ?? folderName }
        : { kind: "selected", files: imageFiles, folderName }
    )
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files)
  }

  function resetToIdle() {
    setStage({ kind: "idle" })
    setBatchName(defaultBatchName())
    setTags([])
    if (fileInputRef.current) fileInputRef.current.value = ""
    if (folderInputRef.current) folderInputRef.current.value = ""
  }

  function handleSaved() {
    clearPendingBatch()
    resetToIdle()
  }

  async function handleDiscard() {
    if (!pendingBatch) return
    setDiscarding(true)
    try {
      await discardBatch(pendingBatch.workspaceId, pendingBatch.projectId, pendingBatch.batchId)
    } catch {
      // Best-effort — even if this fails, don't block the person from leaving.
    }
    clearPendingBatch()
    setDiscardOpen(false)
    setDiscarding(false)
    resetToIdle()
  }

  const isBusy = stage.kind === "committing" || stage.kind === "video-modal"

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="flex items-center gap-2.5 text-2xl font-semibold text-foreground">
          <Upload className="size-6" />
          Upload Data
        </h1>
        {pendingBatch && (
          <button
            onClick={() => setDiscardOpen(true)}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            Discard and back to Projects
          </button>
        )}
      </div>

      <div className="mx-auto max-w-4xl">
        <div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/bmp,image/webp,image/avif,video/mp4,video/quicktime"
            className="hidden"
            onChange={(e) => e.target.files && handleFiles(e.target.files)}
          />
          <input
            ref={folderInputRef}
            type="file"
            multiple
            // @ts-expect-error — non-standard but supported by every major browser
            webkitdirectory=""
            className="hidden"
            onChange={(e) => {
              if (!e.target.files || e.target.files.length === 0) return
              const first = e.target.files[0] as File & { webkitRelativePath?: string }
              const folderName = first.webkitRelativePath?.split("/")[0] ?? "Folder upload"
              handleFiles(e.target.files, folderName)
            }}
          />

          {stage.kind !== "review" && (
            <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label className="text-sm font-medium text-foreground">Batch Name:</Label>
                <Input
                  value={batchName}
                  onChange={(e) => setBatchName(e.target.value)}
                  disabled={isBusy}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-sm font-medium text-foreground">Tags:</Label>
                <TagInput value={tags} onChange={setTags} />
              </div>
            </div>
          )}

          {stage.kind === "review" && workspaceId && projectId ? (
            <BatchReview
              workspaceId={workspaceId}
              projectId={projectId}
              batchId={stage.batchId}
              batchName={batchName}
              tags={tags}
              onSaved={handleSaved}
            />
          ) : stage.kind === "selected" ? (
            <div>
              <div className="mb-4 flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {stage.files.length} image{stage.files.length !== 1 && "s"} ready to upload —
                  nothing has been sent to the server yet.
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => openPicker(fileInputRef)}>
                    <FileText className="size-4" />
                    Select Files
                  </Button>
                  <Button variant="outline" onClick={() => openPicker(folderInputRef)}>
                    <BoxSelect className="size-4" />
                    Select Folder
                  </Button>
                  <Button variant="outline" onClick={resetToIdle}>
                    Cancel
                  </Button>
                  <Button
                    variant="brand"
                    onClick={() => commitImages(stage.files, stage.folderName)}
                    disabled={stage.files.length === 0}
                  >
                    Save and Continue
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                {stage.files.map((file, i) => (
                  <LocalThumb
                    key={`${file.name}-${file.lastModified}-${i}`}
                    file={file}
                    onRemove={() =>
                      setStage((prev) =>
                        prev.kind === "selected"
                          ? { ...prev, files: prev.files.filter((f) => f !== file) }
                          : prev
                      )
                    }
                  />
                ))}
              </div>
            </div>
          ) : (
            <div
              onDragOver={(e) => {
                e.preventDefault()
                if (!isBusy) setIsDragging(true)
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={isBusy ? undefined : onDrop}
              className={`flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-12 text-center transition-colors ${
                isDragging ? "border-brand bg-brand/5" : "border-border bg-muted/20"
              }`}
            >
              {stage.kind === "committing" ? (
                <div className="flex w-full max-w-sm flex-col items-center gap-3 py-6">
                  <p className="text-lg font-semibold text-brand">{stage.label}</p>
                  <Progress value={stage.percent} className="w-full" />
                </div>
              ) : (
                <>
                  <div className="flex size-12 items-center justify-center rounded-full bg-muted text-foreground">
                    <Upload className="size-5" />
                  </div>
                  <p className="text-lg font-semibold text-foreground">
                    Drag and drop file(s) to upload, or:
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => openPicker(fileInputRef)}>
                      <FileText className="size-4" />
                      Select File(s)
                    </Button>
                    <Button variant="outline" onClick={() => openPicker(folderInputRef)}>
                      <BoxSelect className="size-4" />
                      Select Folder
                    </Button>
                  </div>

                  <div className="mt-4 w-full border-t border-border pt-4">
                    <p className="mb-3 text-xs font-medium text-muted-foreground">
                      Supported Formats
                    </p>
                    <div className="flex flex-wrap items-start justify-center gap-8 text-left text-sm">
                      <div>
                        <p className="flex items-center gap-1.5 font-medium text-foreground">
                          <ImageIcon className="size-4" />
                          Images
                        </p>
                        <p className="text-xs text-muted-foreground">
                          .jpg, .png, .bmp, .webp, .avif
                        </p>
                      </div>
                      <div>
                        <p className="flex items-center gap-1.5 font-medium text-foreground">
                          <Video className="size-4" />
                          Videos
                        </p>
                        <p className="text-xs text-muted-foreground">.mov, .mp4</p>
                      </div>
                    </div>
                    <p className="mt-3 text-xs text-muted-foreground">
                      *Max size of 20MB and 16,400 x 10,900 pixels.
                    </p>
                  </div>
                </>
              )}
            </div>
          )}

          {stage.kind === "error" && (
            <p className="mt-3 flex items-center gap-1.5 text-sm text-destructive">
              <AlertTriangle className="size-4" />
              {stage.message}
            </p>
          )}

          {rowErrors.length > 0 && (
            <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800">
              <p className="mb-1 font-medium">
                {rowErrors.length} file{rowErrors.length !== 1 && "s"} couldn't be uploaded:
              </p>
              <ul className="list-inside list-disc space-y-0.5">
                {rowErrors.map((e) => (
                  <li key={e.file}>
                    {e.file} — {e.error}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {stage.kind === "video-modal" && workspaceId && projectId && (
        <VideoExtractor
          open
          onOpenChange={(open) => {
            if (!open) setStage({ kind: "idle" })
          }}
          workspaceId={workspaceId}
          projectId={projectId}
          file={stage.file}
          batchName={batchName}
          tagNames={tags}
          onExtractionComplete={(batchId) => {
            setPendingBatch({ workspaceId, projectId, batchId })
            setStage({ kind: "review", batchId })
          }}
          onSkip={() => setStage({ kind: "idle" })}
        />
      )}

      <Dialog open={discardOpen} onOpenChange={discarding ? undefined : setDiscardOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Discard this batch?</DialogTitle>
            <DialogDescription>
              You haven't clicked "Save and Continue" yet. Leaving now deletes everything
              uploaded so far in this batch — nothing will be kept.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDiscardOpen(false)} disabled={discarding}>
              Keep editing
            </Button>
            <Button variant="destructive" onClick={handleDiscard} disabled={discarding}>
              {discarding ? "Discarding…" : "Discard and leave"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function extractErrorMessage(err: unknown): string {
  if (typeof err === "object" && err !== null && "response" in err) {
    const resp = (err as { response?: { data?: { detail?: unknown } } }).response
    const detail = resp?.data?.detail
    if (typeof detail === "string") return detail
    if (detail && typeof detail === "object" && "message" in detail) {
      return String((detail as { message: unknown }).message)
    }
  }
  return "Upload failed — please try again."
}
