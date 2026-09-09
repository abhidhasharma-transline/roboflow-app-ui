import { useEffect, useMemo, useRef, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
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
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { TagInput } from "@/components/shared/TagInput"
import { ScrollToTopButton } from "@/components/shared/ScrollToTopButton"
import { VideoExtractor } from "./VideoExtractor"
import { BatchReview } from "./BatchReview"
import { uploadImagesChunked, discardBatch } from "@/lib/uploadApi"
import { useWorkspaceStore } from "@/stores/workspaceStore"
import { useToastStore } from "@/stores/toastStore"
import { useUnsavedUploadStore } from "@/stores/unsavedUploadStore"
import { useUnsavedUploadGuard } from "@/hooks/useUnsavedUploadGuard"
import type { UploadImagesResponse } from "@/types/upload"

const VIDEO_EXTENSIONS = /\.(mp4|mov)$/i
const LABEL_EXTENSIONS = /\.(txt|yaml|yml)$/i
// This pre-upload grid is all local File objects already in memory (no
// network involved) — a folder select of ~1000 files would otherwise render
// ~1000 LocalThumbs (each its own object URL + <img>) in one shot, endless
// scroll with no way to just see "the first bunch." Rendering only a page
// at a time keeps it responsive; "Load more" just reveals more of what's
// already loaded, so it's instant.
const LOCAL_PAGE_SIZE = 100

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
  | { kind: "selected"; files: File[]; folderName?: string; labelFiles?: File[] }
  | { kind: "committing"; percent: number; label: string; currentFile?: string }
  | { kind: "video-modal"; file: File }
  | { kind: "review"; batchId: string }
  | { kind: "error"; message: string }

type LocalBox = { classId: number; x: number; y: number; width: number; height: number }

// Same order as app/upload/service.py's _YOLO_CLASS_COLORS (and the
// annotation tool's NEW_CLASS_COLORS) — indexing by class_id here means the
// preview's colors already match what each class will actually get once
// the upload creates real Class rows, not just "some colors."
const LOCAL_CLASS_COLORS = [
  "#FF3B3B", "#3B82F6", "#22C55E", "#F59E0B", "#A855F7", "#EC4899", "#14B8A6", "#F97316",
]

function stemOf(filename: string) {
  const i = filename.lastIndexOf(".")
  return i === -1 ? filename : filename.slice(0, i)
}

// Mirrors app/upload/service.py's _parse_yolo_label_lines + the cx/cy/w/h →
// x/y/width/height (percent, top-left origin) conversion in
// _import_yolo_annotations, so this local pre-upload preview lines up with
// what the server will actually create — client-side only, nothing is sent
// or persisted here.
function parseYoloLabelText(text: string): LocalBox[] {
  const boxes: LocalBox[] = []
  for (const line of text.split(/\r?\n/)) {
    const parts = line.trim().split(/\s+/)
    if (parts.length < 5) continue
    const [classId, cx, cy, w, h] = parts.map(Number)
    if ([classId, cx, cy, w, h].some((n) => !Number.isFinite(n)) || w <= 0 || h <= 0) continue
    boxes.push({
      classId,
      x: Math.max(0, (cx - w / 2) * 100),
      y: Math.max(0, (cy - h / 2) * 100),
      width: Math.min(100, w * 100),
      height: Math.min(100, h * 100),
    })
  }
  return boxes
}

// Tile is a fixed 4/3 box but the real image rarely is — with object-contain
// the image only occupies a letterboxed sub-rect of that box. An overlay
// drawn at inset-0/size-full would then land on the padding, not the image
// (the same class of misalignment the Annotate tool's canvas had before its
// aspect-ratio fix). Computed in pure percent from the two aspect ratios —
// no DOM measurement needed — so it's exact regardless of tile size.
const TILE_ASPECT = 4 / 3

function LocalThumb({
  file,
  boxes,
  onRemove,
}: {
  file: File
  boxes?: LocalBox[]
  onRemove: () => void
}) {
  const [url, setUrl] = useState<string | null>(null)
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null)
  useEffect(() => {
    const objectUrl = URL.createObjectURL(file)
    setUrl(objectUrl)
    setNatural(null)
    return () => URL.revokeObjectURL(objectUrl)
  }, [file])

  const innerRect = useMemo(() => {
    if (!natural) return null
    const imgAspect = natural.w / natural.h
    if (imgAspect > TILE_ASPECT) {
      const heightPct = (TILE_ASPECT / imgAspect) * 100
      return { left: 0, top: (100 - heightPct) / 2, width: 100, height: heightPct }
    }
    const widthPct = (imgAspect / TILE_ASPECT) * 100
    return { left: (100 - widthPct) / 2, top: 0, width: widthPct, height: 100 }
  }, [natural])

  return (
    <div className="group relative aspect-[4/3] overflow-hidden rounded-md border border-border bg-muted [content-visibility:auto] [contain-intrinsic-size:0_180px]">
      {url && (
        <img
          src={url}
          alt={file.name}
          className="size-full object-contain"
          onLoad={(e) => setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
        />
      )}
      {!!boxes?.length && innerRect && (
        <svg
          className="pointer-events-none absolute"
          style={{ left: `${innerRect.left}%`, top: `${innerRect.top}%`, width: `${innerRect.width}%`, height: `${innerRect.height}%` }}
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          {boxes.map((b, i) => (
            <rect
              key={i}
              x={b.x}
              y={b.y}
              width={b.width}
              height={b.height}
              fill="none"
              stroke={LOCAL_CLASS_COLORS[b.classId % LOCAL_CLASS_COLORS.length]}
              strokeWidth={0.8}
            />
          ))}
        </svg>
      )}
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
  const navigate = useNavigate()
  const workspaceId = useWorkspaceStore((s) => s.activeWorkspaceId)
  const addToast = useToastStore((s) => s.addToast)
  const { pendingBatch, setPendingBatch, clearPendingBatch } = useUnsavedUploadStore()
  useUnsavedUploadGuard()

  const [batchName, setBatchName] = useState(defaultBatchName)
  const [tags, setTags] = useState<string[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [stage, setStage] = useState<Stage>({ kind: "idle" })
  const [rowErrors, setRowErrors] = useState<UploadImagesResponse["errors"]>([])
  const [discardOpen, setDiscardOpen] = useState(false)
  // Duplicates (same content already in this project) are skipped entirely —
  // no new image row is created for them, matching Roboflow's own upload
  // behavior. This just tells the user which of their selected files were
  // skipped and why, so the saved/total count isn't a silent mystery.
  const [duplicateNotice, setDuplicateNotice] = useState<string[] | null>(null)
  const [discarding, setDiscarding] = useState(false)
  const [localPreviewBoxes, setLocalPreviewBoxes] = useState<Record<string, LocalBox[]>>({})
  const [localVisibleCount, setLocalVisibleCount] = useState(LOCAL_PAGE_SIZE)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Purely a local preview so the "ready to upload" grid can already show
  // the boxes a matching label file will import — nothing here is sent
  // anywhere; the server does its own parsing from the actual uploaded
  // label_files once "Save and Continue" is clicked.
  useEffect(() => {
    if (stage.kind !== "selected" || !stage.labelFiles?.length) {
      setLocalPreviewBoxes({})
      return
    }
    let cancelled = false
    const imageStems = new Set(stage.files.map((f) => stemOf(f.name)))
    Promise.all(
      stage.labelFiles
        .filter((f) => imageStems.has(stemOf(f.name)))
        .map(async (f) => [stemOf(f.name), parseYoloLabelText(await f.text())] as const)
    ).then((entries) => {
      if (!cancelled) setLocalPreviewBoxes(Object.fromEntries(entries))
    })
    return () => {
      cancelled = true
    }
  }, [stage])

  async function commitImages(files: File[], folderName?: string, labelFiles?: File[]) {
    if (!workspaceId || !projectId) {
      setStage({ kind: "error", message: "No active workspace/project — select a workspace first." })
      return
    }
    setRowErrors([])
    setStage({ kind: "committing", percent: 0, label: "Processing files…" })
    try {
      const res = await uploadImagesChunked(
        workspaceId,
        projectId,
        files,
        { batchName, tagNames: tags, folderName, labelFiles },
        (percent, currentFile) => setStage({ kind: "committing", percent, label: "Processing files…", currentFile })
      )
      setRowErrors(res.errors)
      if (res.duplicate_filenames.length > 0) {
        setDuplicateNotice(res.duplicate_filenames)
      }
      if (res.annotations_imported > 0) {
        addToast({
          variant: "success",
          title: "Annotations imported",
          description: `${res.annotations_imported} box${res.annotations_imported !== 1 ? "es" : ""} across ${res.images_annotated} image${res.images_annotated !== 1 ? "s" : ""}, from the label files in your upload.`,
        })
      }
      if (res.saved === 0) {
        // Nothing new actually landed in this batch (e.g. every file was
        // an exact duplicate of something already in the project) — a
        // Batch Review screen for a batch with zero images is a dead end
        // (nothing to look at, "Save and Continue" would have nothing to
        // save). Discard the now-pointless empty batch and stay on the
        // upload screen instead — the duplicate dialog above already told
        // the user what happened to their files.
        discardBatch(workspaceId, projectId, res.batch_id).catch(() => {})
        setStage({ kind: "idle" })
        return
      }
      setPendingBatch({ workspaceId, projectId, batchId: res.batch_id })
      setStage({ kind: "review", batchId: res.batch_id })
    } catch (err) {
      setStage({ kind: "error", message: extractErrorMessage(err) })
    }
  }

  function handleFiles(fileList: FileList, folderName?: string) {
    const files = Array.from(fileList)
    const videoFile = files.find((f) => f.type.startsWith("video/") || VIDEO_EXTENSIONS.test(f.name))
    if (videoFile) {
      // Video extraction and image upload are two separate flows — only one
      // file can go through the extraction modal at a time. Previously the
      // rest of a mixed selection (images, label files) just vanished with
      // no indication anything was dropped; now the user is told exactly
      // what got skipped and why, instead of silently losing files.
      if (files.length > 1) {
        addToast({
          variant: "error",
          title: "Only the video was opened",
          description: `${files.length - 1} other file${files.length - 1 !== 1 ? "s" : ""} in that selection ${files.length - 1 !== 1 ? "were" : "was"} ignored — upload a video by itself, or upload images/labels separately.`,
        })
      }
      setStage({ kind: "video-modal", file: videoFile })
      return
    }

    // A folder that mirrors Roboflow's export layout (images/ + labels/,
    // one .txt per image, plus an optional classes.txt/data.yaml) carries
    // its annotations right alongside the images — split those .txt/.yaml
    // files out here so they ride along as label_files instead of failing
    // image validation on the server.
    const labelFiles = files.filter((f) => LABEL_EXTENSIONS.test(f.name))
    const imageFiles = files.filter((f) => f !== videoFile && !LABEL_EXTENSIONS.test(f.name))

    if (imageFiles.length === 0) return
    setLocalVisibleCount(LOCAL_PAGE_SIZE)
    setStage({ kind: "selected", files: imageFiles, folderName, labelFiles })
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
    setLocalVisibleCount(LOCAL_PAGE_SIZE)
    if (fileInputRef.current) fileInputRef.current.value = ""
    if (folderInputRef.current) folderInputRef.current.value = ""
  }

  function handleSaved(batchId: string) {
    clearPendingBatch()
    navigate(`/projects/${projectId}/annotate/batch/${batchId}`)
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
    navigate("/projects")
  }

  const isBusy = stage.kind === "committing" || stage.kind === "video-modal"

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto p-8">
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
              onSaved={() => handleSaved(stage.batchId)}
            />
          ) : stage.kind === "selected" ? (
            <div>
              <div className="mb-4 flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {stage.files.length} image{stage.files.length !== 1 && "s"} ready to upload —
                  nothing has been sent to the server yet.
                  {!!stage.labelFiles?.length && (
                    <span className="ml-1 text-brand">
                      {stage.labelFiles.length} annotation file{stage.labelFiles.length !== 1 && "s"} detected —
                      matching boxes will be imported automatically.
                    </span>
                  )}
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={resetToIdle}>
                    Cancel
                  </Button>
                  <Button
                    variant="brand"
                    onClick={() => commitImages(stage.files, stage.folderName, stage.labelFiles)}
                    disabled={stage.files.length === 0}
                  >
                    Save and Continue
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                {stage.files.slice(0, localVisibleCount).map((file, i) => (
                  <LocalThumb
                    key={`${file.name}-${file.lastModified}-${i}`}
                    file={file}
                    boxes={localPreviewBoxes[stemOf(file.name)]}
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
              {stage.files.length > localVisibleCount && (
                <div className="flex flex-col items-center gap-2 pt-4">
                  <p className="text-xs text-muted-foreground">
                    {Math.min(localVisibleCount, stage.files.length)} / {stage.files.length} shown
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setLocalVisibleCount((n) => n + LOCAL_PAGE_SIZE)}
                  >
                    Load more
                  </Button>
                </div>
              )}
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
                <div className="flex w-full max-w-lg flex-col items-center gap-3 py-6">
                  <p className="text-lg font-semibold text-brand">{stage.label}</p>
                  {stage.currentFile && (
                    <p className="max-w-full truncate text-xs text-muted-foreground italic" title={stage.currentFile}>
                      {stage.currentFile}
                    </p>
                  )}
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
                    <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                      <FileText className="size-4" />
                      Select File(s)
                    </Button>
                    <Button variant="outline" onClick={() => folderInputRef.current?.click()}>
                      <BoxSelect className="size-4" />
                      Select Folder
                    </Button>
                  </div>
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
                      <div>
                        <p className="flex items-center gap-1.5 font-medium text-foreground">
                          <FileText className="size-4" />
                          Annotations
                        </p>
                        <p className="text-xs text-muted-foreground">
                          YOLO .txt (+ classes.txt / data.yaml)
                        </p>
                      </div>
                    </div>
                    <p className="mt-3 text-xs text-muted-foreground">
                      *Max size of 20MB and 16,400 x 10,900 pixels. Selecting a folder with
                      matching image + label files (e.g. an exported "images/" + "labels/" set)
                      imports the existing boxes automatically.
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

      <ScrollToTopButton containerRef={scrollRef} />

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
          onBatchCommitted={(batchId) => setPendingBatch({ workspaceId, projectId, batchId })}
          onExtractionComplete={(batchId) => {
            setPendingBatch({ workspaceId, projectId, batchId })
            setStage({ kind: "review", batchId })
          }}
          onExtractionEmpty={() => {
            clearPendingBatch()
            addToast({
              variant: "error",
              title: "Nothing new to add",
              description: "Every frame this video would have produced already exists in this project.",
            })
            setStage({ kind: "idle" })
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

      <Dialog open={duplicateNotice !== null} onOpenChange={(open) => !open && setDuplicateNotice(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="size-5 shrink-0" />
              {duplicateNotice?.length} duplicate image{duplicateNotice?.length !== 1 ? "s" : ""} skipped
            </DialogTitle>
            <DialogDescription>
              These files already exist in this project (identical content) — they weren't uploaded again,
              to avoid duplicate images in your dataset and training splits.
            </DialogDescription>
          </DialogHeader>
          <ul className="max-h-64 overflow-y-auto rounded-md border border-border bg-muted/20 p-3 text-sm text-muted-foreground">
            {duplicateNotice?.slice(0, 200).map((name, i) => (
              <li key={i} className="truncate" title={name}>
                {name}
              </li>
            ))}
            {duplicateNotice && duplicateNotice.length > 200 && (
              <li className="pt-1 text-xs italic">…and {duplicateNotice.length - 200} more</li>
            )}
          </ul>
          <DialogFooter>
            <Button onClick={() => setDuplicateNotice(null)}>OK</Button>
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
