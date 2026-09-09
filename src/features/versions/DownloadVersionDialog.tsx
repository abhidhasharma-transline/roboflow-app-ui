import { useEffect, useRef, useState } from "react"
import { Download, FileArchive, Code2, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react"
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
import { startVersionExport, getVersionExportStatus, checkVersionHasPolygon } from "@/lib/versionApi"
import { YOLO_FORMATS, supportsSegmentation, SUGGESTED_SEGMENTATION_FORMAT } from "@/lib/yoloVersions"
import { useToastStore } from "@/stores/toastStore"

const POLL_INTERVAL_MS = 2000
const MAX_POLL_ATTEMPTS = 300 // ~10 minutes

type Phase = "idle" | "confirm-format" | "exporting" | "ready" | "error"

export function DownloadVersionDialog({
  open,
  onOpenChange,
  workspaceId,
  projectId,
  versionId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  workspaceId: string
  projectId: string
  versionId: string
}) {
  const [format, setFormat] = useState(YOLO_FORMATS[2])
  const [option, setOption] = useState<"zip" | "code">("zip")
  const [phase, setPhase] = useState<Phase>("idle")
  const [percent, setPercent] = useState(0)
  const [message, setMessage] = useState("")
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const [hasPolygon, setHasPolygon] = useState(false)
  // True from the moment the dialog opens until the precheck resolves
  // (success OR failure) — Continue stays disabled for this window so a
  // fast click can't race past it and silently skip the format warning
  // (before this, hasPolygon's default of `false` meant an early click saw
  // the same "no polygon" state as a real precheck failure — no way to
  // tell "don't know yet" apart from "checked, and it's fine"). A failed
  // precheck still resolves this to false and lets Continue proceed
  // without the warning — a backend hiccup here shouldn't block the export.
  const [precheckLoading, setPrecheckLoading] = useState(true)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const addToast = useToastStore((s) => s.addToast)
  const removeToast = useToastStore((s) => s.removeToast)
  const toastIdRef = useRef<string | null>(null)

  function clearProgressToast() {
    if (toastIdRef.current) {
      removeToast(toastIdRef.current)
      toastIdRef.current = null
    }
  }

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }

  // Dialog reopening (or a brand new version) should always start fresh —
  // otherwise a previous run's "ready"/"error" state would confusingly
  // persist across opens.
  useEffect(() => {
    if (open) {
      setPhase("idle")
      setPercent(0)
      setMessage("")
      setDownloadUrl(null)
      setPrecheckLoading(true)
      checkVersionHasPolygon(workspaceId, projectId, versionId)
        .then(setHasPolygon)
        .catch(() => setHasPolygon(false))
        .finally(() => setPrecheckLoading(false))
    } else {
      stopPolling()
      clearProgressToast()
    }
  }, [open, workspaceId, projectId, versionId])

  useEffect(() => stopPolling, [])

  // "Continue" — if the dataset has real polygon shapes but the selected
  // YOLO version has no segmentation checkpoint to train them with, warn
  // BEFORE exporting (the bundled README already explains this, but by
  // then the user has already downloaded a zip they may not have wanted).
  function handleContinue() {
    if (hasPolygon && !supportsSegmentation(format)) {
      setPhase("confirm-format")
      return
    }
    handleStart()
  }

  async function handleStart() {
    setPhase("exporting")
    setPercent(0)
    setMessage("Starting export…")
    toastIdRef.current = addToast({ variant: "loading", title: "Preparing export…" })
    try {
      const { export_id } = await startVersionExport(workspaceId, projectId, versionId, format)
      let attempts = 0
      pollRef.current = setInterval(async () => {
        attempts += 1
        if (attempts > MAX_POLL_ATTEMPTS) {
          stopPolling()
          setPhase("error")
          setMessage("This is taking longer than expected — try again in a bit.")
          clearProgressToast()
          addToast({ variant: "error", title: "Export is taking too long", description: "Please try again in a bit." })
          return
        }
        try {
          const res = await getVersionExportStatus(workspaceId, projectId, versionId, export_id)
          setPercent(res.percent)
          if (res.message) setMessage(res.message)
          if (res.status === "done") {
            stopPolling()
            setPhase("ready")
            setDownloadUrl(res.download_url ?? null)
            clearProgressToast()
            addToast({ variant: "success", title: "Export ready" })
          } else if (res.status === "failed") {
            stopPolling()
            setPhase("error")
            setMessage(res.message || "Export failed — please try again.")
            clearProgressToast()
            addToast({ variant: "error", title: "Export failed", description: res.message || "Please try again." })
          }
        } catch {
          // transient network hiccup — next tick retries, capped by MAX_POLL_ATTEMPTS
        }
      }, POLL_INTERVAL_MS)
    } catch {
      setPhase("error")
      setMessage("Couldn't start the export — please try again.")
      clearProgressToast()
      addToast({ variant: "error", title: "Couldn't start the export", description: "Please try again." })
    }
  }

  const busy = phase === "exporting"

  return (
    <Dialog open={open} onOpenChange={busy ? undefined : onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="size-4" />
            Download
          </DialogTitle>
        </DialogHeader>

        {phase === "idle" && (
          <>
            <div>
              <p className="mb-1.5 text-sm font-medium text-foreground">Image and Annotation Format</p>
              <Select value={format} onValueChange={setFormat}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {YOLO_FORMATS.map((f) => (
                    <SelectItem key={f} value={f}>{f}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="mt-2 rounded-md border-l-4 border-amber-400 bg-muted p-3 text-sm text-muted-foreground">
                TXT annotations and YAML config used with <span className="font-medium text-foreground">{format}</span>.
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-foreground">Download Options</p>
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => setOption("zip")}
                  className={`flex items-start gap-3 rounded-lg border p-3 text-left ${
                    option === "zip" ? "border-brand bg-brand/5" : "border-border hover:bg-accent"
                  }`}
                >
                  <span
                    className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border-2 ${
                      option === "zip" ? "border-brand" : "border-input"
                    }`}
                  >
                    {option === "zip" && <span className="size-2 rounded-full bg-brand" />}
                  </span>
                  <div>
                    <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                      <FileArchive className="size-3.5" />
                      Download zip to computer
                    </p>
                    <p className="text-xs text-muted-foreground">Downloads all images, annotations, and classes.</p>
                  </div>
                </button>

                <button
                  disabled
                  title="Coming soon — no hosted dataset API to generate a code snippet from yet"
                  className="flex cursor-not-allowed items-start gap-3 rounded-lg border border-border p-3 text-left opacity-50"
                >
                  <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border-2 border-input" />
                  <div>
                    <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                      <Code2 className="size-3.5" />
                      Show download code
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Custom train this dataset using the provided code snippet in a notebook.
                    </p>
                  </div>
                </button>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button variant="brand" onClick={handleContinue} disabled={precheckLoading} title={precheckLoading ? "Checking dataset…" : undefined}>
                {precheckLoading && <Loader2 className="size-4 animate-spin" />}
                Continue
              </Button>
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
