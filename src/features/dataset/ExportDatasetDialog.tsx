import { useEffect, useRef, useState } from "react"
import {
  ChevronDown, Download, Activity, ShieldCheck, Pencil, FileArchive, Code2,
  AlertTriangle, Loader2, CheckCircle2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu"
import { listProjectImages } from "@/lib/imageApi"
import { startDatasetExport, getDatasetExportStatus, checkDatasetHasPolygon } from "@/lib/exportApi"
import { YOLO_FORMATS, supportsSegmentation, SUGGESTED_SEGMENTATION_FORMAT } from "@/lib/yoloVersions"
import type { ProjectAnnotationType } from "@/types/project"

const POLL_INTERVAL_MS = 2000
const MAX_POLL_ATTEMPTS = 300 // ~10 minutes

type Phase = "idle" | "confirm-format" | "exporting" | "ready" | "error"

function annotationTypeLabel(type: ProjectAnnotationType) {
  return type
    .split("_")
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ")
}

export function ExportDatasetDialog({
  workspaceId,
  projectId,
  annotationType,
  classCount,
  open,
  onOpenChange,
}: {
  workspaceId: string
  projectId: string
  annotationType: ProjectAnnotationType
  classCount: number
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [format, setFormat] = useState(YOLO_FORMATS[1])
  const [counts, setCounts] = useState<{ total: number; train: number; valid: number; test: number } | null>(null)
  const [hasPolygon, setHasPolygon] = useState(false)
  // True from dialog-open until the precheck resolves (success OR failure)
  // — "Export As" stays disabled for this window so a fast click can't
  // race past it and silently skip the format warning. A failed precheck
  // still resolves this to false and lets export proceed without the
  // warning — a backend hiccup here shouldn't block the whole export.
  const [precheckLoading, setPrecheckLoading] = useState(true)
  const [phase, setPhase] = useState<Phase>("idle")
  const [percent, setPercent] = useState(0)
  const [message, setMessage] = useState("")
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }

  useEffect(() => {
    if (!open) {
      stopPolling()
      return
    }
    setPhase("idle")
    setPercent(0)
    setMessage("")
    setDownloadUrl(null)
    setCounts(null)
    Promise.all([
      listProjectImages(workspaceId, projectId, { status: "dataset", limit: 1 }),
      listProjectImages(workspaceId, projectId, { status: "dataset", split: "train", limit: 1 }),
      listProjectImages(workspaceId, projectId, { status: "dataset", split: "valid", limit: 1 }),
      listProjectImages(workspaceId, projectId, { status: "dataset", split: "test", limit: 1 }),
    ]).then(([all, train, valid, test]) => {
      setCounts({ total: all.total, train: train.total, valid: valid.total, test: test.total })
    })
    setPrecheckLoading(true)
    checkDatasetHasPolygon(workspaceId, projectId)
      .then(setHasPolygon)
      .catch(() => setHasPolygon(false))
      .finally(() => setPrecheckLoading(false))
  }, [open, workspaceId, projectId])

  useEffect(() => stopPolling, [])

  async function handleStart() {
    setPhase("exporting")
    setPercent(0)
    setMessage("Starting export…")
    try {
      const { export_id } = await startDatasetExport(workspaceId, projectId, format)
      let attempts = 0
      pollRef.current = setInterval(async () => {
        attempts += 1
        if (attempts > MAX_POLL_ATTEMPTS) {
          stopPolling()
          setPhase("error")
          setMessage("This is taking longer than expected — try again in a bit.")
          return
        }
        try {
          const res = await getDatasetExportStatus(workspaceId, projectId, export_id)
          setPercent(res.percent)
          if (res.message) setMessage(res.message)
          if (res.status === "done") {
            stopPolling()
            setPhase("ready")
            setDownloadUrl(res.download_url ?? null)
          } else if (res.status === "failed") {
            stopPolling()
            setPhase("error")
            setMessage(res.message || "Export failed — please try again.")
          }
        } catch {
          // transient network hiccup — next tick retries, capped by MAX_POLL_ATTEMPTS
        }
      }, POLL_INTERVAL_MS)
    } catch {
      setPhase("error")
      setMessage("Couldn't start the export — please try again.")
    }
  }

  // Warn BEFORE exporting if the dataset has real polygon shapes but the
  // selected YOLO version has no segmentation checkpoint to train them
  // with — the bundled README already explains this, but by then the user
  // has already downloaded a zip they may not have wanted.
  function handleExportZipClick() {
    if (hasPolygon && !supportsSegmentation(format)) {
      setPhase("confirm-format")
      return
    }
    handleStart()
  }

  const busy = phase === "exporting"
  const total = counts?.total ?? 0
  const trainPct = total > 0 ? ((counts?.train ?? 0) / total) * 100 : 0
  const validPct = total > 0 ? ((counts?.valid ?? 0) / total) * 100 : 0
  const testPct = total > 0 ? ((counts?.test ?? 0) / total) * 100 : 0

  return (
    <Dialog open={open} onOpenChange={busy ? undefined : onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-1 flex size-12 items-center justify-center rounded-full bg-brand/10">
            <Download className="size-5 text-brand" />
          </div>
          <DialogTitle className="text-center">Export Dataset</DialogTitle>
          {phase === "idle" && (
            <div className="flex justify-center">
              <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                {annotationTypeLabel(annotationType)}
              </span>
            </div>
          )}
        </DialogHeader>

        {phase === "idle" && (
          <>
            <div className="rounded-lg border border-border p-3">
              <p className="mb-2 text-sm text-muted-foreground">
                {total} image{total !== 1 && "s"} · {classCount} class{classCount !== 1 && "es"}
              </p>
              {counts && total > 0 && (
                <>
                  <div className="flex h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="bg-brand" style={{ width: `${trainPct}%` }} />
                    <div className="bg-blue-500" style={{ width: `${validPct}%` }} />
                    <div className="bg-orange-500" style={{ width: `${testPct}%` }} />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Activity className="size-3 text-brand" />Train {counts.train}</span>
                    <span className="flex items-center gap-1"><ShieldCheck className="size-3 text-blue-500" />Valid {counts.valid}</span>
                    <span className="flex items-center gap-1"><Pencil className="size-3 text-orange-500" />Test {counts.test}</span>
                  </div>
                </>
              )}
            </div>

            <div>
              <p className="mb-1.5 text-sm font-medium text-foreground">Format</p>
              <Select value={format} onValueChange={setFormat}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {YOLO_FORMATS.map((f) => (
                    <SelectItem key={f} value={f}>{f}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-1.5 text-xs text-muted-foreground">
                TXT annotations and YAML config used with {format}.
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="brand"
                    disabled={precheckLoading || !counts || total === 0}
                    title={precheckLoading ? "Checking dataset…" : undefined}
                  >
                    {precheckLoading ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                    Export As
                    <ChevronDown className="size-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <DropdownMenuItem onClick={handleExportZipClick} className="flex-col items-start gap-0.5 py-2">
                    <span className="flex items-center gap-2 font-medium">
                      <FileArchive className="size-4" />
                      ZIP file
                    </span>
                    <span className="pl-6 text-xs text-muted-foreground">
                      Download images, annotations, and class list as a single archive.
                    </span>
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled className="flex-col items-start gap-0.5 py-2">
                    <span className="flex items-center gap-2 font-medium">
                      <Code2 className="size-4" />
                      Code snippet
                    </span>
                    <span className="pl-6 text-xs text-muted-foreground">
                      Coming soon — no hosted dataset API yet.
                    </span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </>
        )}

        {phase === "confirm-format" && (
          <div className="flex flex-col gap-4 py-2">
            <div className="flex items-start gap-3 rounded-lg border-l-4 border-amber-400 bg-muted p-3">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" />
              <p className="text-sm text-foreground">
                Aapke dataset me polygon annotations hain, lekin <span className="font-medium">{format}</span> segmentation
                support nahi karta. Export karne par polygon boxes (bounding boxes) me convert ho jayenge.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setFormat(SUGGESTED_SEGMENTATION_FORMAT)
                  setPhase("idle")
                }}
              >
                Segmentation-supported version use karo
              </Button>
              <Button variant="brand" onClick={handleStart}>
                Bbox format me hi export karo, aage badho
              </Button>
            </div>
          </div>
        )}

        {phase === "exporting" && (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <p className="text-sm font-medium text-foreground">Preparing your download…</p>
            <Progress value={percent} className="w-full" />
            <p className="text-xs text-muted-foreground">{message || `${percent}%`}</p>
          </div>
        )}

        {phase === "ready" && (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <CheckCircle2 className="size-8 text-brand" />
            <p className="text-sm font-medium text-foreground">Your export is ready</p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              {downloadUrl && (
                <Button variant="brand" asChild>
                  <a href={downloadUrl}>
                    <Download className="size-4" />
                    Download ZIP
                  </a>
                </Button>
              )}
            </div>
          </div>
        )}

        {phase === "error" && (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <AlertTriangle className="size-8 text-destructive" />
            <p className="text-sm font-medium text-foreground">{message}</p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              <Button variant="brand" onClick={handleStart}>
                Try again
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
