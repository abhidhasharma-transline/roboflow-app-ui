import { useRef, useState } from "react"
import { useParams } from "react-router-dom"
import {
  Upload,
  Image as ImageIcon,
  BoxSelect,
  Video,
  FileText,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { TagInput } from "@/components/shared/TagInput"
import { VideoExtractor } from "./VideoExtractor"
import { BatchPreviewGrid } from "./BatchPreviewGrid"
import { uploadImages, initiateVideoUpload, saveBatch } from "@/lib/uploadApi"
import { useWorkspaceStore } from "@/stores/workspaceStore"
import type { UploadImagesResponse, VideoInitiateResponse } from "@/types/upload"

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
    .replace(" ", " ")
  return `Uploaded on ${date} at ${time}`
}

type Stage =
  | { kind: "idle" }
  | { kind: "uploading"; percent: number; label: string }
  | { kind: "video-modal"; video: VideoInitiateResponse }
  | { kind: "preview"; batchId: string }
  | { kind: "saved"; imageCount: number }
  | { kind: "error"; message: string }

export function UploadPage() {
  const { projectId } = useParams()
  const workspaceId = useWorkspaceStore((s) => s.activeWorkspaceId)

  const [batchName, setBatchName] = useState(defaultBatchName)
  const [tags, setTags] = useState<string[]>([])
  const [createInstantly, setCreateInstantly] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [stage, setStage] = useState<Stage>({ kind: "idle" })
  const [rowErrors, setRowErrors] = useState<UploadImagesResponse["errors"]>([])

  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  async function handleFiles(fileList: FileList, folderName?: string) {
    if (!workspaceId || !projectId) {
      setStage({ kind: "error", message: "No active workspace/project — select a workspace first." })
      return
    }
    const files = Array.from(fileList)
    const videoFile = files.find((f) => f.type.startsWith("video/") || VIDEO_EXTENSIONS.test(f.name))
    const imageFiles = files.filter((f) => f !== videoFile)

    setRowErrors([])

    // A drop with a video in it is treated as a video upload — video and
    // image batches are separate concepts on the backend (SourceTypeEnum),
    // so we don't try to merge them into one request.
    if (videoFile) {
      setStage({ kind: "uploading", percent: 0, label: `Uploading ${videoFile.name}…` })
      try {
        const res = await initiateVideoUpload(
          workspaceId,
          projectId,
          videoFile,
          { batchName, tagNames: tags },
          (percent) => setStage({ kind: "uploading", percent, label: `Uploading ${videoFile.name}…` })
        )
        setStage({ kind: "video-modal", video: res })
      } catch (err) {
        setStage({ kind: "error", message: extractErrorMessage(err) })
      }
      return
    }

    if (imageFiles.length === 0) return

    setStage({ kind: "uploading", percent: 0, label: `Uploading ${imageFiles.length} image(s)…` })
    try {
      const res = await uploadImages(
        workspaceId,
        projectId,
        imageFiles,
        { batchName, tagNames: tags, folderName },
        (percent) => setStage({ kind: "uploading", percent, label: `Uploading ${imageFiles.length} image(s)…` })
      )
      setRowErrors(res.errors)

      if (createInstantly) {
        await saveBatch(workspaceId, projectId, res.batch_id, batchName, tags)
        setStage({ kind: "saved", imageCount: res.saved })
      } else {
        setStage({ kind: "preview", batchId: res.batch_id })
      }
    } catch (err) {
      setStage({ kind: "error", message: extractErrorMessage(err) })
    }
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

  const isBusy = stage.kind === "uploading" || stage.kind === "video-modal"

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <h1 className="mb-6 flex items-center gap-2.5 text-2xl font-semibold text-foreground">
        <Upload className="size-6" />
        Upload Data
      </h1>

      {/* BATCH AND TAG FEILD */}
      <div className="grid grid-cols-1 gap-6">
        <div>
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

          <label className="mb-4 flex items-center gap-2 text-sm text-foreground">
            <Checkbox
              checked={createInstantly}
              onCheckedChange={(v) => setCreateInstantly(v === true)}
              disabled={isBusy}
            />
            Create batch instantly
          </label>
          
          {stage.kind === "saved" ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-12 text-center">
              <CheckCircle2 className="size-10 text-emerald-600" />
              <p className="text-lg font-semibold text-foreground">
                Batch saved — {stage.imageCount} image{stage.imageCount !== 1 && "s"}
              </p>
              <p className="text-sm text-muted-foreground">
                It's in Unassigned, ready to annotate.
              </p>
              <Button variant="outline" onClick={resetToIdle}>
                Upload more
              </Button>
            </div>
          ) : stage.kind === "preview" ? (
            <BatchPreviewGrid
              workspaceId={workspaceId ?? ""}
              projectId={projectId ?? ""}
              batchId={stage.batchId}
              batchName={batchName}
              tags={tags}
              onSaved={() => setStage({ kind: "saved", imageCount: 0 })}
            />
          ) : (
            <div
              onDragOver={(e) => {
                e.preventDefault()
                if (!isBusy) setIsDragging(true)
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={isBusy ? undefined : onDrop}
              className={`flex w-full max-w-7xl flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-12 text-center transition-colors ${
                isDragging ? "border-brand bg-brand/5" : "border-border bg-muted/20"
              }`}
            >
              {stage.kind === "uploading" ? (
                <div className="flex w-full max-w-sm flex-col items-center gap-3 py-6">
                  <p className="text-sm font-medium text-foreground">{stage.label}</p>
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
        {/* Right rail — informational only, not wired to a backend yet */}
      </div>

      {stage.kind === "video-modal" && workspaceId && projectId && (
        <VideoExtractor
          open
          onOpenChange={(open) => {
            if (!open) setStage({ kind: "idle" })
          }}
          workspaceId={workspaceId}
          projectId={projectId}
          video={stage.video}
          onExtractionComplete={(batchId) => setStage({ kind: "preview", batchId })}
          onSkip={() => setStage({ kind: "idle" })}
        />
      )}
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