import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { ChevronUp, ChevronDown, X, GripVertical } from "lucide-react"
import { cn } from "@/lib/utils"
import { initiateVideoUpload, triggerExtraction } from "@/lib/uploadApi"
import { samplingPresets } from "@/lib/videoSampling"
import { useExtractionProgress } from "@/hooks/useExtractionProgress"

interface VideoExtractorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  workspaceId: string
  projectId: string
  file: File
  batchName: string
  tagNames: string[]
  /** Called once extraction finishes successfully, with the batch to load. */
  onExtractionComplete: (batchId: string) => void
  /** Nothing was ever uploaded at this point, so there's genuinely nothing to clean up. */
  onSkip: () => void
}

const FILMSTRIP_FRAME_COUNT = 18
const ASSUMED_FPS = 30
const MIN_RANGE_SECONDS = 0.5

function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = (seconds % 60).toFixed(3)
  return `${String(m).padStart(2, "0")}:${s.padStart(6, "0")}`
}

function formatRate(interval: number): string {
  if (interval <= 0) return "—"
  if (interval <= 1) {
    const fps = 1 / interval
    return `${Number.isInteger(fps) ? fps : fps.toFixed(1)} frames/second`
  }
  return `1 frame every ${interval < 10 ? interval.toFixed(2) : interval.toFixed(1)} seconds`
}

export function VideoExtractor({
  open,
  onOpenChange,
  workspaceId,
  projectId,
  file,
  batchName,
  tagNames,
  onExtractionComplete,
  onSkip,
}: VideoExtractorProps) {
  const playerRef = useRef<HTMLVideoElement>(null)
  const filmstripRef = useRef<HTMLDivElement>(null)

  // Never touches the network — a local, disposable URL pointing at the
  // File already sitting in the browser's memory. Same-origin for canvas
  // purposes, so no CORS setup is needed at all for thumbnail generation.
  //
  // Creation AND revocation live in the SAME effect (not useMemo-for-create
  // + useEffect-for-cleanup) on purpose: React StrictMode's dev-mode
  // mount→cleanup→mount simulation would otherwise revoke the URL that the
  // component is actually displaying, since a URL created during the render
  // phase (useMemo) is shared across both simulated mounts while the
  // cleanup only runs once — killing the live URL before the video can load
  // it (this is exactly what "Loading video…" forever + a failed blob:
  // request with 0 bytes transferred means). Creating a fresh URL inside
  // each effect invocation keeps the discarded first cycle's URL and the
  // real second cycle's URL fully independent.
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  useEffect(() => {
    const url = URL.createObjectURL(file)
    setVideoUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const [thumbVideoEl, setThumbVideoEl] = useState<HTMLVideoElement | null>(null)
  const [canvasEl, setCanvasEl] = useState<HTMLCanvasElement | null>(null)

  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [filmstrip, setFilmstrip] = useState<string[]>([])
  const [filmstripStatus, setFilmstripStatus] = useState<"loading" | "ready" | "unavailable">(
    "loading"
  )
  const [manualOpen, setManualOpen] = useState(false)
  const [manualMarks, setManualMarks] = useState<number[]>([])

  const [rangeStart, setRangeStart] = useState(0)
  const [rangeEnd, setRangeEnd] = useState(0)
  const [draggingHandle, setDraggingHandle] = useState<"start" | "end" | null>(null)

  const presets = useMemo(() => (duration > 0 ? samplingPresets(duration) : []), [duration])
  const minInterval = presets.length ? Math.min(...presets.map((p) => p.interval)) : 1 / 60
  const maxInterval = presets.length ? Math.max(...presets.map((p) => p.interval)) : 60

  const [frameInterval, setFrameInterval] = useState(1)
  const [phase, setPhase] = useState<"idle" | "uploading" | "extracting">("idle")
  const [videoUploadId, setVideoUploadId] = useState<string | null>(null)
  const [committedBatchId, setCommittedBatchId] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const { progress } = useExtractionProgress(workspaceId, projectId, videoUploadId)

  // Once duration is known (native <video> metadata), initialize range/interval defaults.
  useEffect(() => {
    if (duration > 0 && rangeEnd === 0) {
      setRangeEnd(duration)
      const def = samplingPresets(duration).find((p) => p.default)
      if (def) setFrameInterval(def.interval)
    }
  }, [duration, rangeEnd])

  // ── Generate filmstrip thumbnails once, off-screen, without touching the visible player ──
  useEffect(() => {
    if (!open || duration === 0 || filmstrip.length > 0 || !videoUrl) return
    const thumbVideo = thumbVideoEl
    const canvas = canvasEl
    if (!thumbVideo || !canvas) return

    let cancelled = false

    function giveUp() {
      if (cancelled) return
      cancelled = true
      setFilmstripStatus("unavailable")
    }

    function waitForSeek(t: number): Promise<boolean> {
      return new Promise((resolve) => {
        let done = false
        const finish = (ok: boolean) => {
          if (done) return
          done = true
          thumbVideo!.removeEventListener("seeked", onSeeked)
          window.clearTimeout(seekTimeout)
          resolve(ok)
        }
        const onSeeked = () => finish(true)
        const seekTimeout = window.setTimeout(() => finish(false), 4000)
        thumbVideo!.addEventListener("seeked", onSeeked)
        thumbVideo!.currentTime = t
      })
    }

    async function generate() {
      const ctx = canvas!.getContext("2d")
      if (!ctx) return giveUp()

      const results: string[] = []
      const step = duration / (FILMSTRIP_FRAME_COUNT + 1)

      try {
        for (let i = 1; i <= FILMSTRIP_FRAME_COUNT; i++) {
          if (cancelled) return
          const t = step * i
          const seeked = await waitForSeek(t)
          if (cancelled) return
          if (!seeked) continue
          canvas!.width = 80
          canvas!.height = 56
          ctx.drawImage(thumbVideo!, 0, 0, 80, 56)
          results.push(canvas!.toDataURL("image/jpeg", 0.6))
        }
        if (!cancelled) {
          if (results.length > 0) {
            setFilmstrip(results)
            setFilmstripStatus("ready")
          } else {
            giveUp()
          }
        }
      } catch {
        giveUp()
      }
    }

    function onLoadedMetadata() {
      generate()
    }
    function onError() {
      giveUp()
    }

    // This is a SECOND, independent <video> element from the visible
    // player above — it needs its own src and its own "is metadata ready"
    // wait before we can start seeking it frame-by-frame.
    thumbVideo.addEventListener("loadedmetadata", onLoadedMetadata, { once: true })
    thumbVideo.addEventListener("error", onError, { once: true })
    thumbVideo.src = videoUrl
    thumbVideo.load()

    return () => {
      cancelled = true
      thumbVideo.removeEventListener("loadedmetadata", onLoadedMetadata)
      thumbVideo.removeEventListener("error", onError)
    }
  }, [open, duration, thumbVideoEl, canvasEl, filmstrip.length, videoUrl])

  const trimmedDuration = Math.max(MIN_RANGE_SECONDS, rangeEnd - rangeStart)
  const outputCount =
    frameInterval > 0 ? Math.max(1, Math.round(trimmedDuration / frameInterval)) : 0
  const combinedCount = outputCount + manualMarks.length

  const sliderPosition = useMemo(() => {
    if (!duration) return 0
    const logMin = Math.log(minInterval)
    const logMax = Math.log(maxInterval)
    const logVal = Math.log(Math.max(minInterval, Math.min(maxInterval, frameInterval)))
    return ((logVal - logMin) / (logMax - logMin)) * 100
  }, [frameInterval, minInterval, maxInterval, duration])

  function setPosition(position: number) {
    const logMin = Math.log(minInterval)
    const logMax = Math.log(maxInterval)
    const logVal = logMin + (position / 100) * (logMax - logMin)
    setFrameInterval(Number(Math.exp(logVal).toFixed(3)))
  }

  function seekTo(t: number) {
    const clamped = Math.max(0, Math.min(duration, t))
    if (playerRef.current) playerRef.current.currentTime = clamped
    setCurrentTime(clamped)
  }

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      if (!draggingHandle || !filmstripRef.current || !duration) return
      const rect = filmstripRef.current.getBoundingClientRect()
      const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
      const t = pct * duration
      if (draggingHandle === "start") {
        setRangeStart(Math.min(t, rangeEnd - MIN_RANGE_SECONDS))
      } else {
        setRangeEnd(Math.max(t, rangeStart + MIN_RANGE_SECONDS))
      }
    },
    [draggingHandle, duration, rangeStart, rangeEnd]
  )

  useEffect(() => {
    if (!draggingHandle) return
    function onUp() {
      setDraggingHandle(null)
    }
    window.addEventListener("pointermove", handlePointerMove)
    window.addEventListener("pointerup", onUp)
    return () => {
      window.removeEventListener("pointermove", handlePointerMove)
      window.removeEventListener("pointerup", onUp)
    }
  }, [draggingHandle, handlePointerMove])

  const isMarked = manualMarks.some((m) => Math.abs(m - currentTime) < 1 / ASSUMED_FPS / 2)

  function toggleCurrentFrame() {
    if (isMarked) {
      setManualMarks((marks) => marks.filter((m) => Math.abs(m - currentTime) >= 1 / ASSUMED_FPS / 2))
    } else {
      setManualMarks((marks) => [...marks, currentTime].sort((a, b) => a - b))
    }
  }

  function jumpToAdjacentMark(direction: "prev" | "next") {
    if (manualMarks.length === 0) return
    if (direction === "next") {
      const next = manualMarks.find((m) => m > currentTime + 0.001)
      seekTo(next ?? manualMarks[manualMarks.length - 1])
    } else {
      const prev = [...manualMarks].reverse().find((m) => m < currentTime - 0.001)
      seekTo(prev ?? manualMarks[0])
    }
  }

  // ── The actual commit point — nothing has touched the server before this. ──
  async function handleExtract() {
    setUploadError(null)
    setPhase("uploading")
    try {
      const initiated = await initiateVideoUpload(workspaceId, projectId, file, {
        batchName,
        tagNames,
      })
      setCommittedBatchId(initiated.batch_id)
      setPhase("extracting")
      const res = await triggerExtraction(
        workspaceId,
        projectId,
        initiated.video_upload_id,
        frameInterval,
        manualMarks,
        { start: rangeStart, end: rangeEnd }
      )
      setVideoUploadId(res.video_upload_id)
    } catch (err) {
      setPhase("idle")
      setUploadError(extractErrorMessage(err))
    }
  }

  useEffect(() => {
    if (progress?.status === "done" && committedBatchId) {
      onExtractionComplete(committedBatchId)
    }
  }, [progress?.status, committedBatchId, onExtractionComplete])

  return (
    <Dialog open={open} onOpenChange={phase !== "idle" ? undefined : onOpenChange}>
      <DialogContent className="max-w-4xl gap-0 p-0 sm:max-w-4xl" showCloseButton={phase === "idle"}>
        <DialogHeader className="border-b border-border p-5 pb-4">
          <DialogTitle className="text-base">
            Extract frames from {file.name}
            {duration > 0 && (
              <span className="font-normal text-muted-foreground"> ({duration.toFixed(3)}s)</span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="max-h-[80vh] overflow-y-auto p-6">
          <video ref={setThumbVideoEl} muted className="hidden" />
          <canvas ref={setCanvasEl} className="hidden" />

          {phase === "idle" ? (
            <>
              <video
                ref={playerRef}
                src={videoUrl ?? undefined}
                controls
                className="aspect-video w-full rounded-lg bg-black"
                onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
                onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
              />

              <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {formatTimestamp(currentTime)} / {formatTimestamp(duration)}
                </span>
                <button
                  onClick={() => setManualOpen((v) => !v)}
                  className="flex items-center gap-1 rounded-md border border-border px-2 py-1 font-medium text-foreground hover:bg-accent"
                >
                  {manualOpen ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                  {manualOpen ? "Hide" : "Show"} Manual Selection
                </button>
              </div>

              <div
                ref={filmstripRef}
                className="relative mt-2 flex h-24 overflow-hidden rounded-md border border-border bg-muted select-none"
              >
                {filmstripStatus === "loading" ? (
                  <div className="flex w-full items-center justify-center text-xs text-muted-foreground">
                    {duration === 0 ? "Loading video…" : "Generating preview…"}
                  </div>
                ) : filmstripStatus === "unavailable" ? (
                  <div className="flex w-full items-center justify-center text-xs text-muted-foreground">
                    Preview unavailable — use the player above and the controls below to pick frames.
                  </div>
                ) : (
                  <div className="flex w-full gap-px bg-black">
                    {filmstrip.map((src, i) => (
                      <img key={i} src={src} className="h-full flex-1 object-cover" alt="" />
                    ))}
                  </div>
                )}

                {duration > 0 && (
                  <>
                    <div
                      className="pointer-events-none absolute inset-y-0 left-0 bg-black/50"
                      style={{ width: `${(rangeStart / duration) * 100}%` }}
                    />
                    <div
                      className="pointer-events-none absolute inset-y-0 right-0 bg-black/50"
                      style={{ width: `${100 - (rangeEnd / duration) * 100}%` }}
                    />
                    <div
                      className="pointer-events-none absolute top-0 h-full w-0.5 bg-brand"
                      style={{ left: `${(currentTime / duration) * 100}%` }}
                    />
                    {manualMarks.map((m) => (
                      <div
                        key={m}
                        className="pointer-events-none absolute top-0 h-full w-0.5 bg-amber-400"
                        style={{ left: `${(m / duration) * 100}%` }}
                      />
                    ))}
                    <div
                      onPointerDown={(e) => {
                        e.preventDefault()
                        setDraggingHandle("start")
                      }}
                      className="absolute top-0 z-10 flex h-full w-4 -translate-x-1/2 cursor-ew-resize items-center justify-center rounded-md bg-brand shadow-md ring-1 ring-white/40 hover:brightness-110"
                      style={{ left: `${(rangeStart / duration) * 100}%` }}
                    >
                      <GripVertical className="size-3.5 text-brand-foreground" />
                    </div>
                    <div
                      onPointerDown={(e) => {
                        e.preventDefault()
                        setDraggingHandle("end")
                      }}
                      className="absolute top-0 z-10 flex h-full w-4 -translate-x-1/2 cursor-ew-resize items-center justify-center rounded-md bg-brand shadow-md ring-1 ring-white/40 hover:brightness-110"
                      style={{ left: `${(rangeEnd / duration) * 100}%` }}
                    >
                      <GripVertical className="size-3.5 text-brand-foreground" />
                    </div>
                  </>
                )}
              </div>
              {duration > 0 && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Sampling range: {formatTimestamp(rangeStart)} – {formatTimestamp(rangeEnd)}
                  {(rangeStart > 0 || rangeEnd < duration) && (
                    <button
                      className="ml-2 text-brand hover:underline"
                      onClick={() => {
                        setRangeStart(0)
                        setRangeEnd(duration)
                      }}
                    >
                      Reset
                    </button>
                  )}
                </p>
              )}

              {manualOpen && (
                <div className="mt-3 rounded-lg border border-border p-3">
                  <p className="mb-2 text-sm font-semibold text-foreground">Select frames to upload</p>
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={manualMarks.length === 0}
                      onClick={() => jumpToAdjacentMark("prev")}
                    >
                      ⏮ Previous
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => seekTo(currentTime - 1 / ASSUMED_FPS)}>
                      ‹ -1 Frame
                    </Button>
                    <Button
                      size="sm"
                      onClick={toggleCurrentFrame}
                      className={cn(
                        isMarked
                          ? "bg-amber-100 text-amber-700 hover:bg-amber-200"
                          : "bg-amber-50 text-amber-700 hover:bg-amber-100"
                      )}
                    >
                      {isMarked ? "Remove Current Frame" : "Add Current Frame"}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => seekTo(currentTime + 1 / ASSUMED_FPS)}>
                      +1 Frame ›
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={manualMarks.length === 0}
                      onClick={() => jumpToAdjacentMark("next")}
                    >
                      Next ⏭
                    </Button>
                  </div>

                  <div className="mt-3 flex flex-wrap items-start gap-2 text-sm">
                    <span className="font-medium text-foreground">Selected frames</span>
                    {manualMarks.length === 0 ? (
                      <span className="text-muted-foreground">Add frames from the current playhead.</span>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {manualMarks.map((m) => (
                          <span
                            key={m}
                            className="flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700"
                          >
                            {formatTimestamp(m)}
                            <button onClick={() => setManualMarks((marks) => marks.filter((x) => x !== m))}>
                              <X className="size-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="mt-4 rounded-lg border border-border p-4">
                <p className="mb-4 text-sm font-semibold text-foreground">How should we sample the video?</p>

                <div className="relative mb-2 flex items-center justify-between text-xs">
                  <button
                    onClick={() => setFrameInterval(minInterval)}
                    className={cn(
                      "rounded-md px-2.5 py-1.5 font-medium transition-colors",
                      Math.abs(minInterval - frameInterval) < 1e-6
                        ? "bg-brand text-brand-foreground"
                        : "bg-muted text-muted-foreground hover:bg-accent"
                    )}
                  >
                    {presets.find((p) => p.interval === minInterval)?.label ?? "Fastest"}
                  </button>
                  <button
                    onClick={() => setFrameInterval(maxInterval)}
                    className={cn(
                      "rounded-md px-2.5 py-1.5 font-medium transition-colors",
                      Math.abs(maxInterval - frameInterval) < 1e-6
                        ? "bg-brand text-brand-foreground"
                        : "bg-muted text-muted-foreground hover:bg-accent"
                    )}
                  >
                    {presets.find((p) => p.interval === maxInterval)?.label ?? "Slowest"}
                  </button>
                </div>

                <div className="relative h-7">
                  <span
                    className="absolute top-0 -translate-x-1/2 rounded-md bg-brand px-2.5 py-1 text-xs font-medium whitespace-nowrap text-brand-foreground"
                    style={{ left: `${sliderPosition}%` }}
                  >
                    {formatRate(frameInterval)}
                  </span>
                </div>

                <Slider
                  value={[sliderPosition]}
                  onValueChange={([v]) => setPosition(v)}
                  min={0}
                  max={100}
                  step={0.1}
                  disabled={duration === 0}
                />
                <div className="mt-4 flex items-center gap-2 text-sm text-foreground">
                  Output 1 frame every
                  <Input
                    type="number"
                    step="0.1"
                    min={minInterval}
                    max={maxInterval}
                    value={frameInterval}
                    onChange={(e) =>
                      setFrameInterval(
                        Math.max(minInterval, Math.min(maxInterval, Number(e.target.value) || minInterval))
                      )
                    }
                    className="h-8 w-20"
                  />
                  seconds (
                  <Input
                    type="number"
                    min={1}
                    value={outputCount}
                    onChange={(e) => {
                      const count = Math.max(1, Number(e.target.value) || 1)
                      setFrameInterval(trimmedDuration / count)
                    }}
                    className="h-8 w-20"
                  />
                  images)
                </div>
              </div>

              {uploadError && <p className="mt-3 text-sm text-destructive">{uploadError}</p>}
            </>
          ) : phase === "uploading" ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <p className="text-lg font-semibold text-brand">Processing files…</p>
              <p className="font-mono text-xs text-muted-foreground">{file.name}</p>
              <Progress value={0} className="w-full max-w-sm" />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <p className="text-lg font-semibold text-brand">Processing files…</p>
              <p className="font-mono text-xs text-muted-foreground">
                {progress?.message ?? "Starting extraction…"}
              </p>
              <Progress value={progress?.percent ?? 0} className="w-full max-w-sm" />
              {progress?.total ? (
                <p className="text-xs text-muted-foreground">
                  {progress.saved} / {progress.total} frames
                </p>
              ) : null}
              {progress?.status === "failed" && (
                <p className="text-sm text-destructive">{progress.message}</p>
              )}
            </div>
          )}
        </div>

        {phase === "idle" && (
          <div className="flex items-center justify-between border-t border-border p-4">
            <Button variant="outline" onClick={onSkip}>
              Skip Video
            </Button>
            <Button variant="brand" onClick={handleExtract} disabled={duration === 0}>
              Extract {combinedCount} Frame{combinedCount !== 1 && "s"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function extractErrorMessage(err: unknown): string {
  if (typeof err === "object" && err !== null && "response" in err) {
    const resp = (err as { response?: { data?: { detail?: unknown } } }).response
    const detail = resp?.data?.detail
    if (typeof detail === "string") return detail
  }
  return "Upload failed — please try again."
}
